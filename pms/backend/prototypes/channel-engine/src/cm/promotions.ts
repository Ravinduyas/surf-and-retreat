// ─────────────────────────────────────────────────────────────
// PROMOTIONS — with the critical Beds24 OTA rule baked in.
//
// Beds24 (and OTAs generally) will NOT accept an arbitrary "discount
// rule" and apply it channel-side. Only specific promo types map to a
// native OTA promotion (Airbnb/Vrbo early-bird/last-minute, Booking.com
// Genius/deals, Expedia deals). Everything else must be sent as a LOWER
// ACTUAL PRICE. This module computes the discounted price AND tells you
// how it must be delivered per channel, so the connector does the right
// thing instead of silently failing to discount on an OTA.
// ─────────────────────────────────────────────────────────────
import type { ChannelCode } from '../types.ts';

export type PromoKind = 'early-bird' | 'last-minute' | 'long-stay' | 'basic';
export type DeliveryMode = 'native-promo' | 'as-price';

export interface Promotion {
  code: string;
  name: string;
  kind: PromoKind;
  discountType: 'percent' | 'fixed';
  discountValue: number;         // 15 => 15% or $15
  // eligibility
  minLos?: number;               // long-stay
  maxDaysToArrival?: number;     // last-minute window
  minDaysToArrival?: number;     // early-bird window
  channels: ChannelCode[];
  active: boolean;
}

// Channels that accept a NATIVE promo object for a given kind. Anything
// not listed must be delivered as a lowered price.
const NATIVE_PROMO_SUPPORT: Record<PromoKind, ChannelCode[]> = {
  'early-bird':  ['AIR', 'VRBO', 'BDC', 'DIRECT'],
  'last-minute': ['AIR', 'VRBO', 'BDC', 'DIRECT'],
  'long-stay':   ['AIR', 'VRBO', 'DIRECT'],
  'basic':       ['DIRECT'], // generic discounts only truly free on your own engine
};

export interface PromoContext { los: number; daysToArrival: number; channel: ChannelCode; }

export interface PromoResult {
  applied?: Promotion;
  price: number;
  delivery: DeliveryMode;   // how the connector must send it
  note: string;
}

function eligible(p: Promotion, ctx: PromoContext): boolean {
  if (!p.active) return false;
  if (!p.channels.includes(ctx.channel)) return false;
  if (p.minLos !== undefined && ctx.los < p.minLos) return false;
  if (p.maxDaysToArrival !== undefined && ctx.daysToArrival > p.maxDaysToArrival) return false;
  if (p.minDaysToArrival !== undefined && ctx.daysToArrival < p.minDaysToArrival) return false;
  return true;
}

// Apply the best single promotion for the context. Returns the price and,
// crucially, whether it goes as a native promo or must be sent as price.
export function applyPromotions(base: number, promos: Promotion[], ctx: PromoContext): PromoResult {
  const candidates = promos.filter((p) => eligible(p, ctx));
  if (!candidates.length) return { price: base, delivery: 'as-price', note: 'no promo' };

  // choose the deepest discount
  let best = candidates[0];
  let bestPrice = discounted(base, best);
  for (const p of candidates) {
    const px = discounted(base, p);
    if (px < bestPrice) { best = p; bestPrice = px; }
  }
  const native = NATIVE_PROMO_SUPPORT[best.kind].includes(ctx.channel);
  return {
    applied: best,
    price: bestPrice,
    delivery: native ? 'native-promo' : 'as-price',
    note: native
      ? `${best.code} pushed as native ${best.kind} promo`
      : `${best.code} sent as lowered price (channel has no native ${best.kind})`,
  };
}

function discounted(base: number, p: Promotion): number {
  const px = p.discountType === 'percent' ? base * (1 - p.discountValue / 100) : base - p.discountValue;
  return Math.round(Math.max(0, px) * 100) / 100;
}
