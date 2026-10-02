// ─────────────────────────────────────────────────────────────
// What the public booking engine is allowed to know.
//
// The booking site used to ship its own hardcoded room list and price table.
// Everything it shows now comes from here instead, so the rooms, rates,
// occupancy limits, currency and availability a guest sees on /book are the
// same rows the front desk works from — edit a rate in the PMS and the site
// quotes it on the next page load.
//
// Deliberately read-only and deliberately narrow: no ids a guest could use to
// probe the rest of the API, no cost prices, no per-room detail. The only
// write the public surface has is the reservation POST.
// ─────────────────────────────────────────────────────────────
import { all, get, parseJson } from '../db.ts';
import { HttpError, addDays, dateRange, nightsBetween, todayIso } from '../lib/util.ts';
import { availabilityGrid } from './availability.ts';
import { packagePlans } from './packages.ts';
import { activeTaxes, quoteStay, type RoomTypeRow } from './pricing.ts';
import { validateStay } from './restrictions.ts';
import { depositPolicy } from './bookingmoney.ts';

/** The three room shapes the booking site's flow is built around. */
export type BookingKind = 'dorm' | 'double' | 'family';

interface PropertyRow {
  id: string; code: string; name: string; kind: string;
  address: string | null; city: string | null; country: string | null;
  timezone: string; currency: string; locale: string; business_date: string;
  check_in_time: string; check_out_time: string;
  phone: string | null; email: string | null; website: string | null;
}

/** How far ahead "from $X a night" looks when it hunts for the lowest rate. */
const FROM_PRICE_WINDOW_DAYS = 90;

/* ------------------------------------------------------------- property -- */

/**
 * Which property a public request is for.
 *
 * Single-property installations — which is nearly all of them — need to say
 * nothing at all. Anything with a second property has to be told, because
 * guessing would quote one property's rates and book the other's rooms.
 */
export function resolvePublicProperty(hint: {
  propertyId?: unknown;
  propertyCode?: unknown;
}): string {
  const wantId = typeof hint.propertyId === 'string' && hint.propertyId ? hint.propertyId : null;
  if (wantId) {
    const byId = get<{ id: string }>('SELECT id FROM properties WHERE id = ?', wantId);
    if (byId) return byId.id;
  }

  const wantCode = typeof hint.propertyCode === 'string' && hint.propertyCode ? hint.propertyCode : null;
  if (wantCode) {
    const byCode = get<{ id: string }>('SELECT id FROM properties WHERE code = ?', wantCode);
    if (byCode) return byCode.id;
  }

  const list = all<{ id: string }>('SELECT id FROM properties WHERE active = 1 ORDER BY created_at LIMIT 2');
  if (list.length === 1) return list[0].id;
  if (list.length === 0) throw new HttpError(428, 'This installation has not been set up yet', 'setup_required');
  throw new HttpError(409,
    'More than one property exists. Pass propertyCode or propertyId with the request.',
    'property_required');
}

export function publicProperty(propertyId: string): PropertyRow {
  const p = get<PropertyRow>('SELECT * FROM properties WHERE id = ?', propertyId);
  if (!p) throw new HttpError(404, 'Property not found');
  return p;
}

/* ------------------------------------------------------------ rate plan -- */

/** The rate plan the public site sells on: BAR if there is one, else the first. */
export function publicRatePlanId(propertyId: string): string {
  const bar = get<{ id: string }>(
    `SELECT id FROM rate_plans
      WHERE property_id = ? AND active = 1 AND upper(code) = 'BAR'
      ORDER BY sort_order, name LIMIT 1`,
    propertyId,
  );
  if (bar) return bar.id;
  const first = get<{ id: string }>(
    `SELECT id FROM rate_plans
      WHERE property_id = ? AND active = 1 AND kind = 'public'
      ORDER BY sort_order, name LIMIT 1`,
    propertyId,
  );
  if (first) return first.id;
  const any = get<{ id: string }>(
    `SELECT id FROM rate_plans
      WHERE property_id = ? AND active = 1
      ORDER BY sort_order, name LIMIT 1`,
    propertyId,
  );
  if (!any) throw new HttpError(409, 'No active rate plans are configured for this property');
  return any.id;
}

