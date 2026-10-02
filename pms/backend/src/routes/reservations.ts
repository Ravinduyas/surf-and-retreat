// Reservations and the front-desk day: arrivals, check-in, in-house,
// departures, check-out, walk-ins, room moves, groups and the waitlist.
import { router, type Ctx } from '../lib/http.ts';
import { all, get, run, tx, scalar, jsonCol, parseJson } from '../db.ts';
import {
  id, nowIso, str, int, money, boolIn, oneOf, assertDate, addDays, slugCode,
  HttpError, notFound, nightsBetween, dateRangeInclusive,
} from '../lib/util.ts';
import {
  createReservation, updateReservation, cancelReservation, listReservations,
  getReservationDetail, assignRoom, moveRoom, checkIn, checkOut, markNoShow,
  addNote, createWalkIn, postOutstandingNights, findOrCreateProfile,
  confirmBooking, bookingGroup, type ConfirmAssignment,
} from '../services/reservations.ts';
import { checkAvailability, freeRooms, freeBeds } from '../services/availability.ts';
import { isPending } from '../services/pendingbookings.ts';
import { depositPolicy, quoteDeposit } from '../services/bookingmoney.ts';
import {
  createRegistrationLink, revokeRegistrationLink, linkStatus, registrationContext,
  submitRegistration, acceptRegistration, discardRegistration,
} from '../services/guestregistration.ts';
import { previewStayChange, changeStayDates } from '../services/staydates.ts';
import {
  reportToChannel, reportEligibility, reportState, unreportedNoShows,
  REPORT_KINDS, type ReportKind,
} from '../services/channelreports.ts';
import { frontDeskLists } from '../services/reports.ts';
import {
  listDocuments, storeDocument, readDocument, deleteDocument, type DocumentKind,
} from '../services/documents.ts';
import { openFolio } from '../services/folio.ts';
import { audit } from '../services/audit.ts';
import {
  assertBookable, publicRatePlanIdForModel, resolvePublicProperty, roomTypeForPublicBooking,
} from '../services/publicbooking.ts';

const pid = (ctx: Ctx) => ctx.auth.propertyId;
const actor = (ctx: Ctx) => ctx.auth;
const businessDate = (ctx: Ctx) =>
  get<{ business_date: string }>('SELECT business_date FROM properties WHERE id = ?', pid(ctx))!.business_date;

/**
 * Which property an unauthenticated booking is for. Reads the same hints as
 * the public catalog does, so the site can name the property once and have
 * both calls land on it.
 */
function publicPropertyId(ctx: Ctx): string {
  return resolvePublicProperty({
    propertyId: ctx.body?.propertyId ?? ctx.query.get('propertyId'),
    propertyCode: ctx.body?.propertyCode ?? ctx.query.get('propertyCode'),
  });
}

// ─── List / read ─────────────────────────────────────────────
router.get('/api/reservations', (ctx: Ctx) => {
  const q = ctx.query;
  const statuses = q.get('status')?.split(',').filter(Boolean);
  return listReservations(pid(ctx), {
    status: statuses,
    arrivalFrom: q.get('arrivalFrom') ?? undefined,
    arrivalTo: q.get('arrivalTo') ?? undefined,
    arrivalOn: q.get('arrivalOn') ?? undefined,
    departureOn: q.get('departureOn') ?? undefined,
    inHouseOn: q.get('inHouseOn') ?? undefined,
    search: q.get('search') ?? undefined,
    roomTypeId: q.get('roomTypeId') ?? undefined,
    groupId: q.get('groupId') ?? undefined,
    companyId: q.get('companyId') ?? undefined,
    profileId: q.get('profileId') ?? undefined,
    channelCode: q.get('channelCode') ?? undefined,
    limit: q.get('limit') ? Number(q.get('limit')) : undefined,
    offset: q.get('offset') ? Number(q.get('offset')) : undefined,
  });
}, { perm: 'reservations.read' });

router.get('/api/reservations/:id', (ctx: Ctx) =>
  getReservationDetail(pid(ctx), ctx.params.id), { perm: 'reservations.read' });

// ─── Create / amend ──────────────────────────────────────────
function readCreateInput(ctx: Ctx) {
  const b = ctx.body;
  return {
    guestName: str(b.guestName, 'guestName', { max: 120 }),
    email: b.email ? String(b.email) : undefined,
    phone: b.phone ? String(b.phone) : undefined,
    profileId: b.profileId ?? null,
    arrival: assertDate(b.arrival, 'arrival'),
    departure: assertDate(b.departure, 'departure'),
    adults: int(b.adults ?? 1, 'adults', { min: 1, max: 40 }),
    children: int(b.children ?? 0, 'children', { min: 0, max: 20 }),
    roomTypeId: str(b.roomTypeId, 'roomTypeId'),
    ratePlanId: str(b.ratePlanId, 'ratePlanId'),
    roomId: b.roomId ?? null,
    bedId: b.bedId ?? null,
    status: b.status ? oneOf(b.status, 'status',
      ['Tentative', 'Confirmed', 'Guaranteed'] as const) : 'Confirmed',
    source: b.source ?? 'Direct',
    channelCode: b.channelCode ?? null,
    otaReference: b.otaReference ?? null,
    segment: b.segment ?? null,
    companyId: b.companyId ?? null,
    groupId: b.groupId ?? null,
    vip: boolIn(b.vip),
    eta: b.eta ?? null,
    etd: b.etd ?? null,
    specialRequests: b.specialRequests ?? null,
    preferences: Array.isArray(b.preferences) ? b.preferences : [],
    paymentMethod: b.paymentMethod ?? null,
    cardLast4: b.cardLast4 ?? null,
    promotionCode: b.promotionCode ?? null,
    origin: b.origin ?? undefined,
    rateOverrideMinor: b.rateOverrideMinor === undefined || b.rateOverrideMinor === null
      ? null : money(b.rateOverrideMinor, 'rateOverrideMinor'),
    overrideReason: b.overrideReason ?? null,
    depositRequiredMinor: b.depositRequiredMinor === undefined
      ? null : money(b.depositRequiredMinor, 'depositRequiredMinor'),
    commissionMinor: b.commissionMinor === undefined ? null : money(b.commissionMinor, 'commissionMinor'),
    force: boolIn(b.force),
  };
}

