import { useEffect, useSyncExternalStore } from 'react';

/**
 * Live prices from the PMS, so the front desk can change a rate there and the site quotes it without a
 * rebuild. The site is static, so the browser fetches them; until they arrive (or if the PMS is
 * unreachable, or VITE_PMS_PRICES_URL isn't set) the prices bundled in data.ts are shown instead.
 *
 * The PMS answers GET VITE_PMS_PRICES_URL with JSON keyed by the site's own ids (see data.ts):
 *
 *   {
 *     "currency": "USD",
 *     "rooms":  { "mixed-dorm": 12, "double-ac-ensuite": 38, ... },          // per night (dorms: per bed)
 *     "addons": { "beginner-week": 149, "skate-lesson": 15, "day-pass": 8, ... }
 *   }
 *
 * Amounts are in major units. Any id left out keeps its bundled price.
 */
export interface PmsPrices {
  currency: string;
  rooms: Record<string, number>;
  addons: Record<string, number>;
}

const PRICES_URL = import.meta.env.VITE_PMS_PRICES_URL;
const FALLBACK_CURRENCY = 'USD';

let prices: PmsPrices | null = null;
let started = false;
const listeners = new Set<() => void>();

/** Keeps only finite, non-negative numbers, so a bad row can't blank or break a price. */
const amounts = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => Number.isFinite(entry[1]) && entry[1] >= 0),
  );
};

const parse = (data: unknown): PmsPrices | null => {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  return {
    currency: typeof d.currency === 'string' && /^[A-Z]{3}$/.test(d.currency) ? d.currency : FALLBACK_CURRENCY,
    rooms: amounts(d.rooms),
    addons: amounts(d.addons),
  };
};

/** Fetches once per page load; later calls are no-ops. */
const loadPmsPrices = () => {
  if (started || !PRICES_URL || typeof window === 'undefined') return;
  started = true;
  fetch(PRICES_URL, { headers: { accept: 'application/json' } })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const parsed = parse(data);
      if (!parsed) return;
      prices = parsed;
      listeners.forEach((notify) => notify());
    })
    // Unreachable PMS: keep the bundled prices.
    .catch(() => undefined);
};

const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => listeners.delete(notify);
};

/** Starts the fetch and re-renders the caller when live prices arrive. Prerendered HTML uses bundled prices. */
export const usePmsPrices = () => {
  useEffect(loadPmsPrices, []);
  return useSyncExternalStore(
    subscribe,
    () => prices,
    () => null,
  );
};

/** The PMS price for one item, or `fallback` when the PMS hasn't sent one. */
export const priceFor = (group: 'rooms' | 'addons', id: string, fallback: number) => prices?.[group][id] ?? fallback;

export const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: prices?.currency ?? FALLBACK_CURRENCY,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
