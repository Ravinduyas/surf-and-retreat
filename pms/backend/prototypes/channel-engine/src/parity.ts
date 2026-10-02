// ─────────────────────────────────────────────────────────────
// Rate parity monitor.
//
// Compares each channel's would-be price against the source-of-truth
// reference (BAR) and flags disparities. Because we derive every child
// rate from one parent and push from a single source, parity is clean
// by construction — this monitor exists to CATCH drift (a manual per-
// channel override, a failed push, an OTA-side promo) before it hurts.
//
// Note (2026): Booking.com parity CLAUSES are prohibited in the EEA
// under the DMA since Nov 2024, but hoteliers still watch parity for
// ranking/visibility reasons — so the monitor stays useful.
// ─────────────────────────────────────────────────────────────
import type { ChannelCode, ParityRow } from './types.ts';
import type { SourceOfTruth } from './sourceOfTruth.ts';

const TOLERANCE_PCT = 1; // treat <1% as in-parity (rounding/fx noise)

// Optional per-channel price overrides to simulate real-world drift
// (e.g. a channel-side promo or a stale push). reference stays BAR.
export type ChannelOverride = Partial<Record<ChannelCode, number>>;

export function computeParity(
  sot: SourceOfTruth,
  channels: ChannelCode[],
  overrides: Map<string, ChannelOverride> = new Map(),
  referencePlan = 'BAR',
): ParityRow[] {
  const rows: ParityRow[] = [];
  for (const rt of sot.listRoomTypes()) {
    for (const date of datesWithReference(sot, rt.code, referencePlan)) {
      const reference = sot.resolvePrice(referencePlan, rt.code, date);
      if (reference <= 0) continue;

      const ov = overrides.get(`${rt.code}|${date}`) ?? {};
      const perChannel: Partial<Record<ChannelCode, number>> = {};
      let worst = 0;
      for (const ch of channels) {
        const price = ov[ch] ?? reference; // channels mirror BAR unless overridden
        perChannel[ch] = price;
        const delta = Math.abs((price - reference) / reference) * 100;
        if (delta > worst) worst = delta;
      }
      rows.push({
        roomType: rt.code, date, reference, perChannel,
        worstDeltaPct: round2(worst), inParity: worst <= TOLERANCE_PCT,
      });
    }
  }
  return rows;
}

// Dates for which a reference (BAR) cell exists. Probes the demo month;
// a production build would enumerate the grid keys directly.
function datesWithReference(sot: SourceOfTruth, roomType: string, ratePlan: string): string[] {
  const out: string[] = [];
  for (let m = 1; m <= 12; m++) {
    for (let day = 1; day <= 31; day++) {
      const date = `2026-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (sot.getCell(roomType, ratePlan, date)) out.push(date);
    }
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