router.post('/api/reservations', (ctx: Ctx) => {
  const input = readCreateInput(ctx);
  // Overriding the rate or forcing past availability is a supervisor action.
  if ((input.rateOverrideMinor !== null || input.force)
      && !['admin', 'manager', 'revenue', 'reservations'].includes(ctx.auth.role)) {
    throw new HttpError(403, 'Your role cannot override rates or availability', 'forbidden');
  }
  return createReservation(pid(ctx), actor(ctx), input);
}, { perm: 'reservations.write' });

/**
 * A booking taken by the public website.
 *
 * Two things separate this from every other way a reservation is created.
 *
 * It lands **awaiting confirmation** (`pendingbookings.ts`): a guest submitting
 * a form is not the property agreeing to house them, so it holds no inventory,
 * has no room, and cannot be checked in until a person accepts it and picks the
 * bed. An OTA booking is the opposite — the room was already sold elsewhere —
 * and is left exactly as it was.
 *
 * And a dorm party becomes **one reservation per bed**, linked by `parent_id`.
 * A bed is what the PMS assigns, prices, cleans and draws on the tape chart, so
 * four guests in a dorm are four reservations. Selling them as one row is what
 * made the site charge for four beds while the PMS held one.
 */
router.post('/api/public/booking-engine/reservations', (ctx: Ctx) => {
  const b = ctx.body;
  const contact = b?.contact && typeof b.contact === 'object' ? b.contact : {};
  const room = b?.room && typeof b.room === 'object' ? b.room : {};
  const model = typeof b?.model === 'string' ? b.model : 'rooms';

  const propertyId = publicPropertyId(ctx);
  const people = int(room.people ?? 1, 'room.people', { min: 1, max: 40 });
  const roomKind = oneOf(room.kind ?? 'double', 'room.kind', ['dorm', 'double', 'family'] as const);
  // A package model books on its own plan, so the reservation is written at
  // the package price the site quoted rather than at the room rate.
  const ratePlanId = publicRatePlanIdForModel(propertyId, model);
  const arrival = assertDate(b.checkIn, 'checkIn');
  const departure = assertDate(b.checkOut, 'checkOut');
  assertBookable(propertyId, arrival);
  const notes = typeof contact.notes === 'string' && contact.notes.trim() ? contact.notes.trim() : null;

  const roomTypeRow = (id: string) => {
    const rt = get<any>(
      'SELECT * FROM room_types WHERE id = ? AND property_id = ? AND active = 1', id, propertyId);
    if (!rt) notFound('Room type');
    return rt;
  };

  /**
   * The rooms and beds the guest actually chose.
   *
   * A party is not always one room. The site lets three guests take a double
   * and a dorm bed, and sends that allocation with the booking; writing the
   * whole party against the first room type instead both lies about who is
   * sleeping where and, whenever the party is bigger than that one room, is a
   * booking the PMS refuses outright — "Deluxe Double Room holds a maximum of
   * 2 guest(s)" — for a combination the site had already priced and accepted.
   *
   * The room type is looked up per line, so a line naming a type this property
   * does not sell is a 404 rather than a booking against the wrong room.
   */
  const allocationLines: { roomType: any; qty: number }[] = (Array.isArray(room.allocation)
    ? room.allocation.filter((e: any) => e && typeof e.roomTypeId === 'string')
    : []
  ).map((e: any) => ({
    roomType: roomTypeRow(e.roomTypeId),
    qty: int(e.qty ?? 1, 'room.allocation[].qty', { min: 1, max: 40 }),
  }));

  // A client that sends no allocation — an older build of the site, or a link
  // that skipped the room step — still books the single room type it named,
  // exactly as it always did.
  const lines = allocationLines.length ? allocationLines : (() => {
    // The site picks a room type off the public catalog, so it sends the id it
    // was given; the kind is only the fallback for a client that has none.
    const rt = roomTypeRow(roomTypeForPublicBooking(propertyId, roomKind, people, room.roomTypeId));
    // A dorm sells beds, so a party of four needs four of them; a room sells
    // the whole room and holds the party up to its occupancy.
    return [{ roomType: rt, qty: rt.kind === 'dorm' ? people : 1 }];
  })();

  /**
   * How many of the party sleeps in each unit.
   *
   * The same rule the site prices with: every unit takes one guest first, and
   * only then do the rest fill up to occupancy in order — so two doubles for
   * two guests is one head each rather than a full room and an empty one, and a
   * double taken by one guest is booked, and charged, for one. Because no unit
   * is ever given more than its occupancy, a combination the site accepted is
   * one the PMS accepts too.
   */
  const plannedUnits: { roomType: any; adults: number }[] = [];
  for (const line of lines) {
    for (let i = 0; i < line.qty; i += 1) plannedUnits.push({ roomType: line.roomType, adults: 0 });
  }
  if (!plannedUnits.length) throw new HttpError(400, 'Choose a room to book', 'no_rooms');
  if (plannedUnits.length > people) {
    throw new HttpError(400,
      `${plannedUnits.length} rooms and beds were chosen for ${people} guest(s)`, 'over_rooms');
  }
  let unassigned = people;
  for (const unit of plannedUnits) { unit.adults = 1; unassigned -= 1; }
  for (const unit of plannedUnits) {
    if (unassigned <= 0) break;
    const capacity = unit.roomType.kind === 'dorm' ? 1 : Math.max(1, unit.roomType.max_occupancy);
    const add = Math.min(capacity - unit.adults, unassigned);
    unit.adults += add;
    unassigned -= add;
  }
  if (unassigned > 0) {
    throw new HttpError(400,
      `The rooms chosen hold ${people - unassigned} of ${people} guest(s)`, 'under_capacity');
  }

  const units = plannedUnits.length;

  // Checked for the whole party up front, one room type at a time. It cannot be
  // left to the per-booking gate inside createReservation: a pending booking is
  // invisible to the availability engine, so beds two, three and four would
  // each be told the last bed was still free.
  const neededByType = new Map<string, { roomType: any; needed: number }>();
  for (const line of lines) {
    const entry = neededByType.get(line.roomType.id);
    if (entry) entry.needed += line.qty;
    else neededByType.set(line.roomType.id, { roomType: line.roomType, needed: line.qty });
  }
  for (const { roomType: rt, needed } of neededByType.values()) {
    const avail = checkAvailability(propertyId, rt.id, arrival, departure, needed);
    if (!avail.ok) {
      // The tightest night decides the party, so the guest is told how many
      // beds they can actually have rather than a flat "sold out" for a stay
      // that is only short on one date.
      const worst = avail.shortfall.reduce((least, s) => Math.min(least, s.available), needed);
      throw new HttpError(409,
        needed > 1
          ? `Only ${Math.max(0, worst)} of ${needed} ${rt.kind === 'dorm' ? 'beds' : 'rooms'}`
            + ` in ${rt.name} are available for these dates`
          : `${rt.name} is not available for the whole stay`,
        'sold_out', { shortfall: avail.shortfall, unitsNeeded: needed, roomType: rt.name });
    }
  }

  const guestName = str(contact.name, 'contact.name', { max: 120 });
  const email = str(contact.email, 'contact.email', { max: 200 });
  const phone = typeof contact.phone === 'string' && contact.phone.trim()
    ? contact.phone.trim() : undefined;
  /**
   * An airport transfer as the desk needs to read it: the flight, the day and
   * the time, in one tag.
   *
   * The site asks for all three and used to send them nowhere — the booking
   * arrived saying only that a pickup was wanted, so whoever was driving had to
   * ring the guest to find out when. Empty parts are kept in place so the tag
   * always has the same shape, and a transfer asked for without a flight still
   * says it was asked for.
   */
  const flightTag = (key: string, wanted: unknown, flight: any): string | null => {
    if (wanted !== true) return null;
    const part = (v: unknown, max: number) =>
      (typeof v === 'string' ? v.trim().slice(0, max).replace(/[|]/g, ' ') : '');
    return `${key}:${part(flight?.number, 12)}|${part(flight?.date, 10)}|${part(flight?.time, 5)}`;
  };

  /**
   * One traveller's surf choice, as `package/level/name`.
   *
   * The name is carried because the lessons are booked for people: a surf
   * school is told who is in the beginner group, and "person 2" is not
   * something the desk can pass on. It is optional — the site does not force a
   * name — and the separators are stripped out of it so one traveller can never
   * spill into the next.
   *
   * Read leniently on purpose. This is a note for the desk, not a price or a
   * room, so a package the site adds later must not be able to bounce the whole
   * booking with a 400 — an unrecognised word is written down as it came and
   * the reservation stands. Anything that is not a plain word is dropped.
   */
  const surfChoice = (t: any): string => {
    const word = (v: unknown, fallback: string) => {
      const w = typeof v === 'string' ? v.trim().toLowerCase() : '';
      return /^[a-z][a-z-]{0,19}$/.test(w) ? w : fallback;
    };
    const name = typeof t?.name === 'string'
      ? t.name.replace(/[,/|]/g, ' ').trim().slice(0, 40) : '';
    return `${word(t?.package, 'moderate')}/${word(t?.level, 'beginner')}/${name}`;
  };

  const preferences = [
    `model:${model}`,
    flightTag('airportPickup', b?.addons?.airportPickup, b?.addons?.pickupFlight),
    flightTag('airportDrop', b?.addons?.airportDrop, b?.addons?.dropFlight),
    model.includes('coworking') && b?.coworking
      ? `coworking:${int(b.coworking.seats ?? 0, 'coworking.seats', { min: 0, max: 100 })}x${oneOf(b.coworking.seatType ?? 'normal', 'coworking.seatType', ['normal', 'office'] as const)}`
      : null,
    // The package and level each traveller chose, in the order the site listed
    // them. The desk books the lessons off this, so "two surfers" is not enough
    // — which of them is a beginner decides which group they go out with.
    model.includes('surf') && Array.isArray(b?.surf?.travellers) && b.surf.travellers.length
      ? `surf:${b.surf.travellers.slice(0, 16).map(surfChoice).join(',')}`
      : null,
    // The day the lessons start. The stay says when the guest is here; the surf
    // school has to be told which morning to expect them.
    model.includes('surf') && typeof b?.surf?.date === 'string' && b.surf.date
      ? `surfDate:${assertDate(b.surf.date, 'surf.date')}` : null,
    model.includes('surf') && Array.isArray(b?.surf?.guests) && b.surf.guests.length
      ? `surfGuests:${b.surf.guests.length}` : null,
    units > 1 ? `party:${units}` : null,
  ].filter((x): x is string => !!x);

  const bookingActor = { userId: '', userName: 'booking-engine', propertyId };

  // One transaction for the whole party. A dorm booking that wrote two of its
  // four beds and then failed would leave the guest holding a booking for half
  // a group they cannot complete.
  return tx(() => {
    const created: any[] = [];
    plannedUnits.forEach((unit, i) => {
      created.push(createReservation(propertyId, bookingActor, {
        guestName,
        email,
        phone,
        arrival,
        departure,
        // The heads in this room or bed, not the whole party.
        adults: unit.adults,
        children: 0,
        roomTypeId: unit.roomType.id,
        ratePlanId,
        status: 'Tentative',
        source: 'Booking Engine',
        specialRequests: notes,
        preferences,
        origin: 'booking_engine',
        parentId: i === 0 ? null : created[0].id,
      }));
    });

    const lead = created[0];

    /*
     * What the guest owes before arrival, recorded against the booking.
     *
     * Written on the lead reservation only. A party across three beds is one
     * booking to the guest and one deposit to the property; putting a share of
     * it on each member would make the arrivals list show three small amounts
     * owed by one person, which is not how anybody chases a payment.
     *
     * Nothing is charged here — there is no payment gateway in this system.
     * This is the amount, on the record, so the desk can ask for it and the
     * folio can show it as outstanding.
     */
    const policy = depositPolicy(propertyId);
    if (policy.mode !== 'none') {
      const partyTotal = created.reduce((sum, r) => sum + (r.totalMinor ?? 0), 0);
      // The first night of the whole party, not of one bed, so a "first night"
      // deposit on four beds asks for four beds' worth of one night.
      const nightsCount = Math.max(1, created[0]?.nights ?? 1);
      const firstNight = Math.round(partyTotal / nightsCount);
      const quote = quoteDeposit(policy, partyTotal, firstNight);
      if (quote.dueNowMinor > 0) {
        run('UPDATE reservations SET deposit_required_minor = ? WHERE id = ?',
          quote.dueNowMinor, lead.id);
      }
    }
    // One entry per room type, so the confirmation screen can say what was
    // actually booked — a double and a bed in the mixed dorm — rather than a
    // single number that describes neither.
    const byRoomType = new Map<string, { confirmation: string; units: number; roomType: string }>();
    plannedUnits.forEach((unit, i) => {
      const entry = byRoomType.get(unit.roomType.id);
      if (entry) entry.units += 1;
      else {
        byRoomType.set(unit.roomType.id, {
          confirmation: created[i].confirmation,
          units: 1,
          roomType: unit.roomType.name,
        });
      }
    });

    return {
      ...lead,
      /** How many rooms and beds this booking took, so the site can say so. */
      units,
      partyIds: created.map((r) => r.id),
      bookings: byRoomType.size > 1 ? [...byRoomType.values()] : undefined,
      /**
       * Deliberately not "confirmed". The site must not tell a guest their bed
       * is held when the property has not yet accepted it.
       */
      awaitingConfirmation: true,
    };
  });
}, { perm: null, allowNoProperty: true });

