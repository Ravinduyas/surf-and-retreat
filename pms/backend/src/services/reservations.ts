// ─────────────────────────────────────────────────────────────
// Reservation lifecycle: quote → book → amend → assign → check in →
// check out, plus cancellation, no-show and room moves.
//
// Every reservation owns one row per night (reservation_nights). That is the
// unit availability counts, pricing writes and the night audit posts, which
// is what makes multi-rate stays and mid-stay room moves correct instead of
// approximated.
// ─────────────────────────────────────────────────────────────
import { all, get, run, tx, jsonCol, parseJson, nextSequence, scalar } from '../db.ts';
import {
  id, nowIso, HttpError, dateRange, nightsBetween, addDays, conflict, notFound,
} from '../lib/util.ts';
import { checkAvailability, isRoomFree, freeRooms, freeBeds } from './availability.ts';
import { validateStay } from './restrictions.ts';
import { quoteStay } from './pricing.ts';
import { ensureFolio, foliosForReservation, postCharge } from './folio.ts';
import { takePayment } from './payments.ts';
import { audit } from './audit.ts';
import { notify, reservationLink } from './notify.ts';
import { raise } from './alerts.ts';
import { nudgeQueue } from './channels.ts';
import { isPending, PENDING_ORIGIN, PENDING_STATUS } from './pendingbookings.ts';
import { holdWindowHours } from './holds.ts';
import {
  hostelworldMoney, hostelworldPolicy, splitTotal, syncCollectedCredit, type HostelworldDetail,
} from './hostelworld.ts';
import type { AuthContext } from '../auth.ts';

export type Actor = Pick<AuthContext, 'userId' | 'userName' | 'propertyId'>;

export const OPEN_STATUSES = ['Tentative', 'Confirmed', 'Guaranteed'] as const;

export interface ReservationRow {
  id: string; property_id: string; confirmation: string; status: string;
  profile_id: string | null; guest_name: string; email: string | null; phone: string | null;
  arrival: string; departure: string; nights: number; adults: number; children: number;
  room_type_id: string; room_id: string | null; bed_id: string | null; rate_plan_id: string;
  source: string; channel_code: string | null; ota_channel: string | null;
  ota_reference: string | null; segment: string | null;
  company_id: string | null; group_id: string | null; vip: number; eta: string | null; etd: string | null;
  special_requests: string | null; preferences: string | null; payment_method: string | null;
  deposit_required_minor: number; commission_minor: number; total_minor: number;
  /** The channel's own figures for an OTA booking — see `hostelworld.ts`. */
  ota_total_minor: number | null; ota_collected_minor: number | null;
  promotion_id: string | null; currency: string; origin: string;
  created_by: string | null; created_at: string; updated_at: string;
  checked_in_at: string | null; checked_out_at: string | null;
  cancelled_at: string | null; cancel_reason: string | null; no_show_at: string | null;
  parent_id: string | null; card_last4: string | null;
}

function property(propertyId: string) {
  const p = get<any>('SELECT * FROM properties WHERE id = ?', propertyId);
  if (!p) throw new HttpError(404, 'Property not found');
  return p;
}

export function nextConfirmation(propertyId: string): string {
  const p = property(propertyId);
  const seq = nextSequence(propertyId, 'confirmation', 1);
  return `${p.code}-${new Date().getUTCFullYear()}-${String(seq).padStart(5, '0')}`;
}

// ─── Guest profile linking ───────────────────────────────────
export function findOrCreateProfile(propertyId: string, actor: Actor, input: {
  profileId?: string | null; name: string; email?: string; phone?: string;
  nationality?: string; vip?: boolean;
}): string | null {
  if (input.profileId) {
    const p = get<any>('SELECT id FROM profiles WHERE id = ? AND property_id = ?', input.profileId, propertyId);
    if (p) return p.id;
  }
  if (input.email) {
    const byEmail = get<any>(
      'SELECT id FROM profiles WHERE property_id = ? AND lower(email) = lower(?) AND merged_into IS NULL',
      propertyId, input.email,
    );
    if (byEmail) return byEmail.id;
  }
  if (!input.name) return null;
  const pid = id('pro');
  const parts = input.name.trim().split(/\s+/);
  run(
    `INSERT INTO profiles(id, property_id, type, first_name, last_name, name, email, phone,
                          nationality, vip, created_at, updated_at)
     VALUES(?,?,'guest',?,?,?,?,?,?,?,?,?)`,
    pid, propertyId, parts[0] ?? null, parts.slice(1).join(' ') || null, input.name,
    input.email ?? null, input.phone ?? null, input.nationality ?? null,
    input.vip ? 1 : 0, nowIso(), nowIso(),
  );
  audit(actor, { action: 'profile.create', entity: 'PROFILE', entityId: pid, entityRef: input.name });
  return pid;
}

// ─── Create ──────────────────────────────────────────────────
export interface CreateReservationInput {
  guestName: string;
  email?: string;
  phone?: string;
  profileId?: string | null;
  arrival: string;
  departure: string;
  adults: number;
  children: number;
  roomTypeId: string;
  ratePlanId: string;
  roomId?: string | null;
  bedId?: string | null;
  status?: string;
  source?: string;
  channelCode?: string | null;
  /**
   * The OTA the booking actually came from, when `channelCode` is a hub.
   *
   * Beds24 sends "Hostelworld", "Booking.com", "Airbnb" and so on as `referer`.
   * Kept separate from `channelCode`, which names the connection that rate rules
   * and mappings are keyed on.
   */
  otaChannel?: string | null;
  otaReference?: string | null;
  segment?: string | null;
  companyId?: string | null;
  groupId?: string | null;
  vip?: boolean;
  eta?: string | null;
  etd?: string | null;
  specialRequests?: string | null;
  preferences?: string[];
  paymentMethod?: string | null;
  cardLast4?: string | null;
  promotionCode?: string | null;
  /** Manual per-night override, e.g. a negotiated rate. */
  rateOverrideMinor?: number | null;
  overrideReason?: string | null;
  depositRequiredMinor?: number | null;
  commissionMinor?: number | null;
  /**
   * The channel's own figures for an OTA booking.
   *
   * `otaTotalMinor` is what the OTA said the booking is worth, kept as a raw
   * fact. `otaCollectedMinor` is what the OTA took at booking time and keeps —
   * set only when the Hostelworld split is on and the booking is one of
   * theirs. `totalOverrideMinor`, when given, becomes the stay total: the
   * nights are re-spread so they add up to it exactly, because the guest
   * agreed to that number and the folio has to reach it.
   */
  otaTotalMinor?: number | null;
  otaCollectedMinor?: number | null;
  totalOverrideMinor?: number | null;
  /**
   * The channel's own per-night prices, one per night of the stay. Used
   * instead of an even spread when they add up to `totalOverrideMinor`
   * exactly — the guest saw those prices, and the folio should show them.
   */
  nightRatesMinor?: number[] | null;
  /** Hostelworld's full statement for the booking, kept beside the figures. */
  otaDetail?: HostelworldDetail | null;
  origin?: string;
  /**
   * The reservation this one was booked alongside.
   *
   * A dorm party is one bed per reservation — four guests sharing a booking are
   * four reservations, because a bed is what the PMS assigns, prices and cleans.
   * The first carries the party and the rest point at it, so the front desk can
   * confirm, move or cancel the group as one thing.
   */
  parentId?: string | null;
  /** Skip availability/restriction gates — requires elevated permission. */
  force?: boolean;
}

