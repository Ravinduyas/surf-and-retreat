// ─────────────────────────────────────────────────────────────
// YIELD optimizer — Beds24-style automated pricing.
//
// Beds24's native Yield Optimizer keys off two signals: remaining
// availability and lead time (days before check-in). This mirrors that:
// stackable rules nudge the price up when a room is scarce or demand is
// near, and down to fill soft dates. (True comp-set/demand RMS is NOT
// native to Beds24 — pipe PriceLabs/RoomPriceGenie in as an override.)
// ─────────────────────────────────────────────────────────────
export interface YieldRule {
  id: string;
  name: string;
  active: boolean;
  // trigger window
  whenOccupancyPctAtLeast?: number;   // e.g. 80 → applies when >=80% sold
  whenOccupancyPctAtMost?: number;    // e.g. 50 → applies when <=50% sold
  whenDaysToArrivalAtMost?: number;   // e.g. 3 → last-minute window
  whenDaysToArrivalAtLeast?: number;  // e.g. 60 → far-out window
  // action: multiply price by this factor (1.10 = +10%, 0.88 = -12%)
  factor: number;
}

export interface YieldSignals { occupancyPct: number; daysToArrival: number; }

export interface YieldResult { price: number; applied: string[]; }

export function applyYield(base: number, signals: YieldSignals, rules: YieldRule[]): YieldResult {
  let price = base;
  const applied: string[] = [];
  for (const r of rules) {
    if (!r.active) continue;
    if (r.whenOccupancyPctAtLeast !== undefined && signals.occupancyPct < r.whenOccupancyPctAtLeast) continue;
    if (r.whenOccupancyPctAtMost !== undefined && signals.occupancyPct > r.whenOccupancyPctAtMost) continue;
    if (r.whenDaysToArrivalAtMost !== undefined && signals.daysToArrival > r.whenDaysToArrivalAtMost) continue;
    if (r.whenDaysToArrivalAtLeast !== undefined && signals.daysToArrival < r.whenDaysToArrivalAtLeast) continue;
    price *= r.factor;
    applied.push(`${r.name} (×${r.factor})`);
  }
  return { price: Math.round(price * 100) / 100, applied };
}
