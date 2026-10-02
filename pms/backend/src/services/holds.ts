// ─────────────────────────────────────────────────────────────
// The hold a website booking puts on a bed, and letting it go again.
//
// A booking taken by the property's own booking page holds its bed from the
// moment it is made — see `pendingbookings.ts` for why — but the property has
// not agreed to it yet, so the hold cannot be permanent. One abandoned form
// would otherwise close a bed for good.
//
// So every pending booking carries an expiry. Two things act on it:
//
//   · `HOLDS_INVENTORY_SQL` stops counting it the instant the clock passes,
//     whether or not anything is running. That is what makes the bed free.
//   · `releaseExpiredHolds` below then tidies up: it cancels the booking, says
//     so in the audit trail, and pushes the dates back open on the channels.
//
// The order matters. The sweep is bookkeeping, not the mechanism — a machine
// that was asleep all night still wakes up with the right availability.
// ─────────────────────────────────────────────────────────────
import { all, get, run, tx } from '../db.ts';
import { id, nowIso } from '../lib/util.ts';
import { audit } from './audit.ts';
import { notify } from './notify.ts';
import { queueChannelPush } from './reservations.ts';
import { PENDING_ORIGIN, PENDING_STATUS } from './pendingbookings.ts';

/** Where the property's chosen window lives. */
export const HOLD_SETTING_KEY = 'booking_engine.hold_hours';

/**
 * How long a website booking holds its bed by default.
 *
 * Long enough that a property checking its email each morning does not lose
 * bookings overnight, short enough that an abandoned form is back on sale the
 * same day.
 */
export const DEFAULT_HOLD_HOURS = 24;

/** The range the setting is allowed to take: one hour to two weeks. */
export const MIN_HOLD_HOURS = 1;
export const MAX_HOLD_HOURS = 336;

/**
 * The property's hold window, in hours.
 *
 * Clamped rather than trusted. This value decides how long a bed is off the
 * market, and a zero or a negative from a bad write would expire every hold the
 * instant it was created — a booking engine that holds nothing, which is the
 * bug this whole module exists to fix.
 */
export function holdWindowHours(propertyId: string): number {
  const row = get<{ value: string }>(
    'SELECT value FROM settings WHERE property_id = ? AND key = ?', propertyId, HOLD_SETTING_KEY);
  if (!row) return DEFAULT_HOLD_HOURS;
  let parsed: unknown;
  try { parsed = JSON.parse(row.value); } catch { return DEFAULT_HOLD_HOURS; }
  const n = typeof parsed === 'number' ? parsed : Number(parsed);
  if (!Number.isFinite(n)) return DEFAULT_HOLD_HOURS;
  return Math.min(MAX_HOLD_HOURS, Math.max(MIN_HOLD_HOURS, Math.round(n)));
}

