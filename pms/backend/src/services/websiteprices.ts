// ─────────────────────────────────────────────────────────────
// Prices for the property's own marketing website.
//
// The Surf & Retreat site is a static build with its own room pages and its own
// booking wizard; it does not use /book. What it needs from the PMS is the one
// thing that changes from week to week — the price — so the front desk edits a
// rate here and the site quotes it on the next page load, with nothing to
// rebuild.
//
// Rooms are matched by room type `code`, which is the website's room id
// (e.g. `mixed-dorm`). Add-ons (surf, skate, yoga, coworking) are not hotel
// inventory, so they live in one setting, keyed by the website's add-on id and
// edited from Booking engine → Website add-ons.
// ─────────────────────────────────────────────────────────────
import { get, parseJson, run } from '../db.ts';
import { HttpError, nowIso } from '../lib/util.ts';
import { fromNightlyMinor, publicProperty, publicRatePlanId, publicRoomTypes } from './publicbooking.ts';

export const WEBSITE_ADDONS_KEY = 'website.addons';

export type AddonGroup = 'surf' | 'skate' | 'yoga' | 'coworking';

export interface WebsiteAddon {
  /** The website's id for this add-on; the price feed is keyed by it. */
  id: string;
  group: AddonGroup;
  name: string;
  /** What the price is for, as the site prints it after the amount: "/ week", "per day". */
  unit: string;
  priceMinor: number;
}

const GROUPS: AddonGroup[] = ['surf', 'skate', 'yoga', 'coworking'];

export function websiteAddons(propertyId: string): WebsiteAddon[] {
  const row = get<{ value: string }>(
    'SELECT value FROM settings WHERE property_id = ? AND key = ?',
    propertyId, WEBSITE_ADDONS_KEY,
  );
  const saved = parseJson<unknown>(row?.value, []);
  if (!Array.isArray(saved)) return [];
  // A malformed row is dropped rather than published: a blank price on the
  // site is worse than the site's own fallback price.
  return saved.filter((a): a is WebsiteAddon =>
    !!a && typeof a.id === 'string' && GROUPS.includes(a.group)
    && typeof a.name === 'string' && typeof a.unit === 'string'
    && Number.isInteger(a.priceMinor) && a.priceMinor >= 0);
}

export function writeWebsiteAddons(propertyId: string, addons: WebsiteAddon[], by: string): void {
  run(
    `INSERT INTO settings(property_id, key, value, updated_at, updated_by)
     VALUES(?,?,?,?,?)
     ON CONFLICT(property_id, key) DO UPDATE SET
       value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    propertyId, WEBSITE_ADDONS_KEY, JSON.stringify(addons), nowIso(), by,
  );
}

/**
 * New prices for existing add-ons. Only the price moves: the list itself is the
 * website's menu, so an id the PMS has never heard of is refused rather than
 * created — it would have nowhere on the site to appear.
 */
export function updateWebsiteAddonPrices(
  propertyId: string,
  prices: unknown,
  by: string,
): WebsiteAddon[] {
  if (!prices || typeof prices !== 'object' || Array.isArray(prices)) {
    throw new HttpError(400, 'prices must be an object of { addonId: priceMinor }');
  }
  const current = websiteAddons(propertyId);
  const byId = new Map(current.map((a) => [a.id, a]));
  for (const [addonId, value] of Object.entries(prices)) {
    if (!byId.has(addonId)) throw new HttpError(400, `Unknown add-on: ${addonId}`);
    if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 10_000_000) {
      throw new HttpError(400, `Price for ${addonId} must be a whole number of minor units`);
    }
  }
  const wanted = prices as Record<string, number>;
  const next = current.map((a) => (a.id in wanted ? { ...a, priceMinor: wanted[a.id] } : a));
  writeWebsiteAddons(propertyId, next, by);
  return next;
}

/**
 * The website's price feed: the lowest nightly rate per room type over the
 * coming weeks (the site says "from $X/night") and each add-on's price, both in
 * major units.
 */
export function websitePrices(propertyId: string) {
  const property = publicProperty(propertyId);
  const ratePlanId = publicRatePlanId(propertyId);
  const rooms: Record<string, number> = {};
  for (const rt of publicRoomTypes(propertyId)) {
    rooms[rt.code] = fromNightlyMinor(propertyId, ratePlanId, rt, property.business_date) / 100;
  }
  const addons: Record<string, number> = {};
  for (const a of websiteAddons(propertyId)) addons[a.id] = a.priceMinor / 100;
  return { currency: property.currency, rooms, addons };
}
