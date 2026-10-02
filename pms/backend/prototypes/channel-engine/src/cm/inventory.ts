// ─────────────────────────────────────────────────────────────
// INVENTORY models — every distribution model a top CM offers.
//
//  • pooled       — one shared count; every channel draws from it (default)
//  • allocated    — a per-channel cap (contracted allotment / wholesaler)
//  • virtual      — one physical room sold as several room-type listings
//                   (e.g. "Double" also sold as "Twin"); components linked
//  • dependent    — a unit sellable only when its components are free
//                   (combine two rooms into a suite; split a house)
//  • bed-level    — dorm sold per bed (occupancy = beds) for hostels
//
// Mirrors Beds24's Room Linking & Dependencies + pooled/contracted models.
// ─────────────────────────────────────────────────────────────
import type { ChannelCode } from '../types.ts';

export interface RoomTypeInv {
  code: string;
  physical: number;              // real physical units (the pool ceiling)
  bedLevel?: boolean;            // dorm sold per bed
  bedsPerUnit?: number;          // beds in each dorm unit
  // per-channel caps: sell at most N to this channel (allocated model).
  // omit a channel = it draws freely from the pool.
  caps?: Partial<Record<ChannelCode, number>>;
  // virtual/derived: this listing is really the SAME physical stock as
  // another room type — selling one decrements the shared parent.
  virtualOf?: string;
  // dependency: sellable only if ALL of these component types are free
  // (and selling it consumes one of each).
  componentsOf?: string[];
}

export class InventoryBook {
  private types = new Map<string, RoomTypeInv>();
  private sold = new Map<string, number>();   // code|date -> units sold from physical pool

  add(rt: RoomTypeInv) { this.types.set(rt.code, rt); }
  get(code: string) { return this.types.get(code); }

  private soldKey(code: string, date: string) { return `${code}|${date}`; }

  // Physical stock for a type (following virtualOf to the real pool).
  private physicalRoot(code: string): RoomTypeInv | undefined {
    let rt = this.types.get(code);
    const seen = new Set<string>();
    while (rt?.virtualOf && !seen.has(rt.code)) { seen.add(rt.code); rt = this.types.get(rt.virtualOf); }
    return rt;
  }

  // Record a sale against the real physical pool (handles virtual + dorm beds).
  sell(code: string, date: string, units = 1) {
    const root = this.physicalRoot(code);
    if (!root) return;
    // dependency unit consumes one of each component
    if (root.componentsOf?.length) {
      for (const c of root.componentsOf) this.sell(c, date, units);
      return;
    }
    const k = this.soldKey(root.code, date);
    this.sold.set(k, (this.sold.get(k) ?? 0) + units);
  }

  // Raw physical availability of the real pool on a date.
  private poolAvail(code: string, date: string): number {
    const root = this.physicalRoot(code);
    if (!root) return 0;
    if (root.componentsOf?.length) {
      // dependent unit available = min of its components
      return Math.min(...root.componentsOf.map((c) => this.poolAvail(c, date)));
    }
    const capacity = root.bedLevel ? root.physical * (root.bedsPerUnit ?? 1) : root.physical;
    return Math.max(0, capacity - (this.sold.get(this.soldKey(root.code, date)) ?? 0));
  }

  // Availability offered to a specific channel: pool availability clamped
  // by that channel's allocated cap (if any). This is the number pushed.
  availableFor(code: string, date: string, channel: ChannelCode): number {
    const rt = this.types.get(code);
    const pool = this.poolAvail(code, date);
    const cap = rt?.caps?.[channel];
    return cap === undefined ? pool : Math.min(pool, cap);
  }
}