/**
 * The plan that prices the room for one booking-engine model.
 *
 * It is the room rate plan, whichever model is being booked: a room is the
 * same room whatever else the guest is buying with it, and a guest comparing
 * "rooms" with "rooms + surf" is entitled to see the same bed at the same
 * price in both. The desk and the lessons are priced beside it, one line each,
 * so the guest can see what the surfing costs rather than reading it out of the
 * difference between two room rates.
 *
 * Package plans keep their own rates in the PMS and are still sold, quoted and
 * pushed to channels like any other plan — they simply do not price the room
 * on the public site. `model` is kept in the signature because it is what the
 * caller has to hand and what this rule is about.
 */
export function publicRatePlanIdForModel(propertyId: string, _model: string | null | undefined): string {
  return publicRatePlanId(propertyId);
}

/* ----------------------------------------------------------- room types -- */

interface PublicRoomTypeRow extends RoomTypeRow {
  description: string | null;
  amenities: string | null;
  bed_config: string | null;
  gender_policy: string | null;
  sort_order: number;
}

export function publicRoomTypes(propertyId: string): PublicRoomTypeRow[] {
  return all<PublicRoomTypeRow>(
    `SELECT id, code, name, description, kind, base_occupancy, max_occupancy,
            max_adults, max_children, default_rate_minor, extra_adult_minor,
            extra_child_minor, amenities, bed_config, gender_policy, sort_order
       FROM room_types
      WHERE property_id = ? AND active = 1
      ORDER BY kind = 'dorm', sort_order, name`,
    propertyId,
  );
}

/**
 * Descriptions the channel import wrote for its own benefit, e.g. "From Beds24
 * room 715747". They are provenance, not room copy, and putting them in front
 * of a guest reads as a leak — so they are dropped rather than published.
 */
const IMPORT_PROVENANCE = /^from\s+beds24\s+room\s+\d+$/i;

function guestDescription(description: string | null): string | null {
  const text = description?.trim();
  if (!text || IMPORT_PROVENANCE.test(text)) return null;
  return text;
}

/**
 * Which of the site's three shapes a PMS room type sells as.
 *
 * The PMS only distinguishes rooms from dorm beds; "family" is a marketing
 * split of the room side, so it is read off capacity and naming rather than
 * from a column that does not exist.
 */
export function bookingKindFor(rt: { kind: string; code: string; name: string; max_occupancy: number }): BookingKind {
  if (rt.kind === 'dorm') return 'dorm';
  // "Ensuite" is a bathroom, not a suite, and it appears in the name of very
  // nearly every hostel room there is — matching `suite` inside it turned a
  // two-person double into a family room, which then answered a family search
  // and was offered to four guests it cannot hold. Taken out of the text
  // before the test rather than fought with in the pattern.
  const text = `${rt.code} ${rt.name}`.toLowerCase().replace(/en[\s-]?suite/g, ' ');
  if (/fam|suite|apartment/.test(text) || rt.max_occupancy >= 3) return 'family';
  return 'double';
}

/**
 * The room type a public booking of `kind` lands on.
 *
 * Prefers an explicit id when the site sends one — it got that id from the
 * catalog, so it is naming a real room type rather than guessing — and falls
 * back to matching on shape for older clients that only send a kind.
 */
export function roomTypeForPublicBooking(
  propertyId: string,
  kind: BookingKind,
  people: number,
  preferredId?: unknown,
): string {
  if (typeof preferredId === 'string' && preferredId) {
    const wanted = get<{ id: string }>(
      'SELECT id FROM room_types WHERE id = ? AND property_id = ? AND active = 1',
      preferredId, propertyId,
    );
    if (wanted) return wanted.id;
  }

  const candidates = publicRoomTypes(propertyId);
  if (!candidates.length) throw new HttpError(409, 'No active room types are configured for this property');

  const ofKind = candidates.filter((rt) => bookingKindFor(rt) === kind);
  // Cheapest of the right shape that can actually hold the party.
  const fits = ofKind.filter((rt) => rt.kind === 'dorm' || rt.max_occupancy >= people);
  const pool = fits.length ? fits : ofKind;
  if (pool.length) return pool[0].id;

  const anyFits = candidates.find((rt) => rt.kind === 'dorm' || rt.max_occupancy >= people);
  return (anyFits ?? candidates[0]).id;
}