// ─── Confirming a website booking ────────────────────────────
//
// The step between "the site took a booking" and "the property is housing
// this guest". It is not a check-in: it accepts the booking, picks the room or
// the beds, and takes the inventory. Check-in stays where it was and only
// becomes reachable once this has happened.

/**
 * The party behind one pending booking, and what is free to give it.
 *
 * Returned together because the dialog needs both to be true at the same
 * instant: four beds to fill and the list of beds still going.
 */
router.get('/api/reservations/:id/confirmation', (ctx: Ctx) => {
  const members = bookingGroup(pid(ctx), ctx.params.id);
  if (!members.length) notFound('Reservation');
  const lead = members[0];
  const pendingMembers = members.filter((m) => isPending(m));
  const roomType = get<any>('SELECT * FROM room_types WHERE id = ?', lead.room_type_id);
  const isDorm = roomType?.kind === 'dorm';

  const free = freeRooms(pid(ctx), lead.room_type_id, lead.arrival, lead.departure);
  const beds = isDorm ? freeBeds(pid(ctx), lead.room_type_id, lead.arrival, lead.departure) : [];

  /**
   * What is free for one member of the party, in **its own** room type.
   *
   * A booking is no longer one room type repeated: the website lets a party
   * take a double and a dorm bed, and each of those is written as its own
   * reservation in the group. Offering the lead's room type to all of them
   * meant a bunk bed in a female dorm was confirmed by picking a deluxe double.
   *
   * Looked up per room type and cached, so a party of six beds asks once.
   */
  const byRoomType = new Map<string, {
    roomTypeId: string; roomType: string; roomTypeKind: 'dorm' | 'room';
    rooms: any[]; beds: any[];
  }>();
  const unitsFor = (member: any) => {
    const key = `${member.room_type_id}|${member.arrival}|${member.departure}`;
    const cached = byRoomType.get(key);
    if (cached) return cached;
    const rt = get<any>('SELECT * FROM room_types WHERE id = ?', member.room_type_id);
    const dorm = rt?.kind === 'dorm';
    const entry = {
      roomTypeId: member.room_type_id,
      roomType: rt?.name ?? '',
      roomTypeKind: (dorm ? 'dorm' : 'room') as 'dorm' | 'room',
      rooms: dorm
        ? []
        : freeRooms(pid(ctx), member.room_type_id, member.arrival, member.departure)
          .map((r: any) => ({ id: r.id, number: r.number, floor: r.floor, status: r.status })),
      beds: dorm
        ? freeBeds(pid(ctx), member.room_type_id, member.arrival, member.departure)
          .map((bd: any) => ({
            id: bd.id, code: bd.code, roomId: bd.room_id, room: bd.room_number, bunk: bd.bunk,
          }))
        : [],
    };
    byRoomType.set(key, entry);
    return entry;
  };

  return {
    reservationId: lead.id,
    confirmation: lead.confirmation,
    guest: lead.guest_name,
    arrival: lead.arrival,
    departure: lead.departure,
    nights: lead.nights,
    roomTypeId: lead.room_type_id,
    roomType: roomType?.name ?? '',
    roomTypeKind: isDorm ? 'dorm' : 'room',
    source: lead.source,
    awaitingConfirmation: pendingMembers.length > 0,
    /** One entry per bed for a dorm party; one entry for a room. */
    members: members.map((m) => {
      const units = unitsFor(m);
      return {
        id: m.id,
        confirmation: m.confirmation,
        guest: m.guest_name,
        status: m.status,
        awaitingConfirmation: isPending(m),
        roomId: m.room_id,
        bedId: m.bed_id,
        room: m.room_number ?? null,
        bed: m.bed_code ?? null,
        totalMinor: m.total_minor,
        // This member's own room type, and what is free in it. The lists above
        // are the lead's and are kept for anything still reading them.
        roomTypeId: units.roomTypeId,
        roomType: units.roomType,
        roomTypeKind: units.roomTypeKind,
        rooms: units.rooms,
        beds: units.beds,
      };
    }),
    unitsNeeded: pendingMembers.length,
    rooms: free.map((r: any) => ({
      id: r.id, number: r.number, floor: r.floor, status: r.status,
    })),
    beds: beds.map((bd: any) => ({
      id: bd.id, code: bd.code, roomId: bd.room_id, room: bd.room_number, bunk: bd.bunk,
    })),
  };
}, { perm: 'reservations.read' });

