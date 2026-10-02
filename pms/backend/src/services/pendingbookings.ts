// ─────────────────────────────────────────────────────────────
// A booking the website took that nobody at the property has accepted yet.
//
// The public booking engine writes reservations straight into the PMS, but a
// guest filling in a form is not the same event as the property agreeing to
// house them. So a booking-engine booking lands **awaiting confirmation**: it
// is on the reservations list, it has no room picked, and it cannot be checked
// in. A person opens it, chooses the actual room or bed(s), and confirming is
// what turns it into an ordinary reservation.
//
// An OTA booking is the opposite case and is deliberately left alone: the room
// was already sold by somebody else, so it is a plain confirmed booking from
// the moment it arrives.
//
// ── It holds the bed while it waits ──
//
// It did not used to. A pending booking was skipped by the availability engine
// altogether, on the reasoning that the property had not agreed to it yet.
//
// That is an overbooking generator the moment a channel manager is connected,
// and it was observed doing exactly that. The last bed sells on the property's
// own website at 02:00; availability still reports the bed free because the
// booking holds nothing; the next ARI push therefore tells the OTAs one bed is
// free; Booking.com sells it. Two guests, one bed, and the property finds out
// at the front desk.
//
// The bed is now held from the moment the booking is taken — which is what
// every booking engine in the world does, and what a guest who has just read
// "we have your request" reasonably assumes. Nothing about the property's
// decision changed: they still accept or decline it. What changed is that the
// bed is off the market while they decide.
//
// A hold nobody ever answers has to end, or one abandoned form closes a bed
// forever. So a pending booking carries `hold_expires_at`, and once that
// passes it stops holding anything and the sweep in `releaseExpiredHolds`
// cancels it and re-opens the dates to the channels.
//
// This module is the single definition of that state. It imports nothing, so
// every layer — availability, overbooking, the front-desk lists, the tape
// chart, check-in — asks the same question and cannot drift into disagreeing
// about it.
// ─────────────────────────────────────────────────────────────

/**
 * The status an unconfirmed booking sits in.
 *
 * `Tentative` already exists throughout the schema and already means "on the
 * books, not committed", so it is reused rather than a new status invented.
 * What separates these from a Tentative booking a person made by hand is the
 * origin below — a hand-made Tentative booking still holds its inventory.
 */
export const PENDING_STATUS = 'Tentative';

/** `reservations.origin` written by the public booking engine. */
export const PENDING_ORIGIN = 'booking_engine';

/**
 * SQL predicate for "awaiting confirmation", over a `reservations` row that the
 * surrounding query has aliased `r`.
 *
 * Written as a predicate rather than a status list because the state is the
 * pair — status *and* origin. Matching on status alone would quietly strip the
 * inventory from every hand-made Tentative booking in the database.
 */
export const PENDING_SQL = `(r.status = '${PENDING_STATUS}' AND r.origin = '${PENDING_ORIGIN}')`;

/** The opposite of {@link PENDING_SQL}, for queries that count real bookings. */
export const NOT_PENDING_SQL = `NOT ${PENDING_SQL}`;

/**
 * Statuses that consume inventory, as SQL — *before* pending bookings are
 * taken back out again. Kept next to the predicate so the two are read together.
 */
export const LIVE_STATUS_SQL = `('Tentative','Confirmed','Guaranteed','Checked-in')`;

/**
 * "Now", in exactly the format the rest of the system stores a timestamp in.
 *
 * Deliberately not `datetime('now')`. That returns `2026-09-21 00:01:50` — a
 * space where every timestamp written by this codebase has a `T`, because they
 * all come from JavaScript's `toISOString()`. These columns are TEXT and SQLite
 * compares TEXT byte by byte, and `'T'` (0x54) sorts *after* `' '` (0x20), so
 * `hold_expires_at <= datetime('now')` is false for every row, at every hour of
 * every day, forever. A hold written that way never expires and the bed never
 * comes back.
 *
 * `%f` is seconds with milliseconds, which is what makes this byte-identical to
 * `new Date().toISOString()`.
 */
const SQL_NOW_ISO = `strftime('%Y-%m-%dT%H:%M:%fZ','now')`;

/**
 * A pending booking whose hold has run out, as SQL.
 *
 * Written against the clock rather than against a flag somebody has to
 * maintain, so a hold expires exactly when it says it will even if the release
 * sweep is late, the process was stopped overnight, or the machine was asleep.
 * The sweep tidies up; it is not what makes the bed free.
 *
 * A NULL `hold_expires_at` on a pending booking means it was taken before this
 * existed, or by something that did not set one. Those hold indefinitely,
 * which is the safe direction: the bed stays off the market until a person
 * deals with the booking.
 */
export const HOLD_EXPIRED_SQL =
  `(${PENDING_SQL} AND r.hold_expires_at IS NOT NULL AND r.hold_expires_at <= ${SQL_NOW_ISO})`;

/**
 * The full "this reservation is holding a room tonight" test.
 *
 * A live status, minus any pending booking whose hold has run out. Every
 * availability and overbooking query uses this and nothing else.
 *
 * Note what is *not* subtracted here any more: a pending booking inside its
 * hold window counts, exactly like a confirmed one. See the header — that is
 * the whole point.
 */
export const HOLDS_INVENTORY_SQL =
  `(r.status IN ${LIVE_STATUS_SQL} AND NOT ${HOLD_EXPIRED_SQL})`;

/** Whether a reservation row is awaiting confirmation. */
export function isPending(r: { status?: unknown; origin?: unknown } | null | undefined): boolean {
  return !!r && r.status === PENDING_STATUS && r.origin === PENDING_ORIGIN;
}

/** Whether a pending booking's hold has already run out. */
export function holdExpired(
  r: { status?: unknown; origin?: unknown; hold_expires_at?: unknown } | null | undefined,
  now = new Date().toISOString(),
): boolean {
  if (!isPending(r)) return false;
  const until = r?.hold_expires_at;
  return typeof until === 'string' && until !== '' && until <= now;
}
