// ─────────────────────────────────────────────────────────────
// Hostelworld money: what the guest agreed to pay, what Hostelworld already
// took, and what is left for the property to collect.
//
// A Hostelworld booking arrives with one figure the guest saw — the total —
// but the guest does not hand that total over at the desk. Hostelworld
// collects a deposit at booking time and keeps it as its commission; the guest
// pays the rest on arrival. Showing only the total therefore overstates what
// the desk should ask for by exactly the amount Hostelworld has already
// pocketed, and the folio never balances unless somebody remembers.
//
// Three numbers, one rule:
//
//   Total booking price    what the guest agreed to on Hostelworld
//   Hostelworld collected  the deposit Hostelworld took and keeps
//   Business price         Total − Collected: what the property receives
//
// The whole thing is switched on in Configuration → Hostelworld and applies
// **only** to bookings whose OTA is Hostelworld. Every other booking — direct,
// website, Booking.com, Airbnb — is untouched whether the switch is on or off.
//
// When the credit is posted, it goes on the folio as an *adjustment*, never as
// a payment. The till counts payments; this money never crossed the counter,
// and a cash-up that included it would be wrong by the same amount every day.
// An adjustment reduces the guest's balance to the business price, which is
// what check-out needs, without pretending the desk took anything.
// ─────────────────────────────────────────────────────────────
import { all, get, run, tx } from '../db.ts';
import { id, nowIso } from '../lib/util.ts';
import { ensureFolio } from './folio.ts';
import { codeForReferer } from './otas.ts';
import { audit } from './audit.ts';
import type { NormalisedBooking } from '../channels/beds24.ts';

type Actor = { userId: string; userName: string; propertyId: string };

// ─── What Hostelworld said, in full ──────────────────────────
//
// The three figures above are the arithmetic. This is the statement behind
// them, kept on the booking so a screen can show the desk exactly what the
// confirmation email shows the property — booking price, deposit paid,
// balance due, the nights at the prices they sold for — and, beside each
// night, the price that was on sale, so a Hostelworld promotion shows as the
// difference rather than as a number that mysteriously fails to add up.

/** One night of a Hostelworld booking: sold at, and on sale at. */
export interface HostelworldNight {
  date: string;
  /** Beds booked that night. */
  pax: number;
  /** What Hostelworld sold the night for, all beds, minor units. */
  rateMinor: number;
  /**
   * The price on sale on the channel for that night, all beds, when the
   * booking was first read; null when the channel could not be asked.
   */
  sellMinor: number | null;
  rateId: string | null;
}

/** What a Hostelworld promotion took off the nights that were on sale. */
export interface HostelworldPromotion {
  /** The discounted nights at the prices on sale, added up. */
  listMinor: number;
  /** listMinor − what those nights sold for. */
  discountMinor: number;
  /** discount ÷ list, in basis points: 600 = 6% off. */
  percentBp: number;
  /** How many nights were discounted. */
  nights: number;
  /** True when every discounted night was cut by the same percentage. */
  uniform: boolean;
}

export interface HostelworldDetail {
  /** Hostelworld's own booking reference, e.g. "336798-580229521". */
  ref: string | null;
  bookedAt: string | null;
  currency: string | null;
  /** "Total Price" / "Booking Price" on the confirmation email. */
  totalMinor: number;
  /** "Deposit Paid": what Hostelworld collected and keeps. */
  paidMinor: number | null;
  /** "Balance Due - On Arrival": what the desk collects. */
  dueMinor: number | null;
  cancellableUntil: string | null;
  freeCancellableUntil: string | null;
  /** Who collects what, in Beds24's words: "HOTELCOLLECT · Guest pays 45.07 USD …". */
  collectNote: string | null;
  /** Beds24's raw fields, for anyone checking the reading. */
  channel: { priceMinor: number; commissionMinor: number; depositMinor: number };
  nights: HostelworldNight[];
  promotion: HostelworldPromotion | null;
  readAt: string;
}

const toMinor = (major: number) => Math.round(major * 100);

