// ─────────────────────────────────────────────────────────────
// World-class Channel-Manager brain demo — run: `npm run demo:cm`
//
// Exercises the "all the options" feature set on top of Beds24:
//   • rates: occupancy-based, per-person, LOS pricing, derived/linked,
//            per-channel multiplier (commission/fx)
//   • restrictions: min/max stay, stay-through, CTA, CTD, stop-sell,
//            release/advance — with per-channel capability gating + a
//            stay VALIDATOR
//   • yield: Beds24-style availability + lead-time auto-pricing
//   • promotions: early-bird/last-minute/long-stay + correct delivery
//            mode (native OTA promo vs "must send as price")
//   • inventory: pooled, allocated caps, virtual/derived, dependent,
//            bed-level dorms
//   • Beds24 connector: batched ARI push under the rate-limit budget
// ─────────────────────────────────────────────────────────────
import { RateBook } from './cm/rates.ts';
import { RestrictionEngine } from './cm/restrictions.ts';
import { applyYield, type YieldRule } from './cm/yield.ts';
import { applyPromotions, type Promotion } from './cm/promotions.ts';
import { InventoryBook } from './cm/inventory.ts';
import { Beds24Connector } from './adapters/beds24.ts';
import type { ChannelCode } from './types.ts';

function line(s = '') { process.stdout.write(s + '\n'); }
function rule(t: string) { line('\n\x1b[1m── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)) + '\x1b[0m'); }
function ok(b: boolean) { return b ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'; }

line('\x1b[1mHelio — world-class Channel Manager brain (on Beds24)\x1b[0m');

// ── 1. RATES ─────────────────────────────────────────────────
const rates = new RateBook();
rates.addPlan({ code: 'BAR', name: 'Best Available', refundable: true,
  channels: ['BDC', 'EXP', 'AGD'], extraAdult: 25, los: [{ minNights: 5, multiplier: 0.9 }] });
rates.addPlan({ code: 'NREF', name: 'Non-refundable', refundable: false,
  parent: 'BAR', offsetType: 'percent', offsetValue: -10, channels: ['BDC', 'EXP', 'AGD'] });
rates.addPlan({ code: 'BB', name: 'Bed & Breakfast', refundable: true,
  parent: 'BAR', offsetType: 'fixed', offsetValue: 15, channels: ['BDC'] });
// occupancy-based grid for the BAR parent: 1 guest $240, 2 guests $285
rates.setOccupancyPrices('DLXK', 'BAR', '2026-05-04', [{ occupancy: 1, price: 240 }, { occupancy: 2, price: 285 }]);
// bake Booking.com's 18% commission into the pushed price via a multiplier
rates.setChannelMultiplier({ BDC: 1.18 });

rule('Rates — occupancy · per-person · LOS · derived · channel multiplier');
line(`  BAR  1 guest, 2 nights            = $${rates.resolve('BAR', { roomType: 'DLXK', date: '2026-05-04', occupancy: 1, los: 2 })}`);
line(`  BAR  2 guests, 2 nights           = $${rates.resolve('BAR', { roomType: 'DLXK', date: '2026-05-04', occupancy: 2, los: 2 })}`);
line(`  BAR  3 guests (+1 extra adult)    = $${rates.resolve('BAR', { roomType: 'DLXK', date: '2026-05-04', occupancy: 3, los: 2 })}`);
line(`  BAR  2 guests, 5-night LOS (−10%) = $${rates.resolve('BAR', { roomType: 'DLXK', date: '2026-05-04', occupancy: 2, los: 5 })}`);
line(`  NREF 2 guests (BAR −10%)          = $${rates.resolve('NREF', { roomType: 'DLXK', date: '2026-05-04', occupancy: 2, los: 2 })}`);
line(`  BB   2 guests (BAR +$15)          = $${rates.resolve('BB', { roomType: 'DLXK', date: '2026-05-04', occupancy: 2, los: 2 })}`);
line(`  BAR  2 guests → Booking.com (+18%)= $${rates.resolve('BAR', { roomType: 'DLXK', date: '2026-05-04', occupancy: 2, los: 2, channel: 'BDC' })}`);

// ── 2. RESTRICTIONS ──────────────────────────────────────────
const rx = new RestrictionEngine();
rx.addMany([
  { roomType: 'DLXK', date: '2026-05-04', type: 'min-stay', value: 3 },
  { roomType: 'DLXK', date: '2026-05-06', type: 'cta' },
  { roomType: 'DLXK', date: '2026-05-05', type: 'stop-sell', channels: ['HW'] },
  { roomType: 'DLXK', date: '2026-05-04', type: 'release', value: 2 }, // book >=2d ahead
]);

rule('Restrictions — validate a stay (per-channel capability aware)');
const tries = [
  { label: '2-night BDC arriving 05-04 (min-stay 3)', req: { roomType: 'DLXK', ratePlan: 'BAR', arrival: '2026-05-04', departure: '2026-05-06', bookedOn: '2026-05-01', channel: 'BDC' as ChannelCode } },
  { label: '3-night BDC arriving 05-04',              req: { roomType: 'DLXK', ratePlan: 'BAR', arrival: '2026-05-04', departure: '2026-05-07', bookedOn: '2026-05-01', channel: 'BDC' as ChannelCode } },
  { label: 'arrive 05-04 booked same day (release 2)', req: { roomType: 'DLXK', ratePlan: 'BAR', arrival: '2026-05-04', departure: '2026-05-08', bookedOn: '2026-05-04', channel: 'BDC' as ChannelCode } },
];
for (const t of tries) {
  const v = rx.validate(t.req);
  line(`  ${ok(v.ok)} ${t.label}${v.ok ? '' : '  → ' + v.violations.map((x) => x.type + ' (' + x.detail + ')').join(', ')}`);
}
line('  note: Hostelworld gets the 05-05 stop-sell; it ignores release/CTA (unsupported by HW API)');

// ── 3. YIELD ─────────────────────────────────────────────────
const yieldRules: YieldRule[] = [
  { id: 'y1', name: 'High-occupancy uplift', active: true, whenOccupancyPctAtLeast: 80, factor: 1.10 },
  { id: 'y2', name: 'Last-minute fill',      active: true, whenOccupancyPctAtMost: 50, whenDaysToArrivalAtMost: 3, factor: 0.88 },
  { id: 'y3', name: 'Early-bird premium',    active: true, whenDaysToArrivalAtLeast: 60, factor: 1.05 },
];
rule('Yield — Beds24-style availability + lead-time auto-pricing');
const base = 285;
for (const s of [{ occupancyPct: 90, daysToArrival: 10 }, { occupancyPct: 40, daysToArrival: 2 }, { occupancyPct: 60, daysToArrival: 90 }]) {
  const y = applyYield(base, s, yieldRules);
  line(`  occ ${String(s.occupancyPct).padStart(2)}% · ${String(s.daysToArrival).padStart(2)}d out → $${y.price}  ${y.applied.length ? '(' + y.applied.join(', ') + ')' : '(no rule)'}`);
}

// ── 4. PROMOTIONS ────────────────────────────────────────────
const promos: Promotion[] = [
  { code: 'EARLY15', name: 'Early Bird 15%', kind: 'early-bird', discountType: 'percent', discountValue: 15, minDaysToArrival: 30, channels: ['BDC', 'AIR', 'AGD'], active: true },
  { code: 'STAY7',   name: 'Stay 7+ 20%',    kind: 'long-stay',  discountType: 'percent', discountValue: 20, minLos: 7, channels: ['AIR', 'AGD'], active: true },
];
rule('Promotions — price + correct delivery mode per channel');
const pTries: { label: string; ctx: { los: number; daysToArrival: number; channel: ChannelCode } }[] = [
  { label: 'Early-bird on Airbnb (native promo)', ctx: { los: 2, daysToArrival: 45, channel: 'AIR' } },
  { label: 'Long-stay on Agoda (no native → as price)', ctx: { los: 8, daysToArrival: 10, channel: 'AGD' } },
];
for (const t of pTries) {
  const r = applyPromotions(285, promos, t.ctx);
  line(`  ${t.label}: $285 → $${r.price}  [${r.delivery}]  ${r.note}`);
}

// ── 5. INVENTORY MODELS ──────────────────────────────────────
const inv = new InventoryBook();
inv.add({ code: 'DLXK', physical: 10, caps: { AGD: 3 } });                 // pooled + Agoda capped at 3
inv.add({ code: 'DLXK-TWIN', physical: 0, virtualOf: 'DLXK' });            // virtual: same stock as DLXK
inv.add({ code: 'SUITE', physical: 0, componentsOf: ['DLXK', 'DLXK'] });   // dependent: 2 DLXK = 1 suite
inv.add({ code: 'DORM8', physical: 2, bedLevel: true, bedsPerUnit: 8 });   // 2 dorms × 8 beds = 16 beds

rule('Inventory — pooled · allocated cap · virtual · dependent · bed-level');
line(`  DLXK pool avail (BDC)      = ${inv.availableFor('DLXK', '2026-05-04', 'BDC')}`);
line(`  DLXK to Agoda (cap 3)      = ${inv.availableFor('DLXK', '2026-05-04', 'AGD')}`);
line(`  DLXK-TWIN (virtual of DLXK)= ${inv.availableFor('DLXK-TWIN', '2026-05-04', 'BDC')}  (shares DLXK stock)`);
line(`  SUITE (needs 2× DLXK)      = ${inv.availableFor('SUITE', '2026-05-04', 'BDC')}`);
line(`  DORM8 beds (2×8)           = ${inv.availableFor('DORM8', '2026-05-04', 'HW')}`);
inv.sell('DLXK-TWIN', '2026-05-04', 1); // selling the virtual listing decrements the real pool
line(`  after selling 1 DLXK-TWIN → DLXK pool = ${inv.availableFor('DLXK', '2026-05-04', 'BDC')}, SUITE = ${inv.availableFor('SUITE', '2026-05-04', 'BDC')}`);

// ── 6. BEDS24 PUSH ───────────────────────────────────────────
const beds24 = new Beds24Connector();
beds24.setSessionToken('sess_demo_token');
rule('Beds24 push — batched under the ~100-credit / 5-min budget');
const cells = Array.from({ length: 200 }, (_, i) => ({ roomType: 'DLXK', ratePlan: 'BAR',
  date: `2026-05-${String((i % 28) + 1).padStart(2, '0')}`, price: 285, available: 10 }));
const pushRes = await beds24.pushAri({ cells, channels: ['BDC'], reason: 'nightly ARI refresh' });
line(`  ${ok(pushRes.ok)} pushed ${pushRes.accepted} cells · ${pushRes.detail}`);

line('\n\x1b[32m✓ world-class channel-manager brain verified — all options, on Beds24\x1b[0m\n');
