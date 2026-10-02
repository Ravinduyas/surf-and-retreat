// ─────────────────────────────────────────────────────────────
// Source of truth — the PMS master calendar.
//
// Holds room types, rate plans and the per-date ARI grid. This is the
// ONE place rates/availability live; connectors are pure distributors
// of what this store says. Pooled inventory: every channel draws from
// the same `available` count, so a sale anywhere decrements everywhere.
// ─────────────────────────────────────────────────────────────
import type { AriCell, RatePlan, RoomType, ChannelCode } from './types.ts';

function key(roomType: string, ratePlan: string, date: string): string {
  return `${roomType}|${ratePlan}|${date}`;
}

export class SourceOfTruth {
  private roomTypes = new Map<string, RoomType>();
  private ratePlans = new Map<string, RatePlan>();
  private grid = new Map<string, AriCell>();

  addRoomType(rt: RoomType): void {
    this.roomTypes.set(rt.code, rt);
  }

  addRatePlan(rp: RatePlan): void {
    this.ratePlans.set(rp.code, rp);
  }

  getRatePlan(code: string): RatePlan | undefined {
    return this.ratePlans.get(code);
  }

  listRoomTypes(): RoomType[] {
    return [...this.roomTypes.values()];
  }

  listRatePlans(): RatePlan[] {
    return [...this.ratePlans.values()];
  }

  // Resolve the effective price of a rate plan on a date, applying the
  // derived-rate chain (child = parent ± offset). One BAR edit cascades
  // to every child automatically — the parity-clean way to price.
  resolvePrice(ratePlan: string, roomType: string, date: string): number {
    const rp = this.ratePlans.get(ratePlan);
    if (!rp) return 0;
    if (!rp.parent) {
      const cell = this.grid.get(key(roomType, ratePlan, date));
      return cell?.price ?? 0;
    }
    const base = this.resolvePrice(rp.parent, roomType, date);
    if (rp.offsetType === 'percent') return round2(base * (1 + (rp.offsetValue ?? 0) / 100));
    if (rp.offsetType === 'fixed') return round2(base + (rp.offsetValue ?? 0));
    return base;
  }

  // Set base ARI for a parent (BAR) cell. Children are derived on read.
  setCell(cell: AriCell): void {
    this.grid.set(key(cell.roomType, cell.ratePlan, cell.date), cell);
  }

  getCell(roomType: string, ratePlan: string, date: string): AriCell | undefined {
    return this.grid.get(key(roomType, ratePlan, date));
  }

  // Pooled-inventory decrement: a booking on ANY channel reduces the
  // shared availability for that room type across ALL rate plans/dates
  // in the stay window. Returns the affected cells so the engine can
  // re-push them to every other channel (overbooking prevention).
  decrement(roomType: string, arrival: string, departure: string, units: number): AriCell[] {
    const affected: AriCell[] = [];
    for (const [, cell] of this.grid) {
      if (cell.roomType !== roomType) continue;
      if (cell.date >= arrival && cell.date < departure) {
        cell.available = Math.max(0, cell.available - units);
        affected.push(cell);
      }
    }
    return affected;
  }

  // Expand a parent cell into concrete priced cells for every rate plan
  // distributed to `channel` (parents + their children). This is what a
  // connector actually receives.
  cellsForChannel(channel: ChannelCode): AriCell[] {
    const out: AriCell[] = [];
    for (const [, base] of this.grid) {
      for (const rp of this.ratePlans.values()) {
        if (!rp.channels.includes(channel)) continue;
        // a rate plan applies to this cell's room type if it (or its parent) has a base cell
        const rootPlan = rp.parent ?? rp.code;
        if (rootPlan !== base.ratePlan) continue;
        out.push({
          ...base,
          ratePlan: rp.code,
          price: this.resolvePrice(rp.code, base.roomType, base.date),
        });
      }
    }
    return out;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
