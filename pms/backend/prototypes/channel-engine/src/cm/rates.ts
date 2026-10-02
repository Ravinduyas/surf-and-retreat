// ─────────────────────────────────────────────────────────────
// World-class RATE engine (the "all options" pricing brain).
//
// Everything a top channel manager exposes for pricing, computed in the
// PMS as source of truth and then handed to the Beds24 connector to
// distribute. Covers: BAR, derived/linked rates (fixed & %), occupancy-
// based pricing, per-person + extra adult/child, length-of-stay (LOS)
// pricing, and per-channel multipliers (commission uplift / fx).
//
// Beds24 ceiling honoured: occupancy/per-person/LOS/linked/multipliers
// are all native to Beds24 — this mirrors that model so what we compute
// is faithfully pushable. (Discounts are handled in promotions.ts, which
// respects Beds24's "OTA discounts must be sent as real prices" rule.)
// ─────────────────────────────────────────────────────────────
import type { ChannelCode } from '../types.ts';

export interface OccupancyPrice {
  occupancy: number;   // number of guests this price applies to
  price: number;       // nightly price at that occupancy
}

export interface LosPrice {
  minNights: number;   // applies when stay length >= minNights
  // multiplier on nightly price, e.g. 0.9 = 10% off for longer stays
  multiplier: number;
}

export interface RatePlanDef {
  code: string;
  name: string;
  refundable: boolean;
  // derived/linked: child recalculates from parent on read
  parent?: string;
  offsetType?: 'percent' | 'fixed';
  offsetValue?: number;
  // occupancy-based prices for the PARENT (base) plan, per room type+date
  // keyed as roomType|date -> OccupancyPrice[]
  channels: ChannelCode[];
  extraAdult?: number;   // charge per extra adult above base occupancy
  extraChild?: number;
  los?: LosPrice[];      // length-of-stay pricing tiers
}

// Per-channel price adjustment (e.g. +18% to bake in Booking.com
// commission, or an fx uplift). Beds24 calls these price multipliers.
export type ChannelMultiplier = Partial<Record<ChannelCode, number>>;

export interface RateContext {
  roomType: string;
  date: string;
  occupancy: number;     // guests actually booking
  los: number;           // length of stay in nights
  channel?: ChannelCode;
}

// Base occupancy price grid: roomType|ratePlan|date -> OccupancyPrice[]
export class RateBook {
  private plans = new Map<string, RatePlanDef>();
  private occ = new Map<string, OccupancyPrice[]>();
  private multipliers: ChannelMultiplier = {};

  private k(roomType: string, plan: string, date: string) { return `${roomType}|${plan}|${date}`; }

  addPlan(p: RatePlanDef) { this.plans.set(p.code, p); }
  getPlan(code: string) { return this.plans.get(code); }
  listPlans() { return [...this.plans.values()]; }
  setChannelMultiplier(m: ChannelMultiplier) { this.multipliers = m; }

  // Set the base occupancy-priced cell for a (parent) plan.
  setOccupancyPrices(roomType: string, plan: string, date: string, prices: OccupancyPrice[]) {
    this.occ.set(this.k(roomType, plan, date), prices.slice().sort((a, b) => a.occupancy - b.occupancy));
  }

  // Nightly base price for a plan at a given occupancy (before LOS,
  // derived offset, channel multiplier). Picks the highest occupancy
  // tier <= requested occupancy, then adds extra-adult charges above it.
  private basePrice(plan: RatePlanDef, roomType: string, date: string, occupancy: number): number {
    const rootPlan = plan.parent ?? plan.code;
    const tiers = this.occ.get(this.k(roomType, rootPlan, date)) ?? [];
    if (!tiers.length) return 0;
    let chosen = tiers[0];
    for (const t of tiers) if (t.occupancy <= occupancy) chosen = t;
    let price = chosen.price;
    const over = occupancy - chosen.occupancy;
    if (over > 0 && plan.extraAdult) price += over * plan.extraAdult;
    return price;
  }

  // Full resolution: base occupancy price → derived offset → LOS tier →
  // per-channel multiplier. This is the number the connector pushes.
  resolve(planCode: string, ctx: RateContext): number {
    const plan = this.plans.get(planCode);
    if (!plan) return 0;

    // derived/linked chain
    let price: number;
    if (plan.parent) {
      const base = this.resolve(plan.parent, { ...ctx });
      if (plan.offsetType === 'percent') price = base * (1 + (plan.offsetValue ?? 0) / 100);
      else if (plan.offsetType === 'fixed') price = base + (plan.offsetValue ?? 0);
      else price = base;
    } else {
      price = this.basePrice(plan, ctx.roomType, ctx.date, ctx.occupancy);
    }

    // length-of-stay tier (best applicable = longest minNights <= los)
    if (plan.los && plan.los.length) {
      let mult = 1;
      let best = -1;
      for (const t of plan.los) if (ctx.los >= t.minNights && t.minNights > best) { best = t.minNights; mult = t.multiplier; }
      price *= mult;
    }

    // per-channel multiplier (commission/fx uplift)
    if (ctx.channel && this.multipliers[ctx.channel]) price *= this.multipliers[ctx.channel]!;

    return round2(price);
  }
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