/**
 * Accept the booking and commit the beds.
 *
 * `assignments` names a room or bed per member; `auto` lets the PMS pick what
 * is free. Confirming is what closes the dates — until now the booking held
 * nothing, so this is also the first point the OTAs are told anything.
 */
router.post('/api/reservations/:id/confirm', (ctx: Ctx) => {
  const raw: any[] = Array.isArray(ctx.body?.assignments) ? ctx.body.assignments : [];
  const assignments: ConfirmAssignment[] = raw.map((a, i) => ({
    reservationId: str(a?.reservationId, `assignments[${i}].reservationId`),
    roomId: a?.roomId ? str(a.roomId, `assignments[${i}].roomId`) : null,
    bedId: a?.bedId ? str(a.bedId, `assignments[${i}].bedId`) : null,
  }));
  return confirmBooking(pid(ctx), actor(ctx), ctx.params.id, {
    assignments,
    auto: boolIn(ctx.body?.auto),
  });
}, { perm: 'reservations.write' });

router.patch('/api/reservations/:id', (ctx: Ctx) => {
  const b = ctx.body;
  return updateReservation(pid(ctx), actor(ctx), ctx.params.id, {
    guestName: b.guestName, email: b.email, phone: b.phone,
    arrival: b.arrival, departure: b.departure,
    adults: b.adults, children: b.children,
    roomTypeId: b.roomTypeId, ratePlanId: b.ratePlanId,
    status: b.status, segment: b.segment, source: b.source,
    vip: b.vip, eta: b.eta, etd: b.etd,
    specialRequests: b.specialRequests, preferences: b.preferences,
    paymentMethod: b.paymentMethod, companyId: b.companyId,
    rateOverrideMinor: b.rateOverrideMinor === undefined || b.rateOverrideMinor === null
      ? undefined : money(b.rateOverrideMinor, 'rateOverrideMinor'),
    overrideReason: b.overrideReason,
    depositRequiredMinor: b.depositRequiredMinor,
    // What Hostelworld collected, corrected by hand; null clears it.
    otaCollectedMinor: b.otaCollectedMinor === undefined ? undefined
      : b.otaCollectedMinor === null ? null : money(b.otaCollectedMinor, 'otaCollectedMinor'),
    force: boolIn(b.force),
  });
}, { perm: 'reservations.write' });

