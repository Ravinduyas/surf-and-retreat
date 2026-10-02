// ─────────────────────────────────────────────────────────────
// Exchange rates.
//
// A guest with dollars in their hand at a property that keeps its books in
// euro is an ordinary evening at a front desk, and the desk cannot stop taking
// money because a website is slow. So rates are **cached**: fetched from a
// public feed in the background, written to `fx_rates`, and read from the
// database on the hot path. A payment taken during an outage still has a rate
// to be taken at — the last one known, stamped with when it was fetched so
// nobody mistakes it for today's — and the cashier can override it outright
// when the house rate differs.
//
// One direction, everywhere: `rate` is **how many units of the property's own
// currency one unit of the foreign currency buys**. USD 50 at a rate of 0.92
// is EUR 46. Storing it the other way round is the kind of thing that reads
// fine and is wrong by a factor of the rate squared.
//
// The feed is open.er-api.com: no key, no signup, 160-odd currencies including
// the ones a Sri Lankan property is handed daily. Google publishes no rate API
// — what a search shows comes from licensed feeds that may not be scraped — so
// "the Google rate" is not something any system can honestly promise.
// ─────────────────────────────────────────────────────────────
import { all, get, run } from '../db.ts';
import { nowIso } from '../lib/util.ts';

/** Where the rates come from. Recorded on every row it writes. */
const SOURCE = 'open.er-api.com';
const ENDPOINT = 'https://open.er-api.com/v6/latest';

/**
 * How old a cached rate may be before it is refetched.
 *
 * The feed itself updates about once a day, so asking more often than this
 * buys nothing; the desk still sees the age of what it is using.
 */
const TTL_MS = 6 * 60 * 60 * 1000;

/** A rate older than this is called out on screen rather than used quietly. */
const STALE_MS = 48 * 60 * 60 * 1000;

const FETCH_TIMEOUT_MS = 6000;

export interface FxRate {
  base: string;
  currency: string;
  /** Units of `base` per one unit of `currency`. */
  rate: number;
  fetchedAt: string;
  source: string;
  /** True when this is old enough that the desk should be told. */
  stale: boolean;
}

const clean = (code: unknown): string =>
  (typeof code === 'string' ? code.trim().toUpperCase() : '').slice(0, 3);

const ageMs = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Date.now() - t : Number.POSITIVE_INFINITY;
};

const row = (base: string, currency: string) => get<{
  rate: number; fetched_at: string; source: string;
}>('SELECT rate, fetched_at, source FROM fx_rates WHERE base = ? AND currency = ?', base, currency);

/**
 * The rate to convert `currency` into `base`, from the cache.
 *
 * A currency against itself is 1 and is never fetched — a property whose own
 * currency went missing from a feed would otherwise be unable to take a
 * payment in it.
 */
export function cachedRate(base: string, currency: string): FxRate | null {
  const b = clean(base);
  const c = clean(currency);
  if (!b || !c) return null;
  if (b === c) {
    return { base: b, currency: c, rate: 1, fetchedAt: nowIso(), source: 'identity', stale: false };
  }
  const r = row(b, c);
  if (!r || !(r.rate > 0)) return null;
  return {
    base: b,
    currency: c,
    rate: r.rate,
    fetchedAt: r.fetched_at,
    source: r.source,
    stale: ageMs(r.fetched_at) > STALE_MS,
  };
}

/** Everything cached against one base, newest fetch first. */
export function cachedRates(base: string): FxRate[] {
  const b = clean(base);
  return all<{ currency: string; rate: number; fetched_at: string; source: string }>(
    'SELECT currency, rate, fetched_at, source FROM fx_rates WHERE base = ? ORDER BY currency', b,
  ).map((r) => ({
    base: b,
    currency: r.currency,
    rate: r.rate,
    fetchedAt: r.fetched_at,
    source: r.source,
    stale: ageMs(r.fetched_at) > STALE_MS,
  }));
}

/** True when nothing has been fetched for this base inside the TTL. */
export function needsRefresh(base: string): boolean {
  const newest = get<{ fetched_at: string }>(
    'SELECT MAX(fetched_at) AS fetched_at FROM fx_rates WHERE base = ?', clean(base),
  )?.fetched_at;
  return !newest || ageMs(newest) > TTL_MS;
}

async function withTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch the feed for one base currency and write what came back.
 *
 * The feed answers "one BASE buys this much of X"; the cache holds the inverse,
 * because the question at a till is always "the guest gave me X — what is that
 * worth to us". Rows are replaced one by one rather than the table being
 * emptied first: a feed that answers with half a list should leave the other
 * half of yesterday's rates in place, not delete them.
 *
 * Returns how many rates were written. Never throws for a network or feed
 * failure — the caller falls back to the cache, which is the entire point of
 * there being one.
 */
export async function refreshRates(base: string): Promise<{ written: number; error?: string }> {
  const b = clean(base);
  if (!b) return { written: 0, error: 'No property currency to convert into' };
  try {
    const res = await withTimeout(`${ENDPOINT}/${encodeURIComponent(b)}`);
    if (!res.ok) return { written: 0, error: `Rate feed answered ${res.status}` };
    const body = await res.json() as { result?: string; rates?: Record<string, unknown> };
    if (body.result && body.result !== 'success') {
      return { written: 0, error: 'Rate feed reported a failure' };
    }
    const rates = body.rates ?? {};
    const at = nowIso();
    let written = 0;
    for (const [code, value] of Object.entries(rates)) {
      const currency = clean(code);
      const perBase = typeof value === 'number' ? value : Number(value);
      // `perBase` is X per one base unit; the cache wants base per one X.
      if (!currency || !Number.isFinite(perBase) || perBase <= 0) continue;
      run(
        `INSERT INTO fx_rates(base, currency, rate, fetched_at, source)
         VALUES(?,?,?,?,?)
         ON CONFLICT(base, currency) DO UPDATE SET
           rate = excluded.rate, fetched_at = excluded.fetched_at, source = excluded.source`,
        b, currency, 1 / perBase, at, SOURCE,
      );
      written += 1;
    }
    return { written };
  } catch (e) {
    return { written: 0, error: e instanceof Error ? e.message : 'Rate feed unreachable' };
  }
}

/** Refresh only when the cache has gone past its TTL. */
export async function refreshIfStale(base: string): Promise<{ written: number; error?: string }> {
  if (!needsRefresh(base)) return { written: 0 };
  return refreshRates(base);
}

/**
 * Convert minor units of `currency` into minor units of `base`.
 *
 * Both sides are integers — money is never a float here — and the rate is
 * applied once, at the boundary, so the rest of the system keeps working in
 * whole minor units of the property's own currency.
 */
export function toBaseMinor(amountMinor: number, rate: number): number {
  return Math.round(amountMinor * rate);
}

/** The other direction: what a property-currency amount is in `currency`. */
export function fromBaseMinor(baseMinor: number, rate: number): number {
  if (!(rate > 0)) return 0;
  return Math.round(baseMinor / rate);
}