/* ---------------------------------------------------------------- rates -- */

/**
 * The lowest nightly rate on the calendar for a room type, looking ahead.
 *
 * This is the "from …" figure on a room card, so it reads the calendar rather
 * than the rate plan's base: a property that has priced its season is quoting
 * those numbers, and a base rate nobody sells at would undercut them.
 */
export function fromNightlyMinor(propertyId: string, ratePlanId: string, rt: PublicRoomTypeRow, from: string): number {
  const to = addDays(from, FROM_PRICE_WINDOW_DAYS);
  const cheapest = get<{ price_minor: number }>(
    `SELECT min(price_minor) AS price_minor FROM rate_calendar
      WHERE property_id = ? AND room_type_id = ? AND rate_plan_id = ?
        AND date >= ? AND date < ?`,
    propertyId, rt.id, ratePlanId, from, to,
  );
  if (cheapest && Number.isFinite(cheapest.price_minor) && cheapest.price_minor > 0) {
    return cheapest.price_minor;
  }
  const base = get<{ base_rate_minor: number }>(
    'SELECT base_rate_minor FROM rate_plan_room_types WHERE rate_plan_id = ? AND room_type_id = ?',
    ratePlanId, rt.id,
  );
  if (base && base.base_rate_minor > 0) return base.base_rate_minor;
  return rt.default_rate_minor;
}

/* --------------------------------------------------------------- extras -- */

/**
 * Coworking, surf and airport pickup.
 *
 * These are sold alongside the room but are not hotel inventory, so the PMS
 * has no table for them — they live in the property's settings, editable from
 * the admin app like any other setting, and fall back to the figures the
 * booking site used to hardcode so a property that has not touched them still
 * quotes something sane.
 */
export const EXTRAS_SETTING_KEY = 'booking_engine.extras';

export interface PublicExtras {
  coworking: {
    seatPerDayMinor: { normal: number; office: number };
    marginPct: number;
  };
  surf: {
    lessonMinor: {
      beginner: { general: number; private: number };
      intermediate: { general: number; private: number };
      advanced: { general: number; private: number };
    };
  };
  addons: {
    airportPickup: { upToPeople: number; priceMinor: number }[];
  };
}

export const DEFAULT_EXTRAS: PublicExtras = {
  coworking: {
    seatPerDayMinor: { normal: 800, office: 1200 },
    marginPct: 0,
  },
  surf: {
    lessonMinor: {
      beginner: { general: 3500, private: 6000 },
      intermediate: { general: 4000, private: 7000 },
      advanced: { general: 4500, private: 8000 },
    },
  },
  addons: {
    airportPickup: [
      { upToPeople: 3, priceMinor: 7500 },
      { upToPeople: 4, priceMinor: 10000 },
    ],
  },
};

const int = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : fallback;