export function createReservation(propertyId: string, actor: Actor, input: CreateReservationInput) {
  return tx(() => {
    const prop = property(propertyId);
    const nights = nightsBetween(input.arrival, input.departure);
    if (nights < 1) throw new HttpError(400, 'Departure must be at least one night after arrival');
    if (nights > 365) throw new HttpError(400, 'A single reservation cannot exceed 365 nights');
    if (input.arrival < addDays(prop.business_date, -1)) {
      throw new HttpError(400, `Arrival ${input.arrival} is before the open business date ${prop.business_date}`);
    }

    const roomType = get<any>('SELECT * FROM room_types WHERE id = ? AND property_id = ? AND active = 1',
      input.roomTypeId, propertyId);
    if (!roomType) notFound('Room type');
    const ratePlan = get<any>('SELECT * FROM rate_plans WHERE id = ? AND property_id = ?',
      input.ratePlanId, propertyId);
    if (!ratePlan) notFound('Rate plan');

    const guests = input.adults + input.children;
    if (roomType.kind === 'room' && guests > roomType.max_occupancy) {
      throw new HttpError(400,
        `${roomType.name} holds a maximum of ${roomType.max_occupancy} guest(s)`, 'over_occupancy');
    }

    // Gate 1 — inventory.
    if (!input.force) {
      const avail = checkAvailability(propertyId, input.roomTypeId, input.arrival, input.departure, 1);
      if (!avail.ok) {
        conflict(`${roomType.name} is not available for the whole stay`, { shortfall: avail.shortfall });
      }
    }

    // Gate 2 — restrictions.
    const bookedOn = prop.business_date;
    if (!input.force) {
      const violations = validateStay(propertyId, {
        roomTypeId: input.roomTypeId, ratePlanId: input.ratePlanId,
        arrival: input.arrival, departure: input.departure,
        channelCode: input.channelCode ?? null, bookedOn,
      });
      if (violations.length) {
        conflict('This stay breaks a selling restriction', { violations });
      }
    }

    // Price it.
    const quote = quoteStay(propertyId, {
      roomTypeId: input.roomTypeId, ratePlanId: input.ratePlanId,
      arrival: input.arrival, departure: input.departure,
      adults: input.adults, children: input.children,
      channelCode: input.channelCode ?? null,
      promotionCode: input.promotionCode ?? null,
      bookedOn, currency: prop.currency,
    });

    const override = input.rateOverrideMinor ?? null;
    const totalOverride = input.totalOverrideMinor != null && input.totalOverrideMinor > 0
      ? Math.round(input.totalOverrideMinor) : null;
    const channelRates = totalOverride !== null && input.nightRatesMinor
      && input.nightRatesMinor.length === quote.nights.length
      && input.nightRatesMinor.every((r) => Number.isInteger(r) && r >= 0)
      && input.nightRatesMinor.reduce((s, r) => s + r, 0) === totalOverride
      ? input.nightRatesMinor : null;
    const nightRates = totalOverride !== null
      // The channel's own nightly prices when they add up to its total;
      // otherwise that total spread across the nights so they add up to it.
      ? (channelRates ?? splitTotal(totalOverride, quote.nights.length))
      : quote.nights.map((n) => (override !== null ? override : n.rateMinor));
    const total = nightRates.reduce((s, r) => s + r, 0);

    // Room / bed assignment, when requested up-front.
    let roomId = input.roomId ?? null;
    let bedId = input.bedId ?? null;
    // Whole-room exclusivity does not apply to dorms — those are held per bed.
    if (roomId && roomType.kind !== 'dorm'
        && !isRoomFree(propertyId, roomId, input.arrival, input.departure)) {
      conflict('That room is already occupied or blocked for part of the stay');
    }
    if (roomType.kind === 'dorm' && bedId) {
      const free = freeBeds(propertyId, input.roomTypeId, input.arrival, input.departure)
        .some((b: any) => b.id === bedId);
      if (!free) conflict('That bed is already taken for part of the stay');
      const bed = get<any>('SELECT room_id FROM beds WHERE id = ?', bedId);
      roomId = bed?.room_id ?? null;
    }

    const profileId = findOrCreateProfile(propertyId, actor, {
      profileId: input.profileId, name: input.guestName, email: input.email,
      phone: input.phone, vip: input.vip,
    });

    const resId = id('res');
    const confirmation = nextConfirmation(propertyId);
    const status = input.status ?? 'Confirmed';
    const pending = isPending({ status, origin: input.origin ?? 'pms' });

    /*
     * How long this booking's bed is held for.
     *
     * Only a booking awaiting confirmation has one. Everything else — a walk-in,
     * a phone booking, an OTA booking — holds its room until somebody changes
     * or cancels it, which is what a NULL here means.
     *
     * The window is the property's, set in Configuration → Booking page. It is
     * a commercial judgement rather than a technical one: a hostel that answers
     * its email twice a day wants longer than one with somebody on the desk.
     */
    const holdExpiresAt = pending
      ? new Date(Date.now() + holdWindowHours(propertyId) * 3_600_000).toISOString()
      : null;

    run(
      `INSERT INTO reservations(
         id, property_id, confirmation, status, profile_id, guest_name, email, phone,
         arrival, departure, nights, adults, children, room_type_id, room_id, bed_id, rate_plan_id,
         source, channel_code, ota_channel, ota_reference, segment, company_id, group_id, vip, eta, etd,
         special_requests, preferences, payment_method, card_last4, deposit_required_minor,
         commission_minor, total_minor, promotion_id, currency, origin, parent_id,
         hold_expires_at, ota_total_minor, ota_collected_minor, ota_detail, created_by, created_at, updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      resId, propertyId, confirmation, status, profileId, input.guestName,
      input.email ?? null, input.phone ?? null,
      input.arrival, input.departure, nights, input.adults, input.children,
      input.roomTypeId, roomId, bedId, input.ratePlanId,
      input.source ?? 'Direct', input.channelCode ?? null, input.otaChannel ?? null,
      input.otaReference ?? null,
      input.segment ?? null, input.companyId ?? null, input.groupId ?? null,
      input.vip ? 1 : 0, input.eta ?? null, input.etd ?? null,
      input.specialRequests ?? null, jsonCol(input.preferences ?? []),
      input.paymentMethod ?? null, input.cardLast4 ?? null,
      input.depositRequiredMinor ?? 0, input.commissionMinor ?? 0, total,
      quote.promotionId ?? null, prop.currency, input.origin ?? 'pms', input.parentId ?? null,
      holdExpiresAt, input.otaTotalMinor ?? null, input.otaCollectedMinor ?? null,
      input.otaDetail ? jsonCol(input.otaDetail) : null,
      actor.userName, nowIso(), nowIso(),
    );

    const dates = dateRange(input.arrival, input.departure);
    dates.forEach((date, i) => {
      run(
        `INSERT INTO reservation_nights(id, reservation_id, property_id, date, room_type_id, room_id,
                                        bed_id, rate_plan_id, rate_minor, adults, children, posted)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,0)`,
        id('rn'), resId, propertyId, date, input.roomTypeId, roomId, bedId,
        input.ratePlanId, nightRates[i], input.adults, input.children,
      );
    });

    run(
      `INSERT INTO reservation_guests(id, reservation_id, profile_id, name, is_primary, kind, created_at)
       VALUES(?,?,?,?,1,'adult',?)`,
      id('rg'), resId, profileId, input.guestName, nowIso(),
    );

    ensureFolio(propertyId, resId, input.guestName);

    if (quote.promotionId) {
      run('UPDATE promotions SET used_count = used_count + 1 WHERE id = ?', quote.promotionId);
    }

    audit(actor, {
      action: 'reservation.create', entity: 'RESERVATION', entityId: resId,
      entityRef: `${confirmation} · ${input.guestName}`,
      after: {
        arrival: input.arrival, departure: input.departure, roomType: roomType.code,
        ratePlan: ratePlan.code, totalMinor: total, status,
        override: override !== null ? { rateMinor: override, reason: input.overrideReason } : undefined,
      },
      elevated: override !== null || !!input.force,
    });

    /*
     * Tell the channels, including for a booking still awaiting confirmation.
     *
     * This used to skip pending bookings, on the reasoning that pushing would
     * shut dates on the OTAs for a booking a person may yet decline. The
     * reasoning was backwards: a pending booking now holds its bed, so the
     * property's availability *has* changed, and not saying so is precisely
     * how the same bed gets sold twice — once on the website and once on
     * Booking.com, minutes apart, with nothing on any screen to show for it
     * until both guests arrive.
     *
     * Declining the booking, or letting its hold run out, pushes the dates
     * straight back open. A bed closed for a few hours is a rounding error
     * against a bed sold twice.
     */
    queueChannelPush(propertyId, input.roomTypeId, input.arrival, input.departure,
      pending ? 'booking-engine.hold' : 'reservation.create');

    // Says what arrived, not that something arrived. The confirmation, guest,
    // dates and origin are the four things somebody glancing at the bell needs
    // before deciding whether to open it.
    notify(propertyId, {
      source: 'Reservations',
      severity: pending ? 'info' : 'success',
      title: pending
        ? `Booking to confirm · ${input.guestName}`
        : `New booking · ${input.guestName}`,
      message: `${confirmation} · ${nights} night${nights === 1 ? '' : 's'} from ${input.arrival}`
        + ` · ${roomType.name}${input.channelCode ? ` · ${input.channelCode}` : ''}`
        + (pending ? ' · awaiting confirmation' : ''),
      link: reservationLink(resId),
    });

    raise(propertyId, {
      kind: 'booking.new',
      title: pending
        ? `Booking to confirm · ${input.guestName}`
        : `New booking · ${input.guestName}`,
      body: `${roomType.name} · ${input.arrival} → ${input.departure} · ${confirmation}`
        + (input.channelCode ? ` · ${input.channelCode}` : ''),
      reservationId: resId,
    });

    // Check these dates and shut them on the OTAs if this booking took the last
    // room. Queued rather than run inline: it writes to the channels and must
    // not hold the write lock — or fail — while a booking is being confirmed.
    if (!pending) {
      guardAfter(propertyId, actor, input.roomTypeId, input.arrival, input.departure, prop.business_date);
    }

    return getReservationDetail(propertyId, resId);
  });
}

/**
 * Run the overbooking guard once the current transaction has committed.
 *
 * The import is dynamic because the guard reaches back into this module's
 * neighbours; loading it lazily keeps the module graph acyclic without moving
 * anything. Failures are logged and swallowed — a booking that succeeded must
 * not be reported as failed because a channel would not take a close.
 */
function guardAfter(
  propertyId: string, actor: Actor,
  roomTypeId: string, from: string, to: string, today: string,
) {
  setImmediate(() => {
    void import('./overbooking.ts')
      .then(({ guardInventory }) =>
        guardInventory(propertyId, actor, { roomTypeId, from, to: addDays(to, -1), today }))
      .catch((e) => process.stderr.write(
        `[overbooking] guard failed for ${roomTypeId} ${from}→${to}: `
        + `${e instanceof Error ? e.message : String(e)}\n`));
  });
}

// ─── Read ────────────────────────────────────────────────────
// Exported so the benchmark can profile the exact query the list runs, rather
// than a copy of it that has since drifted.
export const RES_SELECT = `
  SELECT r.*, rt.code AS room_type_code, rt.name AS room_type_name, rt.kind AS room_type_kind,
         rp.code AS rate_plan_code, rp.name AS rate_plan_name,
         rm.number AS room_number, b.code AS bed_code,
         g.code AS group_code, c.name AS company_name
    FROM reservations r
    JOIN room_types rt ON rt.id = r.room_type_id
    JOIN rate_plans rp ON rp.id = r.rate_plan_id
    LEFT JOIN rooms rm ON rm.id = r.room_id
    LEFT JOIN beds b   ON b.id = r.bed_id
    LEFT JOIN groups g ON g.id = r.group_id
    LEFT JOIN companies c ON c.id = r.company_id`;

export interface ListFilters {
  status?: string[];
  arrivalFrom?: string;
  arrivalTo?: string;
  inHouseOn?: string;
  departureOn?: string;
  arrivalOn?: string;
  search?: string;
  roomTypeId?: string;
  groupId?: string;
  companyId?: string;
  profileId?: string;
  channelCode?: string;
  limit?: number;
  offset?: number;
}

/**
 * Build the WHERE clause shared by the list and its count.
 *
 * These two must never drift apart: a filter honoured by one and not the other
 * gives a page of results with a total that does not match it.
 */
function buildFilter(propertyId: string, f: ListFilters) {
  const where: string[] = ['r.property_id = ?'];
  const params: unknown[] = [propertyId];

  if (f.status?.length) {
    where.push(`r.status IN (${f.status.map(() => '?').join(',')})`);
    params.push(...f.status);
  }
  if (f.arrivalFrom) { where.push('r.arrival >= ?'); params.push(f.arrivalFrom); }
  if (f.arrivalTo) { where.push('r.arrival <= ?'); params.push(f.arrivalTo); }
  if (f.arrivalOn) { where.push('r.arrival = ?'); params.push(f.arrivalOn); }
  if (f.departureOn) { where.push('r.departure = ?'); params.push(f.departureOn); }
  if (f.inHouseOn) {
    where.push('r.arrival <= ? AND r.departure > ?');
    params.push(f.inHouseOn, f.inHouseOn);
  }
  if (f.roomTypeId) { where.push('r.room_type_id = ?'); params.push(f.roomTypeId); }
  if (f.groupId) { where.push('r.group_id = ?'); params.push(f.groupId); }
  if (f.companyId) { where.push('r.company_id = ?'); params.push(f.companyId); }
  if (f.profileId) { where.push('r.profile_id = ?'); params.push(f.profileId); }
  if (f.channelCode) { where.push('r.channel_code = ?'); params.push(f.channelCode); }
  if (f.search) {
    where.push(`(r.guest_name LIKE ? OR r.confirmation LIKE ? OR r.email LIKE ?
                 OR r.phone LIKE ? OR r.ota_reference LIKE ? OR rm.number LIKE ?)`);
    const like = `%${f.search}%`;
    params.push(like, like, like, like, like, like);
  }

  // The search predicate is the only one that reaches outside `reservations`,
  // so it is the only thing that can make a bare count need the rooms join.
  return { clause: where.join(' AND '), params, needsRooms: !!f.search };
}

export function listReservations(propertyId: string, f: ListFilters = {}) {
  const { clause, params } = buildFilter(propertyId, f);
  const limit = Math.min(f.limit ?? 200, 1000);
  const offset = f.offset ?? 0;
  const rows = all<any>(
    `${RES_SELECT} WHERE ${clause}
      ORDER BY r.arrival, r.guest_name LIMIT ${limit} OFFSET ${offset}`,
    ...params,
  );
  // Balances for the whole page in one query rather than one per row — this was
  // the single slowest thing on the busiest screen.
  //
  // Note the explicit arrow: `rows.map(shapeReservation)` hands `map`'s index
  // argument to the balance parameter, which is a quiet way to print money that
  // is wrong by a row number.
  const balances = reservationBalances(rows.map((r) => r.id));
  return rows.map((r) => shapeReservation(r, balances.get(r.id) ?? 0));
}

export function countReservations(propertyId: string, f: ListFilters = {}): number {
  const { clause, params, needsRooms } = buildFilter(propertyId, f);
  // Counting by fetching rows was both slow — every row shaped, every balance
  // summed — and wrong: it stopped at 1000, so a property past its first
  // thousand bookings saw a total that never moved.
  //
  // The rooms join is carried only when the search predicate needs it; for the
  // ordinary paging count it is pure cost.
  return scalar<number>(
    `SELECT count(*) AS n
       FROM reservations r
       ${needsRooms ? 'LEFT JOIN rooms rm ON rm.id = r.room_id' : ''}
      WHERE ${clause}`,
    ...params,
  );
}

export function shapeReservation(r: any, balance: number = reservationBalance(r.id)) {
  // Total, what Hostelworld collected, and what is left for the property.
  // Nulls for every booking the split does not apply to.
  const hw = hostelworldMoney(r);
  return {
    id: r.id,
    confirmation: r.confirmation,
    status: r.status,
    guest: r.guest_name,
    profileId: r.profile_id,
    email: r.email ?? '',
    phone: r.phone ?? '',
    arrival: r.arrival,
    departure: r.departure,
    nights: r.nights,
    adults: r.adults,
    children: r.children,
    roomTypeId: r.room_type_id,
    roomType: r.room_type_name,
    roomTypeCode: r.room_type_code,
    roomTypeKind: r.room_type_kind,
    room: r.room_number ?? undefined,
    roomId: r.room_id ?? undefined,
    bed: r.bed_code ?? undefined,
    bedId: r.bed_id ?? undefined,
    ratePlanId: r.rate_plan_id,
    rateCode: r.rate_plan_code,
    ratePlanName: r.rate_plan_name,
    rateMinor: r.nights > 0 ? Math.round(r.total_minor / r.nights) : 0,
    totalMinor: r.total_minor,
    balanceMinor: balance,
    depositRequiredMinor: r.deposit_required_minor,
    commissionMinor: r.commission_minor,
    /** True for a Hostelworld booking whatever Configuration says. */
    hostelworld: hw.hostelworld,
    /** The total the OTA reported, when it reported one. */
    otaTotalMinor: hw.otaTotalMinor,
    /** What Hostelworld collected at booking. Null unless the split applies. */
    otaCollectedMinor: hw.otaCollectedMinor,
    /** Total − collected: what the property receives. Null unless the split applies. */
    businessMinor: hw.businessMinor,
    /** The Hostelworld credit already on the folio, as a positive number. */
    otaCreditMinor: hw.otaCreditMinor,
    /** Hostelworld's full statement: nights, promotion, paid / due, reference. */
    hostelworldDetail: hw.detail,
    currency: r.currency,
    source: r.source,
    channel: r.channel_code ?? undefined,
    // The OTA behind a hub connection, when there is one. Falls back to the
    // connection so a screen showing "where did this come from" is never blank.
    otaChannel: r.ota_channel ?? r.channel_code ?? undefined,
    otaReference: r.ota_reference ?? undefined,
    segment: r.segment ?? '',
    company: r.company_name ?? undefined,
    companyId: r.company_id ?? undefined,
    groupId: r.group_id ?? undefined,
    group: r.group_code ?? undefined,
    vip: r.vip === 1,
    eta: r.eta ?? undefined,
    etd: r.etd ?? undefined,
    specialRequests: r.special_requests ?? undefined,
    preferences: parseJson<string[]>(r.preferences, []),
    paymentMethod: r.payment_method ?? undefined,
    cardLast4: r.card_last4 ?? undefined,
    origin: r.origin,
    /**
     * A website booking nobody has accepted yet.
     *
     * Sent as a flag rather than left for the browser to work out from status
     * and origin: the rule lives in `pendingbookings.ts` and there must be
     * exactly one copy of it, or the button and the server will one day
     * disagree about which bookings need confirming.
     */
    awaitingConfirmation: isPending(r),
    /** Set on the other beds of a dorm party; the lead booking has none. */
    parentId: r.parent_id ?? undefined,
    createdBy: r.created_by ?? '',
    createdOn: (r.created_at ?? '').slice(0, 10),
    checkedInAt: r.checked_in_at ?? undefined,
    checkedOutAt: r.checked_out_at ?? undefined,
    cancelledAt: r.cancelled_at ?? undefined,
    cancelReason: r.cancel_reason ?? undefined,
  };
}

export function reservationBalance(reservationId: string): number {
  return scalar<number>(
    `SELECT COALESCE(SUM(l.amount_minor), 0) AS total
       FROM folio_lines l JOIN folios f ON f.id = l.folio_id
      WHERE f.reservation_id = ? AND l.voided = 0`,
    reservationId,
  );
}

/**
 * The same sum for many reservations at once.
 *
 * A reservation may carry more than one folio, so the grouping is by
 * reservation rather than by folio. The join is a LEFT one with `voided = 0`
 * in the ON clause, not the WHERE: a reservation whose only lines are voided
 * must still appear in the result with a balance of zero, and moving that
 * condition to the WHERE clause would drop the row instead.
 */
export function reservationBalances(ids: string[]): Map<string, number> {
  const balances = new Map<string, number>();
  if (!ids.length) return balances;
  // SQLite's default host-parameter ceiling is 999 and a page can ask for
  // 1000, so the IN list is chunked rather than trusted.
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const rows = all<{ reservation_id: string; total: number }>(
      `SELECT f.reservation_id AS reservation_id,
              COALESCE(SUM(l.amount_minor), 0) AS total
         FROM folios f
         LEFT JOIN folio_lines l ON l.folio_id = f.id AND l.voided = 0
        WHERE f.reservation_id IN (${chunk.map(() => '?').join(',')})
        GROUP BY f.reservation_id`,
      ...chunk,
    );
    for (const row of rows) balances.set(row.reservation_id, row.total);
  }
  return balances;
}

export function getReservation(propertyId: string, reservationId: string) {
  const row = get<any>(`${RES_SELECT} WHERE r.id = ? AND r.property_id = ?`, reservationId, propertyId);
  if (!row) notFound('Reservation');
  return row;
}

export function getReservationDetail(propertyId: string, reservationId: string) {
  const row = getReservation(propertyId, reservationId);
  const base = shapeReservation(row);
  // `nights` stays the count everywhere in the API; the per-night ledger is
  // `nightRows` so a caller never has to guess which shape it got.
  const nightRows = all<any>(
    `SELECT n.*, rt.name AS room_type_name, rp.code AS rate_plan_code, rm.number AS room_number
       FROM reservation_nights n
       JOIN room_types rt ON rt.id = n.room_type_id
       JOIN rate_plans rp ON rp.id = n.rate_plan_id
       LEFT JOIN rooms rm ON rm.id = n.room_id
      WHERE n.reservation_id = ? ORDER BY n.date`,
    reservationId,
  ).map((n) => ({
    id: n.id, date: n.date, roomTypeId: n.room_type_id, roomType: n.room_type_name,
    roomId: n.room_id, room: n.room_number ?? undefined, ratePlanId: n.rate_plan_id,
    rateCode: n.rate_plan_code, rateMinor: n.rate_minor, adults: n.adults,
    children: n.children, posted: n.posted === 1,
  }));
  const folios = foliosForReservation(reservationId).map((f) => ({
    id: f.id, number: f.number, name: f.name, type: f.type, windowNo: f.window_no,
    status: f.status, balanceMinor: f.balanceMinor,
  }));
  const guests = all<any>(
    'SELECT * FROM reservation_guests WHERE reservation_id = ? ORDER BY is_primary DESC, name',
    reservationId,
  ).map((g) => ({
    id: g.id, name: g.name, profileId: g.profile_id, isPrimary: g.is_primary === 1,
    kind: g.kind, registered: g.registered === 1,
  }));
  const notes = all<any>(
    'SELECT * FROM reservation_notes WHERE reservation_id = ? ORDER BY ts DESC',
    reservationId,
  ).map((n) => ({ id: n.id, ts: n.ts, user: n.user_name, category: n.category, body: n.body }));

  return { ...base, nightRows, folios, guests, notes };
}

// ─── Amend ───────────────────────────────────────────────────
export interface UpdateReservationInput {
  guestName?: string; email?: string; phone?: string;
  arrival?: string; departure?: string;
  adults?: number; children?: number;
  roomTypeId?: string; ratePlanId?: string;
  status?: string; segment?: string | null; source?: string;
  vip?: boolean; eta?: string | null; etd?: string | null;
  specialRequests?: string | null; preferences?: string[];
  paymentMethod?: string | null; companyId?: string | null;
  rateOverrideMinor?: number | null; overrideReason?: string | null;
  depositRequiredMinor?: number | null;
  /**
   * What Hostelworld collected, corrected by hand. Null clears it, which takes
   * the booking out of the split until a figure is entered again.
   */
  otaCollectedMinor?: number | null;
  force?: boolean;
}

export function updateReservation(
  propertyId: string, actor: Actor, reservationId: string, input: UpdateReservationInput,
) {
  return tx(() => {
    const before = getReservation(propertyId, reservationId);
    if (['Checked-out', 'Cancelled'].includes(before.status)) {
      throw new HttpError(409, `A ${before.status.toLowerCase()} reservation can no longer be amended`);
    }

    const arrival = input.arrival ?? before.arrival;
    const departure = input.departure ?? before.departure;
    const roomTypeId = input.roomTypeId ?? before.room_type_id;
    const ratePlanId = input.ratePlanId ?? before.rate_plan_id;
    const adults = input.adults ?? before.adults;
    const children = input.children ?? before.children;

    const stayChanged =
      arrival !== before.arrival || departure !== before.departure ||
      roomTypeId !== before.room_type_id || ratePlanId !== before.rate_plan_id ||
      adults !== before.adults || children !== before.children ||
      input.rateOverrideMinor !== undefined && input.rateOverrideMinor !== null;

    const nights = nightsBetween(arrival, departure);
    if (nights < 1) throw new HttpError(400, 'Departure must be after arrival');

    if (before.status === 'Checked-in' && arrival !== before.arrival) {
      throw new HttpError(409, 'Arrival cannot change after check-in — use a room move or early departure');
    }

    let total = before.total_minor;
    if (stayChanged) {
      if (!input.force) {
        const avail = checkAvailability(propertyId, roomTypeId, arrival, departure, 1, reservationId);
        if (!avail.ok) conflict('Not available for the amended stay', { shortfall: avail.shortfall });
        const violations = validateStay(propertyId, {
          roomTypeId, ratePlanId, arrival, departure,
          channelCode: before.channel_code, bookedOn: property(propertyId).business_date,
        });
        if (violations.length) conflict('The amended stay breaks a selling restriction', { violations });
      }

      const quote = quoteStay(propertyId, {
        roomTypeId, ratePlanId, arrival, departure, adults, children,
        channelCode: before.channel_code, bookedOn: before.created_at.slice(0, 10),
        currency: before.currency,
      });

      // Nights already posted by the night audit keep their rate; the rest are
      // re-priced. Room assignment survives where the room is still free.
      const posted = new Map<string, any>(
        all<any>('SELECT * FROM reservation_nights WHERE reservation_id = ? AND posted = 1', reservationId)
          .map((n) => [n.date, n]),
      );
      run('DELETE FROM reservation_nights WHERE reservation_id = ? AND posted = 0', reservationId);

      const keepRoom = before.room_id && roomTypeId === before.room_type_id
        && isRoomFree(propertyId, before.room_id, arrival, departure, reservationId)
        ? before.room_id : null;

      const dates = dateRange(arrival, departure);
      dates.forEach((date, i) => {
        if (posted.has(date)) return;
        const rate = input.rateOverrideMinor ?? quote.nights[i].rateMinor;
        run(
          `INSERT INTO reservation_nights(id, reservation_id, property_id, date, room_type_id, room_id,
                                          bed_id, rate_plan_id, rate_minor, adults, children, posted)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,0)`,
          id('rn'), reservationId, propertyId, date, roomTypeId,
          keepRoom, before.bed_id, ratePlanId, rate, adults, children,
        );
      });
      total = scalar<number>(
        'SELECT COALESCE(SUM(rate_minor),0) AS t FROM reservation_nights WHERE reservation_id = ?',
        reservationId,
      );
      if (!keepRoom && before.room_id) {
        run('UPDATE reservations SET room_id = NULL WHERE id = ?', reservationId);
      }
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    const put = (col: string, val: unknown) => { sets.push(`${col} = ?`); params.push(val); };

    if (input.guestName !== undefined) put('guest_name', input.guestName);
    if (input.email !== undefined) put('email', input.email);
    if (input.phone !== undefined) put('phone', input.phone);
    if (input.status !== undefined) put('status', input.status);
    if (input.segment !== undefined) put('segment', input.segment);
    if (input.source !== undefined) put('source', input.source);
    if (input.vip !== undefined) put('vip', input.vip ? 1 : 0);
    if (input.eta !== undefined) put('eta', input.eta);
    if (input.etd !== undefined) put('etd', input.etd);
    if (input.specialRequests !== undefined) put('special_requests', input.specialRequests);
    if (input.preferences !== undefined) put('preferences', jsonCol(input.preferences));
    if (input.paymentMethod !== undefined) put('payment_method', input.paymentMethod);
    if (input.companyId !== undefined) put('company_id', input.companyId);
    if (input.depositRequiredMinor !== undefined) put('deposit_required_minor', input.depositRequiredMinor);
    if (input.otaCollectedMinor !== undefined) {
      put('ota_collected_minor', input.otaCollectedMinor === null
        ? null : Math.min(total, Math.max(0, Math.round(input.otaCollectedMinor))));
    }

    put('arrival', arrival);
    put('departure', departure);
    put('nights', nights);
    put('adults', adults);
    put('children', children);
    put('room_type_id', roomTypeId);
    put('rate_plan_id', ratePlanId);
    put('total_minor', total);
    put('updated_at', nowIso());
    params.push(reservationId);

    run(`UPDATE reservations SET ${sets.join(', ')} WHERE id = ?`, ...params);

    audit(actor, {
      action: 'reservation.update', entity: 'RESERVATION', entityId: reservationId,
      entityRef: before.confirmation,
      before: {
        arrival: before.arrival, departure: before.departure,
        adults: before.adults, children: before.children, totalMinor: before.total_minor,
        status: before.status,
      },
      after: { arrival, departure, adults, children, totalMinor: total, status: input.status ?? before.status },
      elevated: input.rateOverrideMinor !== undefined && input.rateOverrideMinor !== null,
    });

    if (stayChanged) {
      queueChannelPush(propertyId, before.room_type_id, before.arrival, before.departure, 'reservation.update');
      if (roomTypeId !== before.room_type_id || arrival !== before.arrival) {
        queueChannelPush(propertyId, roomTypeId, arrival, departure, 'reservation.update');
      }
    }

    // The folio credit follows the collected figure and the total, so a hand
    // correction or a re-priced stay keeps the balance at the business price.
    if (input.otaCollectedMinor !== undefined || total !== before.total_minor) {
      syncCollectedCredit(propertyId, actor, reservationId);
    }
    return getReservationDetail(propertyId, reservationId);
  });
}

export function cancelReservation(
  propertyId: string, actor: Actor, reservationId: string,
  opts: { reason: string; chargeMinor?: number },
) {
  return tx(() => {
    const res = getReservation(propertyId, reservationId);
    if (res.status === 'Cancelled') throw new HttpError(409, 'Reservation is already cancelled');
    if (res.status === 'Checked-in') {
      throw new HttpError(409, 'An in-house reservation cannot be cancelled — check the guest out instead');
    }
    if (res.status === 'Checked-out') throw new HttpError(409, 'A departed reservation cannot be cancelled');

    run(
      `UPDATE reservations SET status = 'Cancelled', cancelled_at = ?, cancel_reason = ?, updated_at = ?
        WHERE id = ?`,
      nowIso(), opts.reason, nowIso(), reservationId,
    );
    run('DELETE FROM reservation_nights WHERE reservation_id = ? AND posted = 0', reservationId);
    // Hostelworld keeps its deposit on a cancellation, and there are no room
    // charges left for the credit to offset — so it comes off the folio too,
    // or a cancelled booking would sit showing money owed to the guest.
    syncCollectedCredit(propertyId, actor, reservationId);

    if (opts.chargeMinor && opts.chargeMinor > 0) {
      const folio = ensureFolio(propertyId, reservationId, res.guest_name);
      postCharge(propertyId, actor, {
        folioId: folio.id, code: 'CXL', description: `Cancellation fee — ${opts.reason}`,
        unitMinor: opts.chargeMinor, businessDate: property(propertyId).business_date,
        applyTax: false, reservationId,
      });
    }

    audit(actor, {
      action: 'reservation.cancel', entity: 'RESERVATION', entityId: reservationId,
      entityRef: res.confirmation, before: { status: res.status },
      after: { status: 'Cancelled', reason: opts.reason, chargeMinor: opts.chargeMinor ?? 0 },
    });
    queueChannelPush(propertyId, res.room_type_id, res.arrival, res.departure, 'reservation.cancel');

    notify(propertyId, {
      source: 'Reservations',
      severity: 'warn',
      title: `Cancelled · ${res.guest_name}`,
      message: `${res.confirmation} · was arriving ${res.arrival}`
        + (opts.reason ? ` · ${opts.reason}` : ''),
      link: reservationLink(reservationId),
    });

    raise(propertyId, {
      kind: 'booking.cancelled',
      title: `Cancelled · ${res.guest_name}`,
      body: `${res.arrival} → ${res.departure} · ${res.confirmation}`
        + (opts.reason ? ` · ${opts.reason}` : ''),
      reservationId,
    });
    return getReservationDetail(propertyId, reservationId);
  });
}

// ─── Room assignment & moves ─────────────────────────────────
export function assignRoom(
  propertyId: string, actor: Actor, reservationId: string,
  opts: { roomId?: string | null; bedId?: string | null; fromDate?: string; auto?: boolean },
) {
  return tx(() => {
    const res = getReservation(propertyId, reservationId);
    if (['Cancelled', 'Checked-out', 'No-show'].includes(res.status)) {
      throw new HttpError(409, `Cannot assign a room to a ${res.status.toLowerCase()} reservation`);
    }
    const from = opts.fromDate ?? (res.checked_in_at ? property(propertyId).business_date : res.arrival);
    const roomType = get<any>('SELECT * FROM room_types WHERE id = ?', res.room_type_id);

    let roomId = opts.roomId ?? null;
    let bedId = opts.bedId ?? null;

    if (roomType.kind === 'dorm') {
      if (!bedId && opts.auto) {
        const beds = freeBeds(propertyId, res.room_type_id, from, res.departure, reservationId);
        if (!beds.length) conflict('No free bed of this type for the remaining nights');
        bedId = beds[0].id;
        roomId = beds[0].room_id;
      } else if (bedId) {
        const ok = freeBeds(propertyId, res.room_type_id, from, res.departure, reservationId)
          .some((b: any) => b.id === bedId);
        if (!ok) conflict('That bed is not free for the remaining nights');
        roomId = get<any>('SELECT room_id FROM beds WHERE id = ?', bedId)?.room_id ?? null;
      }
    }

    if (!roomId) {
      if (opts.auto) {
        const candidates = freeRooms(propertyId, res.room_type_id, from, res.departure, reservationId);
        if (!candidates.length) conflict('No free room of this type for the remaining nights');
        // Prefer a clean, inspected room, then the lowest floor/number.
        const ranked = candidates.sort((a: any, b: any) => {
          const score = (r: any) =>
            (r.status === 'Vacant Inspected' ? 0 : r.status === 'Vacant Clean' ? 1 : 2);
          return score(a) - score(b) || a.floor - b.floor || a.number.localeCompare(b.number);
        });
        roomId = ranked[0].id;
      } else {
        throw new HttpError(400, 'roomId is required (or pass auto=true)');
      }
    }

    if (!roomId) throw new HttpError(409, 'Could not resolve a room to assign');
    const room = get<any>('SELECT * FROM rooms WHERE id = ? AND property_id = ?', roomId, propertyId);
    if (!room) notFound('Room');
    if (room.room_type_id !== res.room_type_id) {
      throw new HttpError(400, 'Room is a different room type — change the reservation type first');
    }
    // A dorm is shared: many guests occupy the same room at once, so
    // exclusivity is enforced per bed (freeBeds, above) rather than per room.
    if (roomType.kind !== 'dorm'
        && !isRoomFree(propertyId, roomId, from, res.departure, reservationId)) {
      conflict('That room is not free for the remaining nights');
    }

    run(
      'UPDATE reservation_nights SET room_id = ?, bed_id = ? WHERE reservation_id = ? AND date >= ?',
      roomId, bedId, reservationId, from,
    );
    run('UPDATE reservations SET room_id = ?, bed_id = ?, updated_at = ? WHERE id = ?',
      roomId, bedId, nowIso(), reservationId);

    audit(actor, {
      action: 'reservation.assign-room', entity: 'RESERVATION', entityId: reservationId,
      entityRef: res.confirmation,
      before: { room: res.room_id }, after: { room: roomId, bed: bedId, fromDate: from },
    });
    return getReservationDetail(propertyId, reservationId);
  });
}

/** Mid-stay transfer: nights from `fromDate` onwards move to the new room. */
export function moveRoom(
  propertyId: string, actor: Actor, reservationId: string,
  opts: { roomId: string; fromDate?: string; reason?: string; keepRate?: boolean },
) {
  return tx(() => {
    const res = getReservation(propertyId, reservationId);
    const prop = property(propertyId);
    const from = opts.fromDate ?? prop.business_date;
    const target = get<any>('SELECT * FROM rooms WHERE id = ? AND property_id = ?', opts.roomId, propertyId);
    if (!target) notFound('Room');
    const targetType = get<any>('SELECT kind FROM room_types WHERE id = ?', target.room_type_id);
    // Moving into a dorm needs a free bed, not an empty room.
    if (targetType?.kind === 'dorm') {
      const beds = freeBeds(propertyId, target.room_type_id, from, res.departure, reservationId)
        .filter((b: any) => b.room_id === opts.roomId);
      if (!beds.length) conflict('That dorm has no free bed for the remaining nights');
    } else if (!isRoomFree(propertyId, opts.roomId, from, res.departure, reservationId)) {
      conflict('Target room is not free for the remaining nights');
    }

    const oldRoomId = res.room_id;
    const newTypeId = target.room_type_id;

    // Re-price the moved nights unless the guest keeps the original rate.
    if (!opts.keepRate && newTypeId !== res.room_type_id) {
      const quote = quoteStay(propertyId, {
        roomTypeId: newTypeId, ratePlanId: res.rate_plan_id,
        arrival: from, departure: res.departure,
        adults: res.adults, children: res.children,
        channelCode: res.channel_code, bookedOn: res.created_at.slice(0, 10), currency: res.currency,
      });
      const byDate = new Map(quote.nights.map((n) => [n.date, n.rateMinor]));
      for (const [date, rate] of byDate) {
        run(
          `UPDATE reservation_nights SET room_id = ?, room_type_id = ?, rate_minor = ?
            WHERE reservation_id = ? AND date = ? AND posted = 0`,
          opts.roomId, newTypeId, rate, reservationId, date,
        );
      }
    } else {
      run(
        `UPDATE reservation_nights SET room_id = ?, room_type_id = ?
          WHERE reservation_id = ? AND date >= ? AND posted = 0`,
        opts.roomId, newTypeId, reservationId, from,
      );
    }

    const total = scalar<number>(
      'SELECT COALESCE(SUM(rate_minor),0) AS t FROM reservation_nights WHERE reservation_id = ?',
      reservationId,
    );
    run(
      'UPDATE reservations SET room_id = ?, room_type_id = ?, total_minor = ?, updated_at = ? WHERE id = ?',
      opts.roomId, newTypeId, total, nowIso(), reservationId,
    );

    // Housekeeping: vacate the old room, occupy the new one.
    if (res.status === 'Checked-in') {
      if (oldRoomId) {
        // Same rule as check-out: a shared dorm the guest has left may still
        // be occupied by others.
        const stillOccupied = scalar<number>(
          `SELECT count(*) AS n FROM reservations
            WHERE property_id = ? AND room_id = ? AND status = 'Checked-in' AND id <> ?`,
          propertyId, oldRoomId, reservationId,
        );
        run('UPDATE rooms SET status = ? WHERE id = ?',
          stillOccupied > 0 ? 'Occupied Dirty' : 'Vacant Dirty', oldRoomId);
      }
      run(`UPDATE rooms SET status = 'Occupied Dirty' WHERE id = ?`, opts.roomId);
    }

    audit(actor, {
      action: 'reservation.room-move', entity: 'RESERVATION', entityId: reservationId,
      entityRef: res.confirmation,
      before: { room: oldRoomId }, after: { room: opts.roomId, fromDate: from, reason: opts.reason },
    });
    return getReservationDetail(propertyId, reservationId);
  });
}

// ─── Front desk transitions ──────────────────────────────────
// ─── Confirming a booking the website took ───────────────────
//
// The public site can take a booking at three in the morning; agreeing to it is
// a person's decision, made later, and it is the moment the property actually
// commits a bed. Until then the booking holds nothing (`pendingbookings.ts`),
// so confirming has to do the inventory check for real — the bed may have gone
// to somebody else in the meantime, and that has to fail loudly rather than
// double-book the room.

export interface ConfirmAssignment {
  reservationId: string;
  roomId?: string | null;
  bedId?: string | null;
}

/**
 * Every reservation booked as one party, lead first.
 *
 * A dorm party is one reservation per bed linked by `parent_id`, so the front
 * desk confirms four beds in one action rather than hunting four rows that
 * happen to share a guest name.
 */
export function bookingGroup(propertyId: string, reservationId: string): any[] {
  const res = getReservation(propertyId, reservationId);
  const rootId = res.parent_id ?? res.id;
  const rows = all<any>(
    `${RES_SELECT} WHERE r.property_id = ? AND (r.id = ? OR r.parent_id = ?)
      ORDER BY (r.id = ?) DESC, r.created_at, r.confirmation`,
    propertyId, rootId, rootId, rootId,
  );
  return rows;
}

/**
 * Accept a pending website booking and put it on real beds.
 *
 * Every member of the party is flipped to `Confirmed` **before** its bed is
 * assigned, in order. That ordering is load-bearing: a pending booking is
 * invisible to the availability engine, so if the status were flipped last, the
 * second guest in a dorm party would be offered the bed the first had just
 * taken. Confirming first makes each assignment visible to the next.
 *
 * The whole party is one transaction. If the last bed cannot be found, nothing
 * is confirmed and nothing is assigned — a half-confirmed party would leave the
 * front desk with beds allocated to a booking they had not agreed to.
 */
export function confirmBooking(
  propertyId: string, actor: Actor, reservationId: string,
  opts: { assignments?: ConfirmAssignment[]; auto?: boolean } = {},
) {
  return tx(() => {
    const members = bookingGroup(propertyId, reservationId);
    const pendingMembers = members.filter((m) => isPending(m));
    if (!pendingMembers.length) {
      const lead = members.find((m) => m.id === reservationId) ?? members[0];
      throw new HttpError(409,
        `This booking is already ${String(lead?.status ?? 'confirmed').toLowerCase()}`,
        'not_pending');
    }

    const byId = new Map(pendingMembers.map((m) => [m.id, m]));
    const wanted = new Map<string, ConfirmAssignment>();
    for (const a of opts.assignments ?? []) {
      if (!byId.has(a.reservationId)) {
        throw new HttpError(400,
          'An assignment names a reservation that is not part of this booking');
      }
      if (wanted.has(a.reservationId)) {
        throw new HttpError(400, 'The same reservation was assigned twice');
      }
      wanted.set(a.reservationId, a);
    }

    // Two guests cannot be given the same bed. Caught here rather than left to
    // the per-bed check below, because that check only sees one member at a
    // time and would pass both.
    const claimed = new Set<string>();
    for (const a of wanted.values()) {
      const unit = a.bedId || a.roomId;
      if (!unit) continue;
      if (claimed.has(unit)) {
        throw new HttpError(400, 'Two guests in this booking were given the same room or bed');
      }
      claimed.add(unit);
    }

    // A party can span room types — the website lets three guests take a double
    // and a dorm bed — so what each member needs is read from that member's own
    // room type. Deciding it once from the lead is how a dorm bed came to be
    // confirmed by choosing a deluxe double.
    const roomTypeOf = (roomTypeId: string) =>
      get<any>('SELECT * FROM room_types WHERE id = ?', roomTypeId);
    const isDormMember = (m: { room_type_id: string }) => roomTypeOf(m.room_type_id)?.kind === 'dorm';
    const roomType = roomTypeOf(pendingMembers[0].room_type_id);
    const needsUnit = (m: { room_type_id: string }, a: ConfirmAssignment | undefined) =>
      !(isDormMember(m) ? a?.bedId : a?.roomId);
    if (!opts.auto && pendingMembers.some((m) => needsUnit(m, wanted.get(m.id)))) {
      const anyDorm = pendingMembers.some(isDormMember);
      const anyRoom = pendingMembers.some((m) => !isDormMember(m));
      throw new HttpError(400,
        anyDorm && anyRoom
          ? 'Pick a room or a bed for every part of this booking (or pass auto=true)'
          : anyDorm
            ? 'Pick a bed for every guest in this booking (or pass auto=true)'
            : 'Pick a room for this booking (or pass auto=true)',
        'unit_required');
    }

    for (const member of pendingMembers) {
      // `hold_expires_at` goes with the pending state. Leaving it set on a
      // confirmed booking would arm the release sweep against a booking the
      // property has already accepted and given a bed to — the sweep filters
      // on the pending status as well, so it would not actually fire, but a
      // confirmed reservation carrying an expiry is a trap for the next person
      // to write a query over this column.
      run(`UPDATE reservations
              SET status = 'Confirmed', hold_expires_at = NULL, updated_at = ?
            WHERE id = ?`,
        nowIso(), member.id);

      const a = wanted.get(member.id);
      assignRoom(propertyId, actor, member.id, {
        roomId: a?.roomId ?? null,
        bedId: a?.bedId ?? null,
        fromDate: member.arrival,
        auto: needsUnit(member, a),
      });
    }

    const lead = getReservation(propertyId, pendingMembers[0].id);
    audit(actor, {
      action: 'reservation.confirm', entity: 'RESERVATION', entityId: lead.id,
      entityRef: `${lead.confirmation} · ${lead.guest_name}`,
      before: { status: PENDING_STATUS, origin: PENDING_ORIGIN },
      after: {
        status: 'Confirmed',
        beds: pendingMembers.length,
        rooms: pendingMembers.map((m) => getReservation(propertyId, m.id).room_number ?? null),
      },
    });

    notify(propertyId, {
      source: 'Reservations',
      severity: 'success',
      title: `Booking confirmed · ${lead.guest_name}`,
      message: `${lead.confirmation} · ${pendingMembers.length} `
        + `${roomType?.kind === 'dorm' ? 'bed' : 'room'}${pendingMembers.length === 1 ? '' : 's'}`
        + ` · ${lead.arrival} → ${lead.departure}`,
      link: reservationLink(lead.id),
    });

    // Only now has the property actually sold anything, so this is where the
    // OTAs are told and the overbooking guard runs — the two side effects
    // `createReservation` deliberately skipped while the booking was pending.
    // Every room type the party took, not only the lead's: a booking that held
    // a double and a dorm bed sold inventory in two of them.
    const soldTypes = [...new Set(pendingMembers.map((m) => m.room_type_id))];
    for (const roomTypeId of soldTypes) {
      queueChannelPush(propertyId, roomTypeId, lead.arrival, lead.departure, 'reservation.confirm');
      guardAfter(propertyId, actor, roomTypeId, lead.arrival, lead.departure,
        property(propertyId).business_date);
    }

    return {
      confirmed: pendingMembers.length,
      reservations: pendingMembers.map((m) => getReservationDetail(propertyId, m.id)),
    };
  });
}

export function checkIn(
  propertyId: string, actor: Actor, reservationId: string,
  opts: { roomId?: string; bedId?: string; paymentMinor?: number; paymentMethod?: string;
          tenderedMinor?: number | null;
          // A deposit is money like any other: it can be handed over in a
          // currency the property is not kept in, and the note and the rate
          // belong on the folio line the same way they do at the cashier.
          tenderCurrency?: string | null; tenderRate?: number | null; keptMinor?: number | null;
          changeCurrency?: string | null; changeRate?: number | null;
          idNumber?: string; idType?: string; registered?: boolean } = {},
) {
  return tx(() => {
    const prop = property(propertyId);
    const res = getReservation(propertyId, reservationId);
    if (res.status === 'Checked-in') throw new HttpError(409, 'Guest is already checked in');
    if (!OPEN_STATUSES.includes(res.status as any)) {
      throw new HttpError(409, `Cannot check in a ${res.status.toLowerCase()} reservation`);
    }
    // A website booking holds no room until somebody accepts it, so there is
    // nothing to check the guest into. Confirming is a separate, earlier act:
    // it picks the bed and takes the inventory. Checking in would otherwise
    // silently do both, which is how an unwanted booking ends up housed.
    if (isPending(res)) {
      throw new HttpError(409,
        'Confirm this booking and assign a room before checking the guest in',
        'awaiting_confirmation');
    }
    if (res.arrival > prop.business_date) {
      throw new HttpError(409,
        `Arrival is ${res.arrival}; the open business date is ${prop.business_date}`, 'early_arrival');
    }

    if (opts.roomId || opts.bedId) {
      assignRoom(propertyId, actor, reservationId, {
        roomId: opts.roomId ?? null, bedId: opts.bedId ?? null, fromDate: res.arrival,
      });
    }
    const current = getReservation(propertyId, reservationId);
    const roomType = get<any>('SELECT * FROM room_types WHERE id = ?', current.room_type_id);
    if (roomType.kind === 'dorm' && !current.bed_id) {
      assignRoom(propertyId, actor, reservationId, { auto: true, fromDate: res.arrival });
    } else if (!current.room_id) {
      assignRoom(propertyId, actor, reservationId, { auto: true, fromDate: res.arrival });
    }

    const assigned = getReservation(propertyId, reservationId);
    const room = get<any>('SELECT * FROM rooms WHERE id = ?', assigned.room_id);
    if (!room) throw new HttpError(409, 'No room assigned — assign a room before checking in');
    if (['Out of Order', 'Out of Service'].includes(room.status)) {
      throw new HttpError(409, `Room ${room.number} is ${room.status}`);
    }
    if (room.status === 'Vacant Dirty') {
      throw new HttpError(409,
        `Room ${room.number} has not been cleaned yet`, 'room_not_ready', { roomStatus: room.status });
    }

    run(
      `UPDATE reservations SET status = 'Checked-in', checked_in_at = ?, updated_at = ? WHERE id = ?`,
      nowIso(), nowIso(), reservationId,
    );
    run(`UPDATE rooms SET status = 'Occupied Clean' WHERE id = ?`, assigned.room_id);
    if (assigned.bed_id) run(`UPDATE beds SET status = 'Occupied' WHERE id = ?`, assigned.bed_id);

    if (opts.registered) {
      run('UPDATE reservation_guests SET registered = 1, id_number = ? WHERE reservation_id = ? AND is_primary = 1',
        opts.idNumber ?? null, reservationId);
    }
    if (opts.idNumber && assigned.profile_id) {
      run('UPDATE profiles SET id_number = ?, id_type = ?, updated_at = ? WHERE id = ?',
        opts.idNumber, opts.idType ?? 'passport', nowIso(), assigned.profile_id);
    }

    const folio = ensureFolio(propertyId, reservationId, assigned.guest_name);
    if (opts.paymentMinor && opts.paymentMinor > 0) {
      // Through `takePayment`, not `postPayment`, so a deposit taken by card at
      // check-in carries the same surcharge as one taken at the cashier desk.
      // Two doors onto the same till have to charge the same fee.
      takePayment(propertyId, actor, {
        folioId: folio.id, method: opts.paymentMethod ?? 'Cash',
        amountMinor: opts.paymentMinor, businessDate: prop.business_date,
        description: 'Deposit / advance payment at check-in',
        tenderedMinor: opts.tenderedMinor ?? null,
        tenderCurrency: opts.tenderCurrency ?? null,
        tenderRate: opts.tenderRate ?? null,
        keptMinor: opts.keptMinor ?? null,
        changeCurrency: opts.changeCurrency ?? null,
        changeRate: opts.changeRate ?? null,
      });
    }

    audit(actor, {
      action: 'reservation.check-in', entity: 'RESERVATION', entityId: reservationId,
      entityRef: `${assigned.confirmation} · room ${room.number}`,
      after: { room: room.number, at: nowIso() },
    });
    notify(propertyId, {
      source: 'Front Desk',
      severity: 'success',
      title: `Checked in · ${assigned.guest_name}`,
      message: `Room ${room.number} · ${assigned.confirmation}`,
      link: reservationLink(reservationId),
    });
    return getReservationDetail(propertyId, reservationId);
  });
}

export function checkOut(
  propertyId: string, actor: Actor, reservationId: string,
  opts: { settlementMinor?: number; method?: string; allowBalance?: boolean; toCityLedger?: boolean } = {},
) {
  return tx(() => {
    const prop = property(propertyId);
    const res = getReservation(propertyId, reservationId);
    if (res.status !== 'Checked-in') {
      throw new HttpError(409, `Only an in-house reservation can be checked out (status: ${res.status})`);
    }

    // Any unposted night up to today must be charged before departure.
    postOutstandingNights(propertyId, actor, reservationId, prop.business_date);

    const folios = foliosForReservation(reservationId);
    const outstanding = folios.reduce((s, f) => s + f.balanceMinor, 0);
    if (outstanding !== 0 && !opts.allowBalance && !opts.toCityLedger) {
      throw new HttpError(409,
        'The folio still has an outstanding balance', 'folio_has_balance',
        { balanceMinor: outstanding, folios: folios.map((f) => ({ id: f.id, number: f.number, balanceMinor: f.balanceMinor })) });
    }

    // Early departure — drop the nights the guest is not staying.
    if (prop.business_date < res.departure) {
      run('DELETE FROM reservation_nights WHERE reservation_id = ? AND date >= ? AND posted = 0',
        reservationId, prop.business_date);
      const nights = scalar<number>(
        'SELECT count(*) AS n FROM reservation_nights WHERE reservation_id = ?', reservationId);
      const total = scalar<number>(
        'SELECT COALESCE(SUM(rate_minor),0) AS t FROM reservation_nights WHERE reservation_id = ?', reservationId);
      run('UPDATE reservations SET departure = ?, nights = ?, total_minor = ? WHERE id = ?',
        prop.business_date, nights, total, reservationId);
      queueChannelPush(propertyId, res.room_type_id, prop.business_date, res.departure, 'early-departure');
    }

    run(
      `UPDATE reservations SET status = 'Checked-out', checked_out_at = ?, updated_at = ? WHERE id = ?`,
      nowIso(), nowIso(), reservationId,
    );
    if (res.room_id) {
      // A dorm only becomes vacant when its last guest has gone; while others
      // are still in it the room needs servicing, not turning over.
      const stillOccupied = scalar<number>(
        `SELECT count(*) AS n FROM reservations
          WHERE property_id = ? AND room_id = ? AND status = 'Checked-in' AND id <> ?`,
        propertyId, res.room_id, reservationId,
      );
      run('UPDATE rooms SET status = ? WHERE id = ?',
        stillOccupied > 0 ? 'Occupied Dirty' : 'Vacant Dirty', res.room_id);
      // Queue the departure clean for today.
      run(
        `INSERT INTO hk_tasks(id, property_id, date, room_id, type, status, priority, created_at)
         VALUES(?,?,?,?,'departure','pending','high',?)
         ON CONFLICT(property_id, date, room_id, type) DO NOTHING`,
        id('hk'), propertyId, prop.business_date, res.room_id, nowIso(),
      );
    }
    if (res.bed_id) run(`UPDATE beds SET status = 'Vacant Dirty' WHERE id = ?`, res.bed_id);

    for (const f of folios) {
      if (f.balanceMinor === 0 && f.status === 'open') {
        run(`UPDATE folios SET status = 'closed', closed_at = ? WHERE id = ?`, nowIso(), f.id);
      }
    }

    if (res.profile_id) {
      run(`UPDATE profiles SET loyalty_points = loyalty_points + ?, updated_at = ? WHERE id = ?`,
        Math.max(0, Math.round(res.total_minor / 100)), nowIso(), res.profile_id);
    }

    audit(actor, {
      action: 'reservation.check-out', entity: 'RESERVATION', entityId: reservationId,
      entityRef: res.confirmation, after: { at: nowIso(), balanceMinor: outstanding },
      elevated: outstanding !== 0,
    });
    notify(propertyId, {
      source: 'Front Desk',
      // A guest who left owing money is the one check-out somebody must see.
      severity: outstanding !== 0 ? 'warn' : 'info',
      title: `Checked out · ${res.guest_name}`,
      message: outstanding !== 0
        ? `${res.confirmation} · left with a balance of ${(outstanding / 100).toFixed(2)}`
        : `${res.confirmation} · folio settled`,
      link: reservationLink(reservationId),
    });
    return getReservationDetail(propertyId, reservationId);
  });
}

/** Post any room night that is due but not yet charged (used at check-out). */
export function postOutstandingNights(
  propertyId: string, actor: Actor, reservationId: string, upToDate: string,
): number {
  const res = getReservation(propertyId, reservationId);
  const folio = ensureFolio(propertyId, reservationId, res.guest_name);
  const due = all<any>(
    `SELECT n.*, rt.name AS room_type_name FROM reservation_nights n
       JOIN room_types rt ON rt.id = n.room_type_id
      WHERE n.reservation_id = ? AND n.posted = 0 AND n.date < ?
      ORDER BY n.date`,
    reservationId, upToDate,
  );
  let posted = 0;
  for (const n of due) {
    postCharge(propertyId, actor, {
      folioId: folio.id,
      code: 'ROOM',
      description: `Room charge — ${n.room_type_name} — ${n.date}`,
      unitMinor: n.rate_minor,
      businessDate: n.date,
      reservationId,
      persons: n.adults + n.children,
      nights: 1,
      taxScope: 'room',
    });
    run('UPDATE reservation_nights SET posted = 1 WHERE id = ?', n.id);
    posted++;
  }
  return posted;
}

export function markNoShow(
  propertyId: string, actor: Actor, reservationId: string, opts: { chargeMinor?: number } = {},
) {
  return tx(() => {
    const prop = property(propertyId);
    const res = getReservation(propertyId, reservationId);
    if (!OPEN_STATUSES.includes(res.status as any)) {
      throw new HttpError(409, `Cannot mark a ${res.status.toLowerCase()} reservation as no-show`);
    }
    run(
      `UPDATE reservations SET status = 'No-show', no_show_at = ?, updated_at = ? WHERE id = ?`,
      nowIso(), nowIso(), reservationId,
    );
    run('DELETE FROM reservation_nights WHERE reservation_id = ? AND posted = 0', reservationId);
    // As on cancellation: Hostelworld keeps the deposit, and a no-show fee
    // must not be quietly eaten by a credit for money the property never saw.
    syncCollectedCredit(propertyId, actor, reservationId);

    const charge = opts.chargeMinor ?? 0;
    if (charge > 0) {
      const folio = ensureFolio(propertyId, reservationId, res.guest_name);
      postCharge(propertyId, actor, {
        folioId: folio.id, code: 'NOSHOW', description: 'No-show charge',
        unitMinor: charge, businessDate: prop.business_date, reservationId, applyTax: true,
      });
    }
    audit(actor, {
      action: 'reservation.no-show', entity: 'RESERVATION', entityId: reservationId,
      entityRef: res.confirmation, after: { chargeMinor: charge },
    });
    notify(propertyId, {
      source: 'Front Desk',
      severity: 'warn',
      title: `No-show · ${res.guest_name}`,
      message: `${res.confirmation} · was due ${res.arrival}`
        + (charge > 0 ? ` · charged ${(charge / 100).toFixed(2)}` : ' · not charged'),
      link: reservationLink(reservationId),
    });
    queueChannelPush(propertyId, res.room_type_id, res.arrival, res.departure, 'no-show');
    return getReservationDetail(propertyId, reservationId);
  });
}

export function addNote(propertyId: string, actor: Actor, reservationId: string, body: string, category = 'general') {
  getReservation(propertyId, reservationId);
  const noteId = id('rnote');
  run(
    'INSERT INTO reservation_notes(id, reservation_id, ts, user_name, category, body) VALUES(?,?,?,?,?,?)',
    noteId, reservationId, nowIso(), actor.userName, category, body,
  );
  return get<any>('SELECT * FROM reservation_notes WHERE id = ?', noteId);
}

// ─── Channel push queue ──────────────────────────────────────
/** Any inventory movement queues an ARI push for the affected dates. */
export function queueChannelPush(
  propertyId: string, roomTypeId: string, from: string, to: string, reason: string,
) {
  const channels = all<{ id: string }>(
    // Queue for channels in error too. A channel is marked `error` by one
    // failed call, and a price or availability change made in that window would
    // otherwise never be recorded at all — not delayed, *lost*. Queueing is
    // free; the drain retries until it lands.
    `SELECT id FROM channels WHERE property_id = ? AND active = 1
       AND status IN ('connected', 'error')`,
    propertyId,
  );
  for (const c of channels) {
    run(
      `INSERT INTO channel_queue(id, property_id, channel_id, room_type_id, date_from, date_to,
                                 scope, reason, status, created_at)
       VALUES(?,?,?,?,?,?,'availability',?,'queued',?)`,
      id('cq'), propertyId, c.id, roomTypeId, from, to, reason, nowIso(),
    );
  }
  // Ask for a drain rather than waiting for the next tick.
  nudgeQueue();
}

// ─── Walk-in helper ──────────────────────────────────────────
export function createWalkIn(propertyId: string, actor: Actor, input: CreateReservationInput) {
  const prop = property(propertyId);
  const res = createReservation(propertyId, actor, {
    ...input,
    arrival: prop.business_date,
    status: 'Confirmed',
    source: input.source ?? 'Walk-in',
    origin: 'pms',
  });
  return checkIn(propertyId, actor, res.id, {
    roomId: input.roomId ?? undefined,
    paymentMinor: input.depositRequiredMinor ?? undefined,
    paymentMethod: input.paymentMethod ?? 'Cash',
  });
}