/**
 * The promotion, read off the nights.
 *
 * Only nights with a known sell price count, and only a shortfall counts:
 * a night sold above the calendar price is a rate change since the booking
 * was made, not a negative promotion. The percentage is worked out on the
 * total rather than per night, because a cent of rounding on an eight-dollar
 * bed moves a per-night percentage by a whole point.
 */
export function promotionFrom(nights: HostelworldNight[]): HostelworldPromotion | null {
  const priced = nights.filter((n): n is HostelworldNight & { sellMinor: number } =>
    n.sellMinor !== null && n.sellMinor > 0);
  if (!priced.length) return null;
  const listMinor = priced.reduce((s, n) => s + n.sellMinor, 0);
  const soldMinor = priced.reduce((s, n) => s + n.rateMinor, 0);
  const discountMinor = listMinor - soldMinor;
  if (discountMinor <= 0) return null;
  const percentBp = Math.round((discountMinor * 10_000) / listMinor);
  const cut = priced.filter((n) => n.sellMinor > n.rateMinor);
  const uniform = cut.every((n) =>
    Math.abs(Math.round(((n.sellMinor - n.rateMinor) * 10_000) / n.sellMinor) - percentBp) <= 100);
  return { listMinor, discountMinor, percentBp, nights: cut.length, uniform };
}

/**
 * Build the statement for a booking from what the connector read, plus the
 * channel's calendar prices for the stay when they could be fetched.
 *
 * A sell price already stored for a night is kept when the channel is not
 * asked again: it is what was on sale when the booking was first seen, and a
 * price change on the channel a week later must not rewrite the promotion.
 */
export function buildHostelworldDetail(
  b: NormalisedBooking,
  sellByDate: ReadonlyMap<string, number> | null,
  existing: HostelworldDetail | null = null,
): HostelworldDetail {
  const prior = new Map((existing?.nights ?? []).map((n) => [n.date, n.sellMinor]));
  const nights: HostelworldNight[] = b.nightly.map((n) => {
    const pax = Math.max(1, n.pax);
    const fromChannel = sellByDate?.get(n.date);
    const sellMinor = fromChannel !== undefined && fromChannel > 0
      ? toMinor(fromChannel * pax) : (prior.get(n.date) ?? null);
    return { date: n.date, pax, rateMinor: toMinor(n.rateMajor * pax), sellMinor, rateId: n.rateId };
  });
  return {
    ref: b.otaBookingRef || null,
    bookedAt: b.bookedAt,
    currency: b.currency || null,
    totalMinor: toMinor(b.totalMajor),
    paidMinor: b.depositMajor > 0 ? toMinor(b.depositMajor) : null,
    dueMinor: b.dueMajor === null ? null : toMinor(b.dueMajor),
    cancellableUntil: b.cancellableUntil,
    freeCancellableUntil: b.freeCancellableUntil,
    collectNote: b.collectNote,
    channel: {
      priceMinor: toMinor(b.priceMajor),
      commissionMinor: toMinor(b.commissionMajor),
      depositMinor: toMinor(b.depositMajor),
    },
    nights,
    promotion: promotionFrom(nights),
    readAt: nowIso(),
  };
}

export function parseHostelworldDetail(raw: unknown): HostelworldDetail | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && Array.isArray(v.nights) ? v as HostelworldDetail : null;
  } catch { return null; }
}

/** The same statement, or only re-read at a different time? */
export function sameHostelworldDetail(a: HostelworldDetail | null, b: HostelworldDetail | null): boolean {
  if (!a || !b) return a === b;
  const strip = (d: HostelworldDetail) => JSON.stringify({ ...d, readAt: undefined });
  return strip(a) === strip(b);
}

/**
 * The per-night rates for a stay, in Hostelworld's own spread.
 *
 * Returned only when the statement has a price for every night of the stay
 * and those prices add up to the total exactly; otherwise null, and the
 * caller falls back to `splitTotal`. The guest paid 7.99 for the first night
 * and 9.40 for the rest, and the folio should say so — not 9.19 seven times.
 */
