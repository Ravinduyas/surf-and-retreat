// ─────────────────────────────────────────────────────────────
// World-class RESTRICTIONS engine (the full "all options" stay-control set).
//
// Implements every restriction a leading channel manager exposes
// (STAAH's 7-type API is the reference standard), plus per-channel
// capability gating — because a restriction only matters if the target
// channel can actually receive it. Includes a stay VALIDATOR: given a
// requested stay, does it satisfy the restrictions for those dates?
// ─────────────────────────────────────────────────────────────
import type { ChannelCode } from '../types.ts';

export type RestrictionType =
  | 'min-stay'        // minimum nights on arrival
  | 'max-stay'        // maximum nights on arrival
  | 'min-stay-through'// min LOS enforced for every day of the stay
  | 'cta'             // closed to arrival
  | 'ctd'             // closed to departure
  | 'stop-sell'       // closed / no sale
  | 'release'         // advance cut-off: must book >= N days before arrival
  | 'min-advance'     // must book at least N days ahead
  | 'max-advance';    // cannot book more than N days ahead

export interface Restriction {
  roomType: string;
  ratePlan?: string;        // undefined = applies to all plans
  date: string;             // the affected business date (YYYY-MM-DD)
  type: RestrictionType;
  value?: number;           // nights / days depending on type
  channels?: ChannelCode[]; // undefined = all channels
}

// Which restriction types each channel can actually receive. This mirrors
// the reality that Beds24 can HOLD any restriction but only DELIVERS the
// ones a given OTA's API supports. Tune per real capability tables.
export const CHANNEL_RESTRICTION_SUPPORT: Record<ChannelCode, RestrictionType[]> = {
  BDC:  ['min-stay', 'max-stay', 'min-stay-through', 'cta', 'ctd', 'stop-sell', 'release', 'min-advance', 'max-advance'],
  EXP:  ['min-stay', 'max-stay', 'cta', 'ctd', 'stop-sell', 'release'],
  VRBO: ['min-stay', 'max-stay', 'stop-sell'],
  AGD:  ['min-stay', 'max-stay', 'cta', 'ctd', 'stop-sell', 'release'],
  AIR:  ['min-stay', 'max-stay', 'stop-sell', 'min-advance', 'max-advance'],
  HW:   ['min-stay', 'stop-sell'],
  GHA:  ['stop-sell'],
  DIRECT: ['min-stay', 'max-stay', 'min-stay-through', 'cta', 'ctd', 'stop-sell', 'release', 'min-advance', 'max-advance'],
};

export interface StayRequest {
  roomType: string;
  ratePlan: string;
  arrival: string;          // YYYY-MM-DD
  departure: string;        // YYYY-MM-DD (exclusive)
  bookedOn: string;         // date the booking is made
  channel: ChannelCode;
}

export interface Violation { type: RestrictionType; date: string; detail: string; }

export class RestrictionEngine {
  private rules: Restriction[] = [];

  add(r: Restriction) { this.rules.push(r); }
  addMany(rs: Restriction[]) { for (const r of rs) this.rules.push(r); }
  all() { return this.rules; }

  private appliesTo(r: Restriction, roomType: string, ratePlan: string, channel: ChannelCode): boolean {
    if (r.roomType !== roomType) return false;
    if (r.ratePlan && r.ratePlan !== ratePlan) return false;
    if (r.channels && !r.channels.includes(channel)) return false;
    return true;
  }

  // Only restrictions the channel can actually receive count against it.
  private deliverable(type: RestrictionType, channel: ChannelCode): boolean {
    return CHANNEL_RESTRICTION_SUPPORT[channel].includes(type);
  }

  // Validate a requested stay against all applicable, deliverable rules.
  validate(req: StayRequest): { ok: boolean; violations: Violation[] } {
    const nights = daysBetween(req.arrival, req.departure);
    const lead = daysBetween(req.bookedOn, req.arrival);
    const stayDates = eachDate(req.arrival, req.departure);
    const violations: Violation[] = [];

    for (const r of this.rules) {
      if (!this.appliesTo(r, req.roomType, req.ratePlan, req.channel)) continue;
      if (!this.deliverable(r.type, req.channel)) continue;

      switch (r.type) {
        case 'stop-sell':
          if (stayDates.includes(r.date)) violations.push({ type: r.type, date: r.date, detail: 'date closed' });
          break;
        case 'cta':
          if (r.date === req.arrival) violations.push({ type: r.type, date: r.date, detail: 'closed to arrival' });
          break;
        case 'ctd':
          if (r.date === req.departure) violations.push({ type: r.type, date: r.date, detail: 'closed to departure' });
          break;
        case 'min-stay':
          if (r.date === req.arrival && nights < (r.value ?? 0))
            violations.push({ type: r.type, date: r.date, detail: `min ${r.value} nights, got ${nights}` });
          break;
        case 'max-stay':
          if (r.date === req.arrival && nights > (r.value ?? Infinity))
            violations.push({ type: r.type, date: r.date, detail: `max ${r.value} nights, got ${nights}` });
          break;
        case 'min-stay-through':
          if (stayDates.includes(r.date) && nights < (r.value ?? 0))
            violations.push({ type: r.type, date: r.date, detail: `min-through ${r.value} nights, got ${nights}` });
          break;
        case 'release':
        case 'min-advance':
          if (r.date === req.arrival && lead < (r.value ?? 0))
            violations.push({ type: r.type, date: r.date, detail: `needs ${r.value}d advance, got ${lead}` });
          break;
        case 'max-advance':
          if (r.date === req.arrival && lead > (r.value ?? Infinity))
            violations.push({ type: r.type, date: r.date, detail: `max ${r.value}d advance, got ${lead}` });
          break;
      }
    }
    return { ok: violations.length === 0, violations };
  }
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}
export function eachDate(arrival: string, departure: string): string[] {
  const out: string[] = [];
  let t = Date.parse(arrival);
  const end = Date.parse(departure);
  while (t < end) { out.push(new Date(t).toISOString().slice(0, 10)); t += 86400000; }
  return out;
}
