// ─────────────────────────────────────────────────────────────
// What the booking page asks a guest to pay, and when.
//
// The booking page took no money and said nothing about money. For a hostel
// that is the single most expensive thing about running direct: an OTA booking
// carries a card the property can charge, and a direct booking that asks for
// nothing carries no cost to abandon. The no-show rate on the two is not
// comparable, which is exactly the argument an OTA makes when it explains its
// commission.
//
// This module decides the deposit and says it plainly. It deliberately does
// **not** take a card: there is no payment gateway in this system, and a page
// that collected card numbers into a PMS would be a compliance problem rather
// than a feature. What it does instead is state the amount, record it against
// the reservation as money owed, and let the property collect it the way they
// already collect money — a link, a transfer, or on arrival.
//
// `deposit_required_minor` on the reservation is where it lands, which is a
// column the folio and the arrivals list already read. Nothing new had to be
// invented for the money to be visible; it simply was never filled in.
// ─────────────────────────────────────────────────────────────
import { get, run } from '../db.ts';
import { nowIso } from '../lib/util.ts';

export const DEPOSIT_SETTING_KEY = 'booking_engine.deposit';

/**
 * How much of the stay is due before arrival.
 *
 * Four modes rather than a free-text rule, because every one of them is a
 * sentence a guest has to understand on a booking page, and a rule engine
 * nobody can read produces a page nobody trusts.
 */
export type DepositMode = 'none' | 'percent' | 'first_night' | 'full';

export interface DepositPolicy {
  mode: DepositMode;
  /** Basis points of the grand total. Only read when mode is `percent`. */
  percentBp: number;
  /**
   * What the guest is told about paying it. Shown under the total, so it is
   * the property's own words rather than a generic line: "we will email you a
   * payment link" and "pay the balance in cash on arrival" are both true for
   * somebody and neither is true for everybody.
   */
  message: string;
  /** Which ways of paying are named on the page. Display only. */
  methods: string[];
}

export const DEFAULT_DEPOSIT: DepositPolicy = {
  // Off by default. Turning it on is a commercial decision with a real
  // trade-off — a deposit cuts no-shows and also cuts bookings — and a PMS
  // should not make that choice on a property's behalf.
  mode: 'none',
  percentBp: 2_000,
  message: 'We will confirm by email. Nothing is charged now.',
  methods: ['Cash', 'Card on arrival'],
};

const MODES: DepositMode[] = ['none', 'percent', 'first_night', 'full'];

export function depositPolicy(propertyId: string): DepositPolicy {
  const row = get<{ value: string }>(
    'SELECT value FROM settings WHERE property_id = ? AND key = ?',
    propertyId, DEPOSIT_SETTING_KEY);
  if (!row) return DEFAULT_DEPOSIT;
  let raw: any;
  try { raw = JSON.parse(row.value); } catch { return DEFAULT_DEPOSIT; }
  if (!raw || typeof raw !== 'object') return DEFAULT_DEPOSIT;

  // Merged over the defaults rather than replaced: a half-written setting must
  // not leave the page with no wording at all under a number it is asking for.
  return {
    mode: MODES.includes(raw.mode) ? raw.mode : DEFAULT_DEPOSIT.mode,
    percentBp: typeof raw.percentBp === 'number' && raw.percentBp >= 0 && raw.percentBp <= 10_000
      ? Math.round(raw.percentBp) : DEFAULT_DEPOSIT.percentBp,
    message: typeof raw.message === 'string' && raw.message.trim()
      ? raw.message.trim().slice(0, 400) : DEFAULT_DEPOSIT.message,
    methods: Array.isArray(raw.methods)
      ? raw.methods.filter((m: unknown): m is string => typeof m === 'string' && !!m.trim())
        .map((m: string) => m.trim().slice(0, 40)).slice(0, 8)
      : DEFAULT_DEPOSIT.methods,
  };
}

export function saveDepositPolicy(
  propertyId: string, actor: { userId: string }, input: unknown,
): DepositPolicy {
  const raw = (input ?? {}) as any;
  const merged: DepositPolicy = {
    mode: MODES.includes(raw.mode) ? raw.mode : DEFAULT_DEPOSIT.mode,
    percentBp: typeof raw.percentBp === 'number'
      ? Math.min(10_000, Math.max(0, Math.round(raw.percentBp))) : DEFAULT_DEPOSIT.percentBp,
    message: typeof raw.message === 'string' && raw.message.trim()
      ? raw.message.trim().slice(0, 400) : DEFAULT_DEPOSIT.message,
    methods: Array.isArray(raw.methods)
      ? raw.methods.filter((m: unknown): m is string => typeof m === 'string' && !!m.trim())
        .map((m: string) => m.trim().slice(0, 40)).slice(0, 8)
      : DEFAULT_DEPOSIT.methods,
  };
  run(
    `INSERT INTO settings(property_id, key, value, updated_at, updated_by)
     VALUES(?,?,?,?,?)
     ON CONFLICT(property_id, key) DO UPDATE SET
       value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    propertyId, DEPOSIT_SETTING_KEY, JSON.stringify(merged), nowIso(), actor.userId,
  );
  return merged;
}

export interface DepositQuote {
  mode: DepositMode;
  /** What is due before arrival. */
  dueNowMinor: number;
  /** What is left to pay at the property. */
  dueOnArrivalMinor: number;
  /** A label for the amount: "20% deposit", "First night", "Full amount". */
  label: string;
  message: string;
  methods: string[];
}

/**
 * Split one stay's total into what is owed now and what is owed on arrival.
 *
 * `firstNightMinor` is passed rather than derived because the caller already
 * has the nightly breakdown and re-deriving it here would mean this module
 * guessing at occupancy pricing, taxes and length-of-stay rules that
 * `quoteStay` has already resolved correctly.
 *
 * Clamped to the total at both ends. A first-night deposit on a one-night stay
 * is the whole booking, and a percentage that somebody typed as 150% should
 * charge the stay, not more than it.
 */
export function quoteDeposit(
  policy: DepositPolicy, totalMinor: number, firstNightMinor: number,
): DepositQuote {
  const total = Math.max(0, Math.round(totalMinor));
  let due = 0;
  let label = '';

  switch (policy.mode) {
    case 'percent':
      due = Math.round((total * policy.percentBp) / 10_000);
      label = `${(policy.percentBp / 100).toFixed(policy.percentBp % 100 ? 1 : 0)}% deposit`;
      break;
    case 'first_night':
      due = Math.max(0, Math.round(firstNightMinor));
      label = 'First night';
      break;
    case 'full':
      due = total;
      label = 'Full amount';
      break;
    case 'none':
    default:
      due = 0;
      label = 'Nothing now';
      break;
  }

  due = Math.min(total, Math.max(0, due));
  return {
    mode: policy.mode,
    dueNowMinor: due,
    dueOnArrivalMinor: total - due,
    label,
    message: policy.message,
    methods: policy.methods,
  };
}