/** Merged over the defaults, so a partially-filled setting cannot blank a price. */
export function publicExtras(propertyId: string): PublicExtras {
  const row = get<{ value: string }>(
    'SELECT value FROM settings WHERE property_id = ? AND key = ?',
    propertyId, EXTRAS_SETTING_KEY,
  );
  const saved = parseJson<Partial<PublicExtras> | null>(row?.value, null);
  if (!saved || typeof saved !== 'object') return DEFAULT_EXTRAS;

  const d = DEFAULT_EXTRAS;
  const seat: Partial<PublicExtras['coworking']['seatPerDayMinor']> =
    saved.coworking?.seatPerDayMinor ?? {};
  const lesson: Partial<PublicExtras['surf']['lessonMinor']> = saved.surf?.lessonMinor ?? {};
  const bands = Array.isArray(saved.addons?.airportPickup) ? saved.addons!.airportPickup : null;

  return {
    coworking: {
      seatPerDayMinor: {
        normal: int(seat.normal, d.coworking.seatPerDayMinor.normal),
        office: int(seat.office, d.coworking.seatPerDayMinor.office),
      },
      marginPct: int(saved.coworking?.marginPct, d.coworking.marginPct),
    },
    surf: {
      lessonMinor: {
        beginner: {
          general: int(lesson.beginner?.general, d.surf.lessonMinor.beginner.general),
          private: int(lesson.beginner?.private, d.surf.lessonMinor.beginner.private),
        },
        intermediate: {
          general: int(lesson.intermediate?.general, d.surf.lessonMinor.intermediate.general),
          private: int(lesson.intermediate?.private, d.surf.lessonMinor.intermediate.private),
        },
        advanced: {
          general: int(lesson.advanced?.general, d.surf.lessonMinor.advanced.general),
          private: int(lesson.advanced?.private, d.surf.lessonMinor.advanced.private),
        },
      },
    },
    addons: {
      airportPickup: (bands?.length ? bands : d.addons.airportPickup)
        .map((b, i) => ({
          upToPeople: int(b?.upToPeople, d.addons.airportPickup[i]?.upToPeople ?? 1),
          priceMinor: int(b?.priceMinor, d.addons.airportPickup[i]?.priceMinor ?? 0),
        }))
        // The site takes the first band that covers the party, so an unsorted
        // list would price a large group off a small band.
        .sort((a, b) => a.upToPeople - b.upToPeople),
    },
  };
}

/* -------------------------------------------------------------- catalog -- */

/** Everything the booking site needs to draw its room step without guessing. */
export function publicCatalog(propertyId: string) {
  const property = publicProperty(propertyId);
  const ratePlanId = publicRatePlanId(propertyId);
  const plan = get<any>('SELECT * FROM rate_plans WHERE id = ?', ratePlanId)!;
  const types = publicRoomTypes(propertyId);
  const from = property.business_date;

  // One grid for tonight, only so a room card can say "2 left" before the
  // guest has chosen dates. Real availability comes from the dates they pick.
  const tonight = availabilityGrid(propertyId, from, addDays(from, 1));

  return {
    property: {
      code: property.code,
      name: property.name,
      kind: property.kind,
      city: property.city,
      country: property.country,
      address: property.address,
      timezone: property.timezone,
      currency: property.currency,
      locale: property.locale,
      businessDate: property.business_date,
      checkInTime: property.check_in_time,
      checkOutTime: property.check_out_time,
      phone: property.phone,
      email: property.email,
      website: property.website,
    },
    currency: property.currency,
    ratePlan: {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: guestDescription(plan.description),
      refundable: plan.refundable === 1,
      inclusions: parseJson<string[]>(plan.inclusions, []),
      minLos: plan.min_los,
      maxLos: plan.max_los,
      depositPctBp: plan.deposit_pct_bp,
    },
    roomTypes: types.map((rt) => ({
      id: rt.id,
      code: rt.code,
      name: rt.name,
      description: guestDescription(rt.description),
      kind: rt.kind as 'room' | 'dorm',
      bookingKind: bookingKindFor(rt),
      baseOccupancy: rt.base_occupancy,
      maxOccupancy: rt.max_occupancy,
      maxAdults: rt.max_adults,
      maxChildren: rt.max_children,
      genderPolicy: rt.gender_policy,
      amenities: parseJson<string[]>(rt.amenities, []),
      bedConfig: parseJson<{ kind: string; count: number }[]>(rt.bed_config, []),
      extraAdultMinor: rt.extra_adult_minor,
      extraChildMinor: rt.extra_child_minor,
      fromNightlyMinor: fromNightlyMinor(propertyId, ratePlanId, rt, from),
      unitsTotal: tonight.find((c) => c.roomTypeId === rt.id)?.physical ?? 0,
      unitsAvailableTonight: Math.max(0, tonight.find((c) => c.roomTypeId === rt.id)?.available ?? 0),
    })),
    // Shown as a footnote, not added twice: the availability quote already
    // includes tax in its grand total.
    taxes: activeTaxes(propertyId).map((t) => ({
      code: t.code, name: t.name, mode: t.mode, value: t.value,
    })),
    extras: publicExtras(propertyId),
    /**
     * What the property asks for up front.
     *
     * Published on the catalog as well as per-quote so the page can say
     * "20% deposit to book" before a guest has picked dates — which is when
     * it matters, because it is part of deciding whether to book at all.
     */
    deposit: (() => {
      const policy = depositPolicy(propertyId);
      return {
        mode: policy.mode,
        percentBp: policy.percentBp,
        message: policy.message,
        methods: policy.methods,
      };
    })(),
    // Which of the site's models the property sells as a package, and under
    // which plan. A model missing from this list is priced from the room rate
    // plus the extras below, which is how every model was priced before
    // packages existed.
    packages: packagePlans(propertyId).map((p) => ({
      model: p.booking_model,
      ratePlanId: p.id,
      code: p.code,
      name: p.name,
      description: guestDescription(p.description),
      inclusions: parseJson<string[]>(p.inclusions, []),
      refundable: p.refundable === 1,
      minLos: p.min_los,
      maxLos: p.max_los,
      depositPctBp: p.deposit_pct_bp,
    })),
  };
}