export function setHoldWindowHours(propertyId: string, actor: { userId: string }, hours: number) {
  const clamped = Math.min(MAX_HOLD_HOURS, Math.max(MIN_HOLD_HOURS, Math.round(hours)));
  run(
    `INSERT INTO settings(property_id, key, value, updated_at, updated_by)
     VALUES(?,?,?,?,?)
     ON CONFLICT(property_id, key) DO UPDATE SET
       value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    propertyId, HOLD_SETTING_KEY, JSON.stringify(clamped), nowIso(), actor.userId,
  );
  return clamped;
}

interface ExpiredRow {
  id: string;
  property_id: string;
  confirmation: string;
  guest_name: string;
  room_type_id: string;
  arrival: string;
  departure: string;
  parent_id: string | null;
  hold_expires_at: string;
}

/**
 * Cancel every website booking whose hold has run out.
 *
 * Runs over every property at once, because it is a timer rather than
 * something a person asked for.
 *
 * A party booked across several beds is several reservations sharing a
 * `parent_id`, and they expire together by construction: they were written in
 * one transaction with the same expiry. They are cancelled one by one all the
 * same — a partially expired party is not a thing this should ever produce,
 * but if the data ever said so, cancelling what has actually expired is the
 * honest answer.
 */
export function releaseExpiredHolds(now = nowIso()): {
  released: number; reservations: string[];
} {
  const expired = all<ExpiredRow>(
    `SELECT id, property_id, confirmation, guest_name, room_type_id, arrival, departure,
            parent_id, hold_expires_at
       FROM reservations
      WHERE status = ? AND origin = ?
        AND hold_expires_at IS NOT NULL AND hold_expires_at <= ?
      ORDER BY hold_expires_at`,
    PENDING_STATUS, PENDING_ORIGIN, now,
  );
  if (!expired.length) return { released: 0, reservations: [] };

  const released: string[] = [];
  const touched = new Map<string, { propertyId: string; roomTypeId: string; from: string; to: string }>();

  for (const r of expired) {
    try {
      tx(() => {
        run(
          `UPDATE reservations
              SET status = 'Cancelled',
                  cancelled_at = ?,
                  cancel_reason = ?,
                  -- Cleared so the row can never be picked up twice, and so a
                  -- cancelled booking carries no stale promise of a bed.
                  hold_expires_at = NULL,
                  updated_at = ?
            WHERE id = ? AND status = ? AND origin = ?`,
          now, 'Hold expired — not confirmed in time', now, r.id, PENDING_STATUS, PENDING_ORIGIN,
        );
        audit(
          { userId: 'system', userName: 'Booking hold', propertyId: r.property_id },
          {
            action: 'reservation.hold-expired', entity: 'RESERVATION', entityId: r.id,
            entityRef: r.confirmation,
            before: { status: PENDING_STATUS, holdExpiresAt: r.hold_expires_at },
            after: { status: 'Cancelled' },
          },
        );
      });
      released.push(r.confirmation);
      touched.set(`${r.property_id}|${r.room_type_id}|${r.arrival}|${r.departure}`, {
        propertyId: r.property_id, roomTypeId: r.room_type_id, from: r.arrival, to: r.departure,
      });
    } catch (e) {
      process.stderr.write(
        `[${now}] releasing hold ${r.confirmation} failed: ${e instanceof Error ? e.message : e}\n`);
    }
  }

  // Re-open the dates, once per room type and range rather than once per bed:
  // a party of four in one dorm is one push, not four identical ones.
  for (const t of touched.values()) {
    try {
      queueChannelPush(t.propertyId, t.roomTypeId, t.from, t.to, 'booking-engine.hold-expired');
    } catch (e) {
      process.stderr.write(
        `[${now}] re-opening ${t.roomTypeId} failed: ${e instanceof Error ? e.message : e}\n`);
    }
  }

  // One notification per property, naming the bookings. A property that loses
  // four bookings overnight should see that as one line on the bell rather
  // than four, and should see it at all — a booking quietly deleted by a timer
  // is the kind of thing that erodes trust in the system.
  const byProperty = new Map<string, string[]>();
  for (const r of expired) {
    if (!released.includes(r.confirmation)) continue;
    byProperty.set(r.property_id, [...(byProperty.get(r.property_id) ?? []), r.confirmation]);
  }
  for (const [propertyId, refs] of byProperty) {
    try {
      notify(propertyId, {
        source: 'Reservations',
        severity: 'warn',
        title: refs.length === 1
          ? `Website booking ${refs[0]} expired`
          : `${refs.length} website bookings expired`,
        message: 'Not confirmed within the hold window, so the beds are back on sale. '
          + `${refs.slice(0, 5).join(', ')}${refs.length > 5 ? '…' : ''}`,
        link: '#/reservations',
      });
    } catch {
      // A notification that cannot be written must not undo a release that
      // already happened.
    }
  }

  return { released: released.length, reservations: released };
}

/** Bookings whose hold is still running, soonest to expire first. */
export function activeHolds(propertyId: string) {
  return all<ExpiredRow & { total_minor: number; email: string | null }>(
    `SELECT id, property_id, confirmation, guest_name, email, room_type_id, arrival, departure,
            parent_id, hold_expires_at, total_minor
       FROM reservations
      WHERE property_id = ? AND status = ? AND origin = ?
        AND hold_expires_at IS NOT NULL AND hold_expires_at > ?
        AND parent_id IS NULL
      ORDER BY hold_expires_at`,
    propertyId, PENDING_STATUS, PENDING_ORIGIN, nowIso(),
  ).map((r) => ({
    id: r.id,
    confirmation: r.confirmation,
    guestName: r.guest_name,
    email: r.email,
    arrival: r.arrival,
    departure: r.departure,
    totalMinor: r.total_minor,
    expiresAt: r.hold_expires_at,
    minutesLeft: Math.max(0, Math.round(
      (Date.parse(r.hold_expires_at) - Date.now()) / 60_000)),
  }));
}

/** Unused by the server; kept so a script can mint an id the same way. */
export const newHoldId = () => id('hold');