router.post('/api/reservations/:id/cancel', (ctx: Ctx) =>
  cancelReservation(pid(ctx), actor(ctx), ctx.params.id, {
    reason: str(ctx.body.reason, 'reason', { max: 200 }),
    chargeMinor: ctx.body.chargeMinor === undefined ? 0 : money(ctx.body.chargeMinor, 'chargeMinor'),
  }), { perm: 'reservations.write' });

router.post('/api/reservations/:id/no-show', (ctx: Ctx) =>
  markNoShow(pid(ctx), actor(ctx), ctx.params.id, {
    chargeMinor: ctx.body.chargeMinor === undefined ? undefined : money(ctx.body.chargeMinor, 'chargeMinor'),
  }), { perm: 'frontdesk.write' });

// ─── Telling the channel what happened ───────────────────────
// Marking a no-show is the property's side. Until the channel is told, the OTA
// still believes the guest arrived — so these sit next to it rather than in the
// channel manager, which is not where the decision is made.

const reportKind = (v: unknown): ReportKind =>
  oneOf(v ?? 'no_show', 'kind', REPORT_KINDS as unknown as readonly string[]) as ReportKind;

router.get('/api/reservations/:id/channel-report', (ctx: Ctx) =>
  reportState(pid(ctx), ctx.params.id, businessDate(ctx)), { perm: 'reservations.read' });

router.get('/api/reservations/:id/channel-report/eligibility', (ctx: Ctx) =>
  reportEligibility(pid(ctx), ctx.params.id,
    reportKind(ctx.query.get('kind')), businessDate(ctx)), { perm: 'reservations.read' });

/** Retryable by design — calling it again after a failure is the retry. */
router.post('/api/reservations/:id/channel-report', async (ctx: Ctx) =>
  reportToChannel(pid(ctx), actor(ctx), ctx.params.id,
    reportKind(ctx.body.kind), businessDate(ctx)), { perm: 'frontdesk.write' });

/** The work list: no-shows the channel has not been told about. */
router.get('/api/channel-reports/pending', (ctx: Ctx) =>
  unreportedNoShows(pid(ctx), businessDate(ctx)), { perm: 'reservations.read' });

router.post('/api/reservations/:id/notes', (ctx: Ctx) =>
  addNote(pid(ctx), actor(ctx), ctx.params.id,
    str(ctx.body.body, 'body', { max: 2000 }), ctx.body.category ?? 'general'),
{ perm: 'reservations.write' });

// ─── Rooms ───────────────────────────────────────────────────
router.post('/api/reservations/:id/assign-room', (ctx: Ctx) =>
  assignRoom(pid(ctx), actor(ctx), ctx.params.id, {
    roomId: ctx.body.roomId ?? null,
    bedId: ctx.body.bedId ?? null,
    fromDate: ctx.body.fromDate,
    auto: boolIn(ctx.body.auto),
  }), { perm: 'frontdesk.write' });

router.post('/api/reservations/:id/move-room', (ctx: Ctx) =>
  moveRoom(pid(ctx), actor(ctx), ctx.params.id, {
    roomId: str(ctx.body.roomId, 'roomId'),
    fromDate: ctx.body.fromDate,
    reason: ctx.body.reason,
    keepRate: boolIn(ctx.body.keepRate, true),
  }), { perm: 'frontdesk.write' });

// ─── Extending and shortening a stay ─────────────────────────
// The preview is a GET so it can be called freely as the operator types a date
// — it writes nothing and holds nothing.
router.get('/api/reservations/:id/stay-preview', (ctx: Ctx) =>
  previewStayChange(pid(ctx), ctx.params.id, {
    arrival: ctx.query.get('arrival') ?? undefined,
    departure: ctx.query.get('departure') ?? undefined,
  }), { perm: 'reservations.read' });

router.post('/api/reservations/:id/stay-dates', (ctx: Ctx) =>
  changeStayDates(pid(ctx), actor(ctx), ctx.params.id, {
    arrival: ctx.body.arrival,
    departure: ctx.body.departure,
    roomId: ctx.body.roomId ?? undefined,
    releaseRoom: ctx.body.releaseRoom === true,
    reason: ctx.body.reason ? str(ctx.body.reason, 'reason', { max: 200 }) : undefined,
  }), { perm: 'reservations.write' });

/** A rate off the wire: positive, finite, and not out by a factor of a million. */
const fxRate = (v: unknown, field: string): number | null => {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) {
    throw new HttpError(400, `${field} must be a positive exchange rate`);
  }
  return n;
};

// ─── Front desk transitions ──────────────────────────────────
router.post('/api/reservations/:id/check-in', (ctx: Ctx) =>
  checkIn(pid(ctx), actor(ctx), ctx.params.id, {
    roomId: ctx.body.roomId,
    bedId: ctx.body.bedId,
    paymentMinor: ctx.body.paymentMinor === undefined ? undefined : money(ctx.body.paymentMinor, 'paymentMinor'),
    paymentMethod: ctx.body.paymentMethod,
    tenderedMinor: ctx.body.tenderedMinor === undefined || ctx.body.tenderedMinor === null
      ? null : money(ctx.body.tenderedMinor, 'tenderedMinor'),
    tenderCurrency: ctx.body.tenderCurrency ?? null,
    tenderRate: fxRate(ctx.body.tenderRate, 'tenderRate'),
    keptMinor: ctx.body.keptMinor === undefined || ctx.body.keptMinor === null
      ? null : money(ctx.body.keptMinor, 'keptMinor'),
    changeCurrency: ctx.body.changeCurrency ?? null,
    changeRate: fxRate(ctx.body.changeRate, 'changeRate'),
    idNumber: ctx.body.idNumber,
    idType: ctx.body.idType,
    registered: boolIn(ctx.body.registered, true),
  }), { perm: 'frontdesk.write' });

