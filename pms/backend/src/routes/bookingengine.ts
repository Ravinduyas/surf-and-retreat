// The public booking engine's read surface: what the website may show a guest
// before they have identified themselves. Writes live in reservations.ts.
import { router, sendHtml, type Ctx } from '../lib/http.ts';
import { assertDate, int, nowIso, str } from '../lib/util.ts';
import { run, scalar } from '../db.ts';
import { config } from '../config.ts';
import { audit } from '../services/audit.ts';
import {
  publicAvailability, publicCatalog, publicProperty, publicRoomTypes, resolvePublicProperty,
} from '../services/publicbooking.ts';
import { bookingPageHtml, bookingPageSettings } from '../services/bookingpage.ts';
import { updateWebsiteAddonPrices, websiteAddons, websitePrices } from '../services/websiteprices.ts';
import { depositPolicy, saveDepositPolicy } from '../services/bookingmoney.ts';
import {
  activeHolds, holdWindowHours, setHoldWindowHours, MIN_HOLD_HOURS, MAX_HOLD_HOURS,
} from '../services/holds.ts';

/** The property whose configuration the signed-in user is working on. */
const pid = (ctx: Ctx) => ctx.auth.propertyId;

const propertyFor = (ctx: Ctx) => resolvePublicProperty({
  propertyId: ctx.query.get('propertyId') ?? ctx.body?.propertyId,
  propertyCode: ctx.query.get('propertyCode') ?? ctx.body?.propertyCode,
});

/**
 * Rooms, rates, occupancy limits, currency and extras, straight from the PMS.
 * The site draws its whole booking step from this rather than from a table
 * bundled into its own build.
 */
router.get('/api/public/booking-engine/catalog', (ctx: Ctx) => publicCatalog(propertyFor(ctx)),
  { perm: null, allowNoProperty: true });

/**
 * Live price and availability per room type for one set of dates.
 *
 * `model` is what the guest chose off the first step. It decides which rate
 * plan answers, because a package is priced by its own plan rather than by the
 * room rate — so the totals here move when the guest switches between "rooms"
 * and "rooms + surf" without a single date changing.
 */
router.get('/api/public/booking-engine/availability', (ctx: Ctx) => publicAvailability(
  propertyFor(ctx),
  {
    checkIn: assertDate(ctx.query.get('checkIn'), 'checkIn'),
    checkOut: assertDate(ctx.query.get('checkOut'), 'checkOut'),
    adults: int(ctx.query.get('adults') ?? 1, 'adults', { min: 1, max: 40 }),
    children: int(ctx.query.get('children') ?? 0, 'children', { min: 0, max: 20 }),
    // An unknown model is not an error: it falls back to the room rate plan,
    // which is the right answer for a site build older than the packages.
    model: ctx.query.get('model'),
  },
), { perm: null, allowNoProperty: true });

/**
 * Prices for the property's own website (see services/websiteprices.ts): the
 * "from" nightly rate per room type, keyed by room type code, and each website
 * add-on's price. Read-only and public, like the catalog.
 */
router.get('/api/public/website-prices', (ctx: Ctx) => websitePrices(propertyFor(ctx)),
  { perm: null, allowNoProperty: true });

/** The website's add-ons with their prices, for the screen that edits them. */
router.get('/api/booking-engine/website-addons', (ctx: Ctx) => ({
  currency: publicProperty(pid(ctx)).currency,
  addons: websiteAddons(pid(ctx)),
}), { perm: 'config.read' });

/** New prices for existing add-ons: `{ prices: { addonId: priceMinor } }`. */
router.patch('/api/booking-engine/website-addons', (ctx: Ctx) => {
  const propertyId = pid(ctx);
  const before = websiteAddons(propertyId);
  const after = updateWebsiteAddonPrices(propertyId, ctx.body?.prices, ctx.auth.userId);
  audit(ctx.auth, {
    action: 'website-addons.update', entity: 'SETTING', entityId: 'website.addons',
    entityRef: 'Website add-on prices', before, after,
  }, ctx.ip);
  return { currency: publicProperty(propertyId).currency, addons: after };
}, { perm: 'config.write' });

/* ------------------------------------------------------------- the page -- */

/**
 * The booking page itself.
 *
 * Setting up rooms is the whole of setting up a booking engine: this address
 * works the moment a property has room types, because the page reads them
 * rather than carrying a copy. There is no build, no deploy and no second
 * service — the link below is live as soon as the API is.
 *
 *   /book                   the property, when there is only one
 *   /book?propertyCode=X    named, for an installation with several
 */
router.get('/book', (ctx: Ctx) => {
  sendHtml(ctx.res, 200, bookingPageHtml(propertyFor(ctx)));
}, { perm: null, allowNoProperty: true });

/**
 * Everything the PMS needs to show the property its own booking link: the
 * address to share, whether the page is on, and whether the rooms behind it
 * are actually sellable.
 *
 * The readiness checks are the point. A link that opens onto "no rooms are on
 * sale yet" is worse than no link, and the property has no way of knowing
 * without opening it — so the PMS says what is missing instead.
 */