/* --------------------------------------------------------- availability -- */

/**
 * What each room type actually costs, and whether it can be sold, for one set
 * of dates.
 *
 * The price here is the PMS's own — calendar rates, occupancy supplements,
 * length-of-stay pricing, yield rules and tax — so the figure on the site is
 * the figure the reservation is written at rather than a browser's estimate.
 *
 * The room is quoted off the room rate plan for every model — see
 * `publicRatePlanIdForModel` — so the same room costs the same whether or not
 * the guest is buying lessons with it, and the extras are itemised beside it.
 */
export function publicAvailability(propertyId: string, opts: {
  checkIn: string;
  checkOut: string;
  adults: number;
  children?: number;
  model?: string | null;
}) {
  const property = publicProperty(propertyId);
  const nights = nightsBetween(opts.checkIn, opts.checkOut);
  if (nights <= 0) throw new HttpError(400, 'checkOut must be at least one night after checkIn');
  if (nights > 90) throw new HttpError(400, 'Stays longer than 90 nights cannot be booked online');

  const ratePlanId = publicRatePlanIdForModel(propertyId, opts.model);
  const types = publicRoomTypes(propertyId);
  const grid = availabilityGrid(propertyId, opts.checkIn, opts.checkOut);
  const children = opts.children ?? 0;
  const bookedOn = property.business_date;
  const stayDates = dateRange(opts.checkIn, opts.checkOut);

  const options = types.map((rt) => {
    const cells = grid.filter((c) => c.roomTypeId === rt.id);
    const available = cells.length ? Math.min(...cells.map((c) => Math.max(0, c.available))) : 0;

    // A dorm sells beds, so a party of four needs four of them; a room sells
    // the whole room, so one unit holds the party up to its occupancy.
    const unitsNeeded = rt.kind === 'dorm' ? Math.max(1, opts.adults + children) : 1;
    const fitsParty = rt.kind === 'dorm'
      ? true
      : opts.adults + children <= rt.max_occupancy;

    const violations = validateStay(propertyId, {
      roomTypeId: rt.id, ratePlanId, arrival: opts.checkIn, departure: opts.checkOut,
      channelCode: null, bookedOn,
    });

    // One unit of this type, priced for the heads that would be in it. The
    // occupancy is the question the rate answers: occupancy prices, per-adult
    // supplements and per-person taxes all move with it, which is why a double
    // taken by one guest is not a double taken by two.
    const quoteUnit = (adults: number, kids: number) => quoteStay(propertyId, {
      roomTypeId: rt.id,
      ratePlanId,
      arrival: opts.checkIn,
      departure: opts.checkOut,
      adults,
      children: kids,
      bookedOn,
      currency: property.currency,
    });

    let quote;
    try {
      // A dorm is priced per bed, and quoteStay prices one unit.
      quote = quoteUnit(rt.kind === 'dorm' ? 1 : opts.adults, rt.kind === 'dorm' ? 0 : children);
    } catch {
      // A room type the pricing engine cannot quote (no rate anywhere) is not
      // sellable online, but it should not take the whole page down with it.
      return {
        roomTypeId: rt.id,
        available,
        unitsNeeded,
        sellable: false,
        violations: [{ type: 'no_rate', date: opts.checkIn, message: 'No rate is loaded for these dates' }],
        nights: stayDates.length,
        roomTotalMinor: 0,
        taxTotalMinor: 0,
        grandTotalMinor: 0,
        averageNightlyMinor: 0,
        nightly: [],
        occupancyPrices: [],
      };
    }

    /**
     * What one unit costs at every party size it can hold.
     *
     * The site lets a guest take a room without filling it — a solo traveller
     * in a double — so it cannot price a room from one figure quoted for the
     * whole party. One row per occupancy, straight from the same engine the
     * reservation is written at, is what lets the browser add up an allocation
     * of part-filled rooms and still show the property's own price. A dorm
     * sells a bed at a time, so it has the single row.
     */
    const occupancyPrices: {
      occupancy: number;
      roomTotalMinor: number;
      taxTotalMinor: number;
      grandTotalMinor: number;
      averageNightlyMinor: number;
    }[] = [];
    const topOccupancy = rt.kind === 'dorm' ? 1 : Math.max(1, rt.max_occupancy);
    for (let people = 1; people <= topOccupancy; people += 1) {
      try {
        const q = quoteUnit(people, 0);
        occupancyPrices.push({
          occupancy: people,
          roomTotalMinor: q.roomTotalMinor,
          taxTotalMinor: q.taxTotalMinor,
          grandTotalMinor: q.grandTotalMinor,
          averageNightlyMinor: q.nights.length
            ? Math.round(q.roomTotalMinor / q.nights.length) : 0,
        });
      } catch {
        // An occupancy the pricing engine cannot answer for is simply not
        // offered; the rest of the room's prices still stand.
      }
    }

    const units = rt.kind === 'dorm' ? unitsNeeded : 1;
    return {
      roomTypeId: rt.id,
      available,
      unitsNeeded,
      sellable: violations.length === 0 && available >= unitsNeeded && fitsParty,
      violations,
      nights: quote.nights.length,
      roomTotalMinor: quote.roomTotalMinor * units,
      taxTotalMinor: quote.taxTotalMinor * units,
      grandTotalMinor: quote.grandTotalMinor * units,
      averageNightlyMinor: quote.nights.length
        ? Math.round((quote.roomTotalMinor * units) / quote.nights.length) : 0,
      nightly: quote.nights.map((n) => ({ date: n.date, rateMinor: n.rateMinor * units })),
      occupancyPrices,
    };
  });

  const policy = depositPolicy(propertyId);

  return {
    checkIn: opts.checkIn,
    checkOut: opts.checkOut,
    nights,
    /**
     * The deposit rule for these dates, unattached to any one room.
     *
     * The amount depends on what the guest ends up choosing, so the page works
     * it out from the rule and its own running total rather than from a figure
     * quoted per room type — a party across a double and two dorm beds has one
     * deposit, not three.
     */
    deposit: {
      mode: policy.mode,
      percentBp: policy.percentBp,
      message: policy.message,
      methods: policy.methods,
    },
    adults: opts.adults,
    children,
    currency: property.currency,
    businessDate: bookedOn,
    model: opts.model ?? null,
    ratePlanId,
    // The totals above are always the room alone now. Both fields are kept so
    // an older site build still reads a shape it understands.
    packaged: false,
    packageName: null,
    options,
  };
}

/** Guests cannot book a stay that has already started. */
export function assertBookable(propertyId: string, checkIn: string): void {
  const property = publicProperty(propertyId);
  if (checkIn < property.business_date) {
    throw new HttpError(400, 'Check-in cannot be in the past', 'arrival_in_past');
  }
  if (checkIn > addDays(todayIso(), 730)) {
    throw new HttpError(400, 'That date is too far ahead to book online');
  }
}