router.post('/api/reservations/:id/check-out', (ctx: Ctx) =>
  checkOut(pid(ctx), actor(ctx), ctx.params.id, {
    allowBalance: boolIn(ctx.body.allowBalance),
    toCityLedger: boolIn(ctx.body.toCityLedger),
  }), { perm: 'frontdesk.write' });

router.post('/api/reservations/:id/post-due-nights', (ctx: Ctx) => {
  const posted = postOutstandingNights(pid(ctx), actor(ctx), ctx.params.id, businessDate(ctx));
  return { posted };
}, { perm: 'folio.post' });

router.post('/api/walk-in', (ctx: Ctx) =>
  createWalkIn(pid(ctx), actor(ctx), readCreateInput(ctx)), { perm: 'frontdesk.write' });

// ─── The day's lists ─────────────────────────────────────────
router.get('/api/front-desk', (ctx: Ctx) =>
  frontDeskLists(pid(ctx), ctx.query.get('date') ?? businessDate(ctx)),
{ perm: 'frontdesk.read' });

// ─── Guests on a reservation (sharers, registration) ─────────
router.post('/api/reservations/:id/guests', (ctx: Ctx) => {
  const name = str(ctx.body.name, 'name', { max: 120 });
  const gId = id('rg');
  const profileId = ctx.body.createProfile
    ? findOrCreateProfile(pid(ctx), actor(ctx), { name, email: ctx.body.email })
    : ctx.body.profileId ?? null;
  run(
    `INSERT INTO reservation_guests(id, reservation_id, profile_id, name, is_primary, kind,
                                    registered, id_number, created_at)
     VALUES(?,?,?,?,0,?,?,?,?)`,
    gId, ctx.params.id, profileId, name,
    oneOf(ctx.body.kind, 'kind', ['adult', 'child'] as const, 'adult'),
    boolIn(ctx.body.registered) ? 1 : 0, ctx.body.idNumber ?? null, nowIso(),
  );
  return { id: gId };
}, { perm: 'reservations.write' });

// ─── Guest self-registration (the QR at the desk) ────────────
//
// Four staff endpoints and two public ones. The public pair are the only
// unauthenticated way into a single reservation in the whole API, which is why
// they live behind a hashed 256-bit token and hand back almost nothing — see
// services/guestregistration.ts.

router.post('/api/reservations/:id/registration-link', (ctx: Ctx) =>
  createRegistrationLink(pid(ctx), actor(ctx), ctx.params.id), { perm: 'frontdesk.write' });

router.get('/api/reservations/:id/registration-link', (ctx: Ctx) =>
  linkStatus(pid(ctx), ctx.params.id), { perm: 'frontdesk.read' });

router.delete('/api/reservations/:id/registration-link', (ctx: Ctx) =>
  revokeRegistrationLink(pid(ctx), actor(ctx), ctx.params.id), { perm: 'frontdesk.write' });

router.post('/api/reservations/:id/registration-link/accept', (ctx: Ctx) =>
  acceptRegistration(pid(ctx), actor(ctx), ctx.params.id), { perm: 'frontdesk.write' });

router.post('/api/reservations/:id/registration-link/discard', (ctx: Ctx) =>
  discardRegistration(pid(ctx), actor(ctx), ctx.params.id), { perm: 'frontdesk.write' });

/** What the guest's phone shows when the code is scanned. */
router.get('/api/public/registration/:token', (ctx: Ctx) =>
  registrationContext(str(ctx.params.token, 'token', { max: 200 })),
{ perm: null, allowNoProperty: true });

/**
 * What the guest sends back.
 *
 * Every field is optional: a guest who fills in half the form and hands the
 * phone back has still helped, and the desk sees exactly what arrived.
 */
router.post('/api/public/registration/:token', (ctx: Ctx) => {
  const b = ctx.body ?? {};
  const text = (v: unknown, name: string, max = 200) =>
    (typeof v === 'string' && v.trim() ? str(v, name, { max }) : null);
  const image = (v: any, name: string) => {
    if (!v || typeof v !== 'object' || typeof v.data !== 'string' || !v.data) return null;
    // Accepts a bare base64 payload or a full data URL, because a browser
    // produces the latter and stripping it there is one more thing to get wrong.
    const raw = v.data as string;
    const comma = raw.indexOf(',');
    return {
      mime: str(v.mime ?? 'image/jpeg', `${name}.mime`, { max: 60 }),
      dataBase64: raw.startsWith('data:') && comma > 0 ? raw.slice(comma + 1) : raw,
    };
  };
  const addr = b.address && typeof b.address === 'object' ? b.address : null;

  return submitRegistration(str(ctx.params.token, 'token', { max: 200 }), {
    firstName: text(b.firstName, 'firstName', 120),
    lastName: text(b.lastName, 'lastName', 120),
    email: text(b.email, 'email'),
    phone: text(b.phone, 'phone', 40),
    nationality: text(b.nationality, 'nationality', 80),
    dob: text(b.dob, 'dob', 10),
    idType: text(b.idType, 'idType', 40),
    idNumber: text(b.idNumber, 'idNumber', 60),
    idExpiry: text(b.idExpiry, 'idExpiry', 10),
    address: addr ? {
      line1: text(addr.line1, 'address.line1'),
      line2: text(addr.line2, 'address.line2'),
      city: text(addr.city, 'address.city', 80),
      postcode: text(addr.postcode, 'address.postcode', 20),
      country: text(addr.country, 'address.country', 80),
    } : null,
    idPhoto: image(b.idPhoto, 'idPhoto'),
    signature: image(b.signature, 'signature'),
    // Left undefined when the caller did not mention it, so a later partial
    // submission merges rather than overwrites. Coercing an absent key to
    // `false` would quietly withdraw a consent the guest had already given.
    marketingConsent: typeof b.marketingConsent === 'boolean' ? b.marketingConsent : undefined,
  });
}, { perm: null, allowNoProperty: true });

// ─── Registration documents ──────────────────────────────────
//
// The identity scan and the signature taken at check-in. Listing returns
// metadata only; fetching the image is a separate call so that reading a
// guest's passport is a deliberate act with its own audit entry rather than a
// side effect of opening a screen.
router.get('/api/reservations/:id/documents', (ctx: Ctx) =>
  listDocuments(pid(ctx), ctx.params.id), { perm: 'reservations.read' });