router.get('/api/booking-engine/link', (ctx: Ctx) => {
  const propertyId = pid(ctx);
  const settings = bookingPageSettings(propertyId);
  const property = publicProperty(propertyId);
  const several = scalar<number>('SELECT count(*) AS n FROM properties WHERE active = 1') > 1;

  const roomTypes = publicRoomTypes(propertyId);
  const sellableUnits = scalar<number>(
    `SELECT coalesce(sum(CASE WHEN rt.kind = 'dorm'
              THEN (SELECT count(*) FROM beds b WHERE b.room_id = r.id AND b.active = 1)
              ELSE 1 END), 0) AS n
       FROM rooms r JOIN room_types rt ON rt.id = r.room_type_id
      WHERE r.property_id = ? AND r.active = 1 AND rt.active = 1`,
    propertyId,
  );
  const pricedAhead = scalar<number>(
    `SELECT count(DISTINCT date) AS n FROM rate_calendar
      WHERE property_id = ? AND date >= ?`,
    propertyId, property.business_date,
  );

  // Ordered worst-first: the top item is the one thing to go and fix.
  const blocking = [
    roomTypes.length === 0
      ? 'No room types are set up. Add them in Configuration → Room types.' : null,
    sellableUnits === 0
      ? 'No rooms or beds exist yet. Add them in Configuration → Rooms.' : null,
    pricedAhead === 0
      ? 'No rates are loaded for any future date. Set them in Rates & Inventory.' : null,
  ].filter((x): x is string => x !== null);

  const base = config.bookingSiteUrl.replace(/\/+$/, '');
  return {
    enabled: settings.enabled,
    url: `${base}/book${several ? `?propertyCode=${encodeURIComponent(property.code)}` : ''}`,
    tagline: settings.tagline,
    intro: settings.intro,
    property: { code: property.code, name: property.name, currency: property.currency },
    readiness: {
      ready: blocking.length === 0,
      roomTypes: roomTypes.length,
      sellableUnits,
      pricedDaysAhead: pricedAhead,
      blocking,
    },
  };
}, { perm: 'config.read' });

/** Switch the page on or off, and edit the two lines of copy at the top of it. */
router.patch('/api/booking-engine/link', (ctx: Ctx) => {
  const propertyId = pid(ctx);
  const b = ctx.body ?? {};
  const before = bookingPageSettings(propertyId);

  const put = (key: string, value: unknown) => run(
    `INSERT INTO settings(property_id, key, value, updated_at, updated_by)
     VALUES(?,?,?,?,?)
     ON CONFLICT(property_id, key) DO UPDATE SET
       value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    propertyId, key, JSON.stringify(value), nowIso(), ctx.auth.userId,
  );

  if (typeof b.enabled === 'boolean') put('booking_engine.enabled', b.enabled);
  if (typeof b.tagline === 'string') put('booking_engine.tagline', str(b.tagline, 'tagline', { max: 140 }));
  if (typeof b.intro === 'string') put('booking_engine.intro', str(b.intro, 'intro', { max: 400 }));

  const after = bookingPageSettings(propertyId);
  audit(ctx.auth, {
    action: 'booking-engine.update', entity: 'SETTING', entityId: 'booking_engine',
    entityRef: 'Booking page', before, after,
  }, ctx.ip);
  return after;
}, { perm: 'config.write' });

/* ---------------------------------------------------------- the money -- */

/**
 * What the booking page asks a guest to pay, and how long a booking holds its
 * bed. Two settings, one screen, because they are the same decision seen from
 * two sides: how much friction to put in front of a direct booking, and how
 * long to protect one once it arrives.
 */
router.get('/api/booking-engine/money', (ctx: Ctx) => {
  const propertyId = pid(ctx);
  return {
    deposit: depositPolicy(propertyId),
    holdHours: holdWindowHours(propertyId),
    limits: { minHoldHours: MIN_HOLD_HOURS, maxHoldHours: MAX_HOLD_HOURS },
    currency: publicProperty(propertyId).currency,
    /** Live holds, so the screen can show the setting having an effect. */
    activeHolds: activeHolds(propertyId),
  };
}, { perm: 'config.read' });

router.patch('/api/booking-engine/money', (ctx: Ctx) => {
  const propertyId = pid(ctx);
  const b = ctx.body ?? {};
  const before = { deposit: depositPolicy(propertyId), holdHours: holdWindowHours(propertyId) };

  if (b.deposit !== undefined) saveDepositPolicy(propertyId, ctx.auth, b.deposit);
  if (b.holdHours !== undefined) {
    setHoldWindowHours(propertyId, ctx.auth, int(b.holdHours, 'holdHours', {
      min: MIN_HOLD_HOURS, max: MAX_HOLD_HOURS,
    }));
  }

  const after = { deposit: depositPolicy(propertyId), holdHours: holdWindowHours(propertyId) };
  audit(ctx.auth, {
    action: 'booking-engine.money', entity: 'SETTING', entityId: 'booking_engine.money',
    entityRef: 'Booking page money', before, after,
  }, ctx.ip);
  return after;
}, { perm: 'config.write' });