export function channelNightRates(
  detail: HostelworldDetail | null | undefined, dates: string[], totalMinor: number,
): number[] | null {
  if (!detail || !dates.length) return null;
  const byDate = new Map(detail.nights.map((n) => [n.date, n.rateMinor]));
  const rates = dates.map((d) => byDate.get(d));
  if (rates.some((r) => r === undefined)) return null;
  const out = rates as number[];
  return out.reduce((s, r) => s + r, 0) === Math.round(totalMinor) ? out : null;
}

export const HW_SETTING_KEY = 'hostelworld.split';

/** The transaction code the credit posts against. */
export const HW_CREDIT_CODE = 'HWCOLLECT';

/** Where the collected figure comes from. */
export type CollectedMode = 'channel' | 'percent';

export interface HostelworldPolicy {
  /** The master switch. Off, and nothing in this module changes a booking. */
  enabled: boolean;
  /**
   * `channel`: use the deposit Hostelworld reported through Beds24, falling
   * back to `percentBp` of the total when the booking carried none.
   * `percent`: always take `percentBp` of the total.
   */
  collectedMode: CollectedMode;
  /** Basis points of the total: 1500 = 15%. */
  percentBp: number;
  /**
   * Take the total Hostelworld sent as the booking's total, rather than
   * re-pricing the stay from the property's own rate plan. The guest agreed
   * to Hostelworld's number, so that is the one the folio should add up to.
   */
  useChannelTotal: boolean;
  /**
   * Post the collected amount to the folio as a credit, so the balance the
   * desk sees is the business price and check-out closes at zero.
   */
  postCredit: boolean;
}

export const DEFAULT_HW_POLICY: HostelworldPolicy = {
  // Off until the property turns it on: this changes what a booking is worth
  // on every screen, and a PMS should not decide that on a property's behalf.
  enabled: false,
  collectedMode: 'channel',
  percentBp: 1_500,
  useChannelTotal: true,
  postCredit: true,
};

const MODES: CollectedMode[] = ['channel', 'percent'];

function normalise(raw: any): HostelworldPolicy {
  if (!raw || typeof raw !== 'object') return DEFAULT_HW_POLICY;
  return {
    enabled: raw.enabled === true,
    collectedMode: MODES.includes(raw.collectedMode) ? raw.collectedMode : DEFAULT_HW_POLICY.collectedMode,
    percentBp: typeof raw.percentBp === 'number' && Number.isFinite(raw.percentBp)
      ? Math.min(10_000, Math.max(0, Math.round(raw.percentBp)))
      : DEFAULT_HW_POLICY.percentBp,
    useChannelTotal: raw.useChannelTotal === undefined
      ? DEFAULT_HW_POLICY.useChannelTotal : raw.useChannelTotal === true,
    postCredit: raw.postCredit === undefined
      ? DEFAULT_HW_POLICY.postCredit : raw.postCredit === true,
  };
}

export function hostelworldPolicy(propertyId: string): HostelworldPolicy {
  const row = get<{ value: string }>(
    'SELECT value FROM settings WHERE property_id = ? AND key = ?', propertyId, HW_SETTING_KEY);
  if (!row) return DEFAULT_HW_POLICY;
  try { return normalise(JSON.parse(row.value)); } catch { return DEFAULT_HW_POLICY; }
}