router.post('/api/reservations/:id/documents', (ctx: Ctx) => {
  const b = ctx.body;
  // Accepts either a bare base64 payload or a full data URL, because the
  // browser produces the latter and stripping it there is one more thing to
  // get wrong.
  const raw = str(b.data, 'data');
  const comma = raw.indexOf(',');
  const dataBase64 = raw.startsWith('data:') && comma > 0 ? raw.slice(comma + 1) : raw;
  return storeDocument(pid(ctx), actor(ctx), ctx.params.id, {
    kind: oneOf(b.kind, 'kind', ['identity', 'signature'] as const) as DocumentKind,
    mime: str(b.mime, 'mime', { max: 60 }),
    dataBase64,
    label: b.label ? str(b.label, 'label', { max: 60 }) : undefined,
    guestName: b.guestName ? str(b.guestName, 'guestName', { max: 120 }) : undefined,
  });
}, { perm: 'reservations.write' });

router.get('/api/documents/:documentId', (ctx: Ctx) =>
  readDocument(pid(ctx), actor(ctx), ctx.params.documentId), { perm: 'reservations.read' });

router.delete('/api/documents/:documentId', (ctx: Ctx) => {
  deleteDocument(pid(ctx), actor(ctx), ctx.params.documentId);
}, { perm: 'reservations.write' });

router.delete('/api/reservations/:id/guests/:guestId', (ctx: Ctx) => {
  run('DELETE FROM reservation_guests WHERE id = ? AND reservation_id = ? AND is_primary = 0',
    ctx.params.guestId, ctx.params.id);
  return { ok: true };
}, { perm: 'reservations.write' });

// ─── Groups & blocks ─────────────────────────────────────────
router.get('/api/groups', (ctx: Ctx) => all<any>(
  `SELECT g.*, c.name AS company_name, rp.code AS rate_plan_code
     FROM groups g LEFT JOIN companies c ON c.id = g.company_id
     LEFT JOIN rate_plans rp ON rp.id = g.rate_plan_id
    WHERE g.property_id = ? ORDER BY g.arrival DESC`,
  pid(ctx),
).map((g) => {
  const blocked = scalar<number>(
    'SELECT COALESCE(SUM(blocked),0) AS n FROM group_blocks WHERE group_id = ?', g.id);
  const pickedUp = scalar<number>(
    `SELECT count(*) AS n FROM reservation_nights n JOIN reservations r ON r.id = n.reservation_id
      WHERE r.group_id = ? AND r.status IN ('Tentative','Confirmed','Guaranteed','Checked-in','Checked-out')`,
    g.id);
  const rooms = scalar<number>(
    `SELECT count(*) AS n FROM reservations WHERE group_id = ? AND status <> 'Cancelled'`, g.id);
  return {
    id: g.id, code: g.code, name: g.name, companyId: g.company_id, company: g.company_name,
    contactName: g.contact_name, contactEmail: g.contact_email, contactPhone: g.contact_phone,
    arrival: g.arrival, departure: g.departure, cutoffDate: g.cutoff_date,
    ratePlanId: g.rate_plan_id, ratePlanCode: g.rate_plan_code, status: g.status,
    masterFolio: g.master_folio === 1, notes: g.notes,
    blockedNights: blocked, pickedUpNights: pickedUp, reservations: rooms,
    pickupBp: blocked > 0 ? Math.round((pickedUp / blocked) * 10_000) : 0,
  };
}), { perm: 'groups.read' });