export function saveHostelworldPolicy(
  propertyId: string, actor: Actor, input: unknown,
): HostelworldPolicy {
  const before = hostelworldPolicy(propertyId);
  const merged = normalise({ ...before, ...((input ?? {}) as object) });
  run(
    `INSERT INTO settings(property_id, key, value, updated_at, updated_by)
     VALUES(?,?,?,?,?)
     ON CONFLICT(property_id, key) DO UPDATE SET
       value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    propertyId, HW_SETTING_KEY, JSON.stringify(merged), nowIso(), actor.userId,
  );
  audit(actor, {
    action: 'settings.update', entity: 'SETTINGS', entityRef: HW_SETTING_KEY,
    before, after: merged,
  });
  return merged;
}

// ─── Which bookings this applies to ──────────────────────────

/**
 * Is this booking from Hostelworld?
 *
 * Beds24 sends the OTA's trading name as `referer`, which the importer keeps
 * in `ota_channel`; a direct Hostelworld connection would carry it as the
 * channel code instead. Both are folded through the same normaliser the OTA
 * table uses, so "Hostelworld", "hostelworld" and "HostelWorld.com" all count.
 */
export function isHostelworld(otaChannel: string | null | undefined, channelCode: string | null | undefined): boolean {
  const name = (otaChannel && otaChannel.trim()) || (channelCode && channelCode.trim()) || '';
  if (!name) return false;
  if (codeForReferer(name) === 'hostelworld') return true;
  // "Hostelworld.com", "Hostelworld Group" — a trailing word must not hide it.
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith('hostelworld');
}

// ─── The arithmetic ──────────────────────────────────────────

/**
 * What Hostelworld collected, from what the channel said and what the policy
 * says to do when it said nothing.
 *
 * Clamped to the total: a deposit larger than the booking is a data fault,
 * not a negative business price.
 */
export function resolveCollected(
  policy: HostelworldPolicy, totalMinor: number,
  channel: { depositMinor?: number | null; commissionMinor?: number | null } = {},
): number {
  const total = Math.max(0, Math.round(totalMinor));
  const fromPercent = Math.round((total * policy.percentBp) / 10_000);
  let collected: number;
  if (policy.collectedMode === 'percent') {
    collected = fromPercent;
  } else {
    // The deposit is what Hostelworld actually took. Its commission is the
    // same money seen from the other side, so it stands in when the deposit
    // field is empty. Only when Beds24 sent neither does the percentage apply.
    const deposit = Math.round(channel.depositMinor ?? 0);
    const commission = Math.round(channel.commissionMinor ?? 0);
    collected = deposit > 0 ? deposit : commission > 0 ? commission : fromPercent;
  }
  return Math.min(total, Math.max(0, collected));
}

/** Total − collected, never below zero. */
export function businessPrice(totalMinor: number, collectedMinor: number | null | undefined): number {
  return Math.max(0, Math.round(totalMinor) - Math.round(collectedMinor ?? 0));
}

/**
 * Spread one total across the nights of a stay so the nights add up to it
 * exactly. The remainder from rounding lands on the last night rather than
 * being lost, because a folio that is one cent short of the confirmation is
 * a folio somebody has to explain.
 */
export function splitTotal(totalMinor: number, nights: number): number[] {
  if (nights <= 0) return [];
  const total = Math.max(0, Math.round(totalMinor));
  const base = Math.floor(total / nights);
  const out = new Array<number>(nights).fill(base);
  out[nights - 1] += total - base * nights;
  return out;
}

// ─── What the API says about a booking ───────────────────────

export interface HostelworldMoney {
  /** True when the booking came from Hostelworld, whatever the switch says. */
  hostelworld: boolean;
  /** The total the channel reported, when it did. */
  otaTotalMinor: number | null;
  /** What Hostelworld collected. Null when not applicable or not known. */
  otaCollectedMinor: number | null;
  /** Total − collected. Null unless the split applies to this booking. */
  businessMinor: number | null;
  /** The credit already sitting on the folio for this, as a positive number. */
  otaCreditMinor: number;
  /**
   * Hostelworld's full statement — nights, promotion, paid / due, reference,
   * deadlines. A raw fact, shown whether or not the split is switched on;
   * null for other channels and for bookings imported before it was kept.
   */
  detail: HostelworldDetail | null;
}

/**
 * The three figures for one reservation row.
 *
 * The split is reported only when the switch is on and the booking is from
 * Hostelworld with a known collected amount. Everything else gets nulls, so
 * a screen can render one shape and never has to know the rule.
 */
export function hostelworldMoney(row: {
  id: string; property_id: string; total_minor: number;
  ota_channel: string | null; channel_code: string | null;
  ota_total_minor?: number | null; ota_collected_minor?: number | null;
  ota_detail?: string | null;
}, policy?: HostelworldPolicy): HostelworldMoney {
  const hw = isHostelworld(row.ota_channel, row.channel_code);
  const collected = row.ota_collected_minor ?? null;
  // The policy is only read for a Hostelworld row with a figure to show, so
  // shaping a page of ordinary bookings costs no settings lookups at all.
  const applies = hw && collected !== null
    && (policy ?? hostelworldPolicy(row.property_id)).enabled;
  return {
    hostelworld: hw,
    otaTotalMinor: row.ota_total_minor ?? null,
    otaCollectedMinor: applies ? collected : null,
    businessMinor: applies ? businessPrice(row.total_minor, collected) : null,
    otaCreditMinor: applies ? creditOnFolio(row.id) : 0,
    detail: hw ? parseHostelworldDetail(row.ota_detail) : null,
  };
}

function creditOnFolio(reservationId: string): number {
  const row = get<{ t: number }>(
    `SELECT COALESCE(-SUM(l.amount_minor), 0) AS t
       FROM folio_lines l JOIN folios f ON f.id = l.folio_id
      WHERE f.reservation_id = ? AND l.code = ? AND l.kind = 'adjustment' AND l.voided = 0`,
    reservationId, HW_CREDIT_CODE);
  return Math.max(0, row?.t ?? 0);
}

// ─── The folio credit ────────────────────────────────────────

function ensureCreditCode(propertyId: string) {
  const existing = get<{ id: string }>(
    'SELECT id FROM transaction_codes WHERE property_id = ? AND code = ?', propertyId, HW_CREDIT_CODE);
  if (existing) return;
  run(
    `INSERT INTO transaction_codes(id, property_id, code, name, category,
                                   default_price_minor, taxable, active, sort_order)
     VALUES(?,?,?,?,'commission',0,0,1,910)`,
    id('txc'), propertyId, HW_CREDIT_CODE, 'Collected by Hostelworld',
  );
}

interface CreditRow { id: string; folio_id: string; amount_minor: number; folio_status: string }

function existingCredits(reservationId: string): CreditRow[] {
  return all<CreditRow>(
    `SELECT l.id, l.folio_id, l.amount_minor, f.status AS folio_status
       FROM folio_lines l JOIN folios f ON f.id = l.folio_id
      WHERE f.reservation_id = ? AND l.code = ? AND l.kind = 'adjustment' AND l.voided = 0`,
    reservationId, HW_CREDIT_CODE);
}

/**
 * Struck out quietly rather than through `voidLine`: that path warns the
 * bell that money came off a folio, which is right for a person voiding a
 * charge and wrong for the system tidying its own bookkeeping line. The row
 * stays, flagged, so the folio still shows what was there.
 */
function strike(rows: CreditRow[], actor: Actor, reason: string) {
  for (const l of rows) {
    run(
      `UPDATE folio_lines SET voided = 1,
              description = description || ' · VOID (' || ? || ') by ' || ? || ' on ' || ?
        WHERE id = ?`,
      reason, actor.userName, nowIso().slice(0, 10), l.id);
  }
}

/**
 * Make the folio credit match the reservation.
 *
 * Idempotent: called after an import, after a manual edit of the collected
 * amount, after the settings change. If the right line is already there it
 * does nothing; if the amount moved, the old line is struck and a new one
 * posted; if the split no longer applies, the line is struck and nothing
 * replaces it. Returns what it did, for the caller's tally.
 */
export function syncCollectedCredit(
  propertyId: string, actor: Actor, reservationId: string,
  policy: HostelworldPolicy = hostelworldPolicy(propertyId),
): 'posted' | 'replaced' | 'removed' | 'unchanged' {
  return tx(() => {
    const r = get<any>(
      `SELECT id, property_id, guest_name, status, total_minor, ota_channel, channel_code,
              ota_reference, ota_collected_minor
         FROM reservations WHERE id = ? AND property_id = ?`,
      reservationId, propertyId);
    if (!r) return 'unchanged';

    const wanted = policy.enabled && policy.postCredit
      && isHostelworld(r.ota_channel, r.channel_code)
      && !['Cancelled', 'No-show'].includes(r.status)
      && (r.ota_collected_minor ?? 0) > 0
      ? Math.min(r.total_minor, r.ota_collected_minor) : 0;

    const current = existingCredits(reservationId);
    const have = current.reduce((s, l) => s - l.amount_minor, 0);
    if (have === wanted) return 'unchanged';

    // A closed folio is a settled bill; its lines are history and stay put.
    if (current.some((l) => l.folio_status !== 'open')) return 'unchanged';

    strike(current, actor, wanted === 0 ? 'no longer applies' : 'amount changed');
    if (wanted === 0) return 'removed';

    ensureCreditCode(propertyId);
    const folio = ensureFolio(propertyId, reservationId, r.guest_name);
    if (folio.status !== 'open') return 'unchanged';
    const businessDate = get<{ business_date: string }>(
      'SELECT business_date FROM properties WHERE id = ?', propertyId)!.business_date;
    run(
      `INSERT INTO folio_lines(id, property_id, folio_id, reservation_id, business_date, posted_at,
                               kind, code, description, qty, unit_minor, amount_minor, reference,
                               posted_by, voided)
       VALUES(?,?,?,?,?,?,'adjustment',?,?,1,?,?,?,?,0)`,
      id('fl'), propertyId, folio.id, reservationId, businessDate, nowIso(),
      HW_CREDIT_CODE, 'Collected by Hostelworld at booking',
      -wanted, -wanted, r.ota_reference ?? null, actor.userName,
    );
    audit(actor, {
      action: 'folio.hostelworld-credit', entity: 'FOLIO', entityId: folio.id,
      entityRef: `${folio.number} · ${HW_CREDIT_CODE}`,
      before: current.length ? { creditMinor: have } : undefined,
      after: { creditMinor: wanted },
    });
    return current.length ? 'replaced' : 'posted';
  });
}

/**
 * Bring every open Hostelworld booking in line with the policy.
 *
 * Runs after the settings are saved, so switching the credit off strikes the
 * lines and switching it on posts them — the property does not have to open
 * each booking. A booking with no collected figure yet is given one from the
 * policy when `fillMissing` is set, which is what "apply to existing bookings"
 * means: turning the feature on should reach the bookings that were already
 * on the books, not only the ones that arrive afterwards.
 */
export function applyPolicyToBookings(
  propertyId: string, actor: Actor, opts: { fillMissing?: boolean } = {},
): { scanned: number; filled: number; posted: number; replaced: number; removed: number } {
  const policy = hostelworldPolicy(propertyId);
  const rows = all<any>(
    `SELECT id, total_minor, ota_channel, channel_code, ota_total_minor, ota_collected_minor
       FROM reservations
      WHERE property_id = ? AND origin = 'channel'
        AND status IN ('Tentative','Confirmed','Guaranteed','Checked-in')`,
    propertyId);

  const out = { scanned: 0, filled: 0, posted: 0, replaced: 0, removed: 0 };
  for (const r of rows) {
    if (!isHostelworld(r.ota_channel, r.channel_code)) continue;
    out.scanned++;
    if (opts.fillMissing && policy.enabled && r.ota_collected_minor === null) {
      // The channel figure was never stored for this one, so the percentage
      // is the only source — the fallback the policy already names.
      const collected = resolveCollected(policy, r.total_minor);
      run('UPDATE reservations SET ota_collected_minor = ?, updated_at = ? WHERE id = ?',
        collected, nowIso(), r.id);
      out.filled++;
    }
    const did = syncCollectedCredit(propertyId, actor, r.id, policy);
    if (did === 'posted') out.posted++;
    else if (did === 'replaced') out.replaced++;
    else if (did === 'removed') out.removed++;
  }
  return out;
}