router.post('/api/groups', (ctx: Ctx) => tx(() => {
  const b = ctx.body;
  const gId = id('grp');
  const arrival = assertDate(b.arrival, 'arrival');
  const departure = assertDate(b.departure, 'departure');
  run(
    `INSERT INTO groups(id, property_id, code, name, company_id, contact_name, contact_email,
                        contact_phone, arrival, departure, cutoff_date, rate_plan_id, status,
                        master_folio, notes, created_by, created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    gId, pid(ctx), slugCode(b.code, 'code', 20), str(b.name, 'name', { max: 120 }),
    b.companyId ?? null, b.contactName ?? null, b.contactEmail ?? null, b.contactPhone ?? null,
    arrival, departure, b.cutoffDate ?? null, b.ratePlanId ?? null,
    oneOf(b.status, 'status', ['tentative', 'definite', 'cancelled', 'closed'] as const, 'tentative'),
    boolIn(b.masterFolio, true) ? 1 : 0, b.notes ?? null, ctx.auth.userName, nowIso(),
  );
  // Optional initial block: [{ roomTypeId, rooms, rateMinor }]
  for (const blk of b.blocks ?? []) {
    for (const date of dateRangeInclusive(arrival, addDays(departure, -1))) {
      run(
        `INSERT INTO group_blocks(id, group_id, room_type_id, date, blocked, rate_minor)
         VALUES(?,?,?,?,?,?)
         ON CONFLICT(group_id, room_type_id, date) DO UPDATE SET
           blocked = excluded.blocked, rate_minor = excluded.rate_minor`,
        id('gbl'), gId, blk.roomTypeId, date,
        int(blk.rooms, 'rooms', { min: 0, max: 500 }),
        money(blk.rateMinor ?? 0, 'rateMinor'),
      );
    }
  }
  if (boolIn(b.masterFolio, true)) {
    openFolio(pid(ctx), { groupId: gId, companyId: b.companyId ?? null, name: `${b.name} — master`, type: 'master' });
  }
  audit(ctx.auth, {
    action: 'group.create', entity: 'GROUP', entityId: gId, entityRef: b.code, after: b,
  }, ctx.ip);
  return { id: gId };
}), { perm: 'groups.write' });

router.get('/api/groups/:id', (ctx: Ctx) => {
  const g = get<any>('SELECT * FROM groups WHERE id = ? AND property_id = ?', ctx.params.id, pid(ctx));
  if (!g) notFound('Group');
  const blocks = all<any>(
    `SELECT gb.*, rt.name AS room_type_name, rt.code AS room_type_code
       FROM group_blocks gb JOIN room_types rt ON rt.id = gb.room_type_id
      WHERE gb.group_id = ? ORDER BY gb.date, rt.name`,
    ctx.params.id,
  );
  const pickup = all<any>(
    `SELECT n.room_type_id, n.date, count(*) AS picked
       FROM reservation_nights n JOIN reservations r ON r.id = n.reservation_id
      WHERE r.group_id = ? AND r.status <> 'Cancelled'
      GROUP BY n.room_type_id, n.date`,
    ctx.params.id,
  );
  const pickMap = new Map(pickup.map((p) => [`${p.room_type_id}|${p.date}`, p.picked]));
  return {
    id: g.id, code: g.code, name: g.name, arrival: g.arrival, departure: g.departure,
    cutoffDate: g.cutoff_date, status: g.status, notes: g.notes,
    blocks: blocks.map((b) => ({
      id: b.id, roomTypeId: b.room_type_id, roomType: b.room_type_name,
      roomTypeCode: b.room_type_code, date: b.date, blocked: b.blocked,
      rateMinor: b.rate_minor, pickedUp: pickMap.get(`${b.room_type_id}|${b.date}`) ?? 0,
    })),
    reservations: listReservations(pid(ctx), { groupId: ctx.params.id }),
    folios: all<any>('SELECT * FROM folios WHERE group_id = ?', ctx.params.id).map((f) => ({
      id: f.id, number: f.number, name: f.name, type: f.type, status: f.status,
    })),
  };
}, { perm: 'groups.read' });

router.post('/api/groups/:id/blocks', (ctx: Ctx) => tx(() => {
  const b = ctx.body;
  const from = assertDate(b.from, 'from');
  const to = assertDate(b.to, 'to');
  let n = 0;
  for (const date of dateRangeInclusive(from, to)) {
    run(
      `INSERT INTO group_blocks(id, group_id, room_type_id, date, blocked, rate_minor)
       VALUES(?,?,?,?,?,?)
       ON CONFLICT(group_id, room_type_id, date) DO UPDATE SET
         blocked = excluded.blocked, rate_minor = excluded.rate_minor`,
      id('gbl'), ctx.params.id, str(b.roomTypeId, 'roomTypeId'), date,
      int(b.rooms, 'rooms', { min: 0, max: 500 }), money(b.rateMinor ?? 0, 'rateMinor'),
    );
    n++;
  }
  audit(ctx.auth, { action: 'group.block', entity: 'GROUP', entityId: ctx.params.id, after: b }, ctx.ip);
  return { updated: n };
}), { perm: 'groups.write' });

/** Rooming list upload — bulk-create the group's individual reservations. */
router.post('/api/groups/:id/rooming-list', (ctx: Ctx) => tx(() => {
  const group = get<any>('SELECT * FROM groups WHERE id = ? AND property_id = ?', ctx.params.id, pid(ctx));
  if (!group) notFound('Group');
  const rows: any[] = ctx.body.rows ?? [];
  if (!rows.length) throw new HttpError(400, 'rooming list is empty');
  const created: any[] = [];
  const failed: any[] = [];
  for (const row of rows) {
    try {
      const res = createReservation(pid(ctx), actor(ctx), {
        guestName: str(row.guestName, 'guestName', { max: 120 }),
        email: row.email, phone: row.phone,
        arrival: row.arrival ?? group.arrival,
        departure: row.departure ?? group.departure,
        adults: int(row.adults ?? 1, 'adults', { min: 1, max: 20 }),
        children: int(row.children ?? 0, 'children', { min: 0, max: 20 }),
        roomTypeId: str(row.roomTypeId, 'roomTypeId'),
        ratePlanId: row.ratePlanId ?? group.rate_plan_id,
        groupId: group.id,
        status: 'Confirmed',
        source: 'Group',
        segment: 'Group',
        rateOverrideMinor: row.rateMinor === undefined ? null : money(row.rateMinor, 'rateMinor'),
        // Rooms are already held by the group block.
        force: true,
      });
      created.push({ guest: row.guestName, id: res.id, confirmation: res.confirmation });
    } catch (e) {
      failed.push({ guest: row.guestName, error: e instanceof Error ? e.message : String(e) });
    }
  }
  audit(ctx.auth, {
    action: 'group.rooming-list', entity: 'GROUP', entityId: group.id, entityRef: group.code,
    after: { created: created.length, failed: failed.length },
  }, ctx.ip);
  return { created, failed };
}), { perm: 'groups.write' });

// ─── Waitlist ────────────────────────────────────────────────
router.get('/api/waitlist', (ctx: Ctx) => all<any>(
  `SELECT w.*, rt.name AS room_type_name FROM waitlist w
     LEFT JOIN room_types rt ON rt.id = w.room_type_id
    WHERE w.property_id = ? AND w.status = ? ORDER BY w.arrival`,
  pid(ctx), ctx.query.get('status') ?? 'waiting',
).map((w) => ({
  id: w.id, guest: w.guest_name, email: w.email, phone: w.phone,
  arrival: w.arrival, departure: w.departure, roomTypeId: w.room_type_id,
  roomType: w.room_type_name, adults: w.adults, children: w.children,
  status: w.status, note: w.note, createdAt: w.created_at,
})), { perm: 'reservations.read' });

router.post('/api/waitlist', (ctx: Ctx) => {
  const b = ctx.body;
  const wId = id('wl');
  run(
    `INSERT INTO waitlist(id, property_id, guest_name, email, phone, arrival, departure,
                          room_type_id, adults, children, status, note, created_by, created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,'waiting',?,?,?)`,
    wId, pid(ctx), str(b.guestName, 'guestName', { max: 120 }), b.email ?? null, b.phone ?? null,
    assertDate(b.arrival, 'arrival'), assertDate(b.departure, 'departure'),
    b.roomTypeId ?? null, int(b.adults ?? 1, 'adults', { min: 1 }),
    int(b.children ?? 0, 'children', { min: 0 }), b.note ?? null, ctx.auth.userName, nowIso(),
  );
  audit(ctx.auth, { action: 'waitlist.add', entity: 'WAITLIST', entityId: wId, entityRef: b.guestName }, ctx.ip);
  return { id: wId };
}, { perm: 'reservations.write' });

router.patch('/api/waitlist/:id', (ctx: Ctx) => {
  run(`UPDATE waitlist SET status = ?, note = COALESCE(?, note),
         resolved_at = CASE WHEN ? IN ('converted','expired') THEN ? ELSE resolved_at END
        WHERE id = ? AND property_id = ?`,
    str(ctx.body.status, 'status'), ctx.body.note ?? null,
    ctx.body.status, nowIso(), ctx.params.id, pid(ctx));
  return { ok: true };
}, { perm: 'reservations.write' });
