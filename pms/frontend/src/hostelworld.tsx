// ─────────────────────────────────────────────────────────────
// Hostelworld money, on screen.
//
// A Hostelworld guest agreed to one total, paid part of it to Hostelworld at
// booking time (which Hostelworld keeps as commission), and pays the rest at
// the desk. The server works the three figures out — `hostelworld.ts` on the
// API — and every screen shows them the same way through the pieces here:
//
//   HostelworldBadge   marks a Hostelworld booking wherever a bar or a row
//                      names its source, whether or not the split is on
//   HostelworldMoney   Total booking price · Hostelworld collected · Business
//                      price, shown only when the split applies to the booking
//   HostelworldStatement
//                      What Hostelworld itself said: booking price, deposit
//                      paid, balance due, the promotion, every night at the
//                      price it sold for beside the price that was on sale,
//                      the reference and the cancellation deadlines. Shown
//                      whenever the booking carries it, split or no split.
//
// Nothing here decides the rule. The figures arrive as null for any booking
// the split does not cover, and the block simply does not render.
// ─────────────────────────────────────────────────────────────
import { money, shortDate, timestamp, bpToPercent } from './format';
import type { HostelworldDetail } from './types';

/** The same normalisation the server uses to recognise the OTA. */
export function isHostelworldName(name: string | null | undefined): boolean {
  if (!name) return false;
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith('hostelworld');
}

/** The three figures of a booking, or null when the split does not apply. */
export interface HostelworldSplit {
  totalMinor: number;
  collectedMinor: number;
  businessMinor: number;
}

export function hostelworldSplit(r: {
  totalMinor: number;
  otaCollectedMinor?: number | null;
  businessMinor?: number | null;
}): HostelworldSplit | null {
  if (r.otaCollectedMinor === null || r.otaCollectedMinor === undefined) return null;
  if (r.businessMinor === null || r.businessMinor === undefined) return null;
  return { totalMinor: r.totalMinor, collectedMinor: r.otaCollectedMinor, businessMinor: r.businessMinor };
}

/**
 * A short orange tag. Orange is Hostelworld's own colour and nothing else on
 * the chart uses it, so the eye finds these bars without reading them.
 */
export function HostelworldBadge({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  return (
    <span
      title="Hostelworld booking"
      className={`inline-flex items-center shrink-0 rounded-md bg-orange-500 text-white font-black
                  uppercase tracking-wide leading-none
                  ${compact ? 'px-1 py-[2px] text-[8px]' : 'px-1.5 py-[3px] text-[9px]'} ${className}`}
    >
      {compact ? 'HW' : 'Hostelworld'}
    </span>
  );
}

/**
 * Total · collected · business price, as three rows.
 *
 * `dark` follows the summary rail on the check-in screen; `compact` is for a
 * hover card where there is no room for labels on their own line.
 */
export function HostelworldMoney({ split, dark = false, compact = false, className = '' }: {
  split: HostelworldSplit | null;
  dark?: boolean;
  compact?: boolean;
  className?: string;
}) {
  if (!split) return null;
  const label = dark ? 'text-white/50' : 'text-dash-muted';
  // Labelled the way the property asked for them, with Hostelworld's own words
  // from its confirmation email beside each ("Booking Price", "Deposit Paid",
  // "Balance Due - On Arrival"), so the screen and the email can be read
  // against each other line by line.
  const rows: { label: string; hint?: string; value: number; strong?: boolean; accent?: boolean }[] = [
    { label: 'Total booking price', hint: 'Booking price', value: split.totalMinor },
    { label: 'Hostelworld collected', hint: 'Deposit paid', value: split.collectedMinor, accent: true },
    { label: 'Business price', hint: 'Balance due on arrival', value: split.businessMinor, strong: true },
  ];
  if (compact) {
    return (
      <span className={`inline-flex items-center gap-3 tabular-nums ${className}`}>
        {rows.map((r) => (
          <span key={r.label} className="text-[11px]">
            <span className={`${label}`}>{r.label.replace('Total booking price', 'Total').replace('Hostelworld collected', 'HW collected')} </span>
            <span className={`${r.strong ? 'font-black' : 'font-bold'} ${r.accent ? 'text-orange-600' : ''}`}>
              {money(r.value)}
            </span>
          </span>
        ))}
      </span>
    );
  }
  return (
    <div className={`space-y-1.5 ${className}`}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-3">
          <span className={`text-[11px] ${label}`}>
            {r.label}
            {r.hint && <span className="opacity-60"> · {r.hint}</span>}
          </span>
          <span className={`text-[12px] tabular-nums ${r.strong ? 'font-black' : 'font-bold'}
                            ${r.accent ? (dark ? 'text-orange-300' : 'text-orange-600') : ''}`}>
            {r.accent ? `− ${money(r.value)}` : money(r.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** "6% off" — or "6% off on 3 of 7 nights" when the promotion did not cover the stay. */
export function promotionLabel(d: HostelworldDetail): string | null {
  const p = d.promotion;
  if (!p) return null;
  const pct = `${bpToPercent(p.percentBp)}%`;
  const partial = p.nights < d.nights.length;
  return partial
    ? `${p.uniform ? pct : 'about ' + pct} off on ${p.nights} of ${d.nights.length} nights`
    : `${p.uniform ? pct : 'about ' + pct} off every night`;
}

/**
 * Where the booking on the books disagrees with what Hostelworld said.
 *
 * Empty when they agree. Each line is a plain sentence the desk can act on;
 * the fix for all of them is the same — Refresh from Beds24 — so the caller
 * says that once, underneath.
 */
export function hostelworldMismatch(
  d: HostelworldDetail | null | undefined, booking: { totalMinor: number; otaCollectedMinor?: number | null },
): string[] {
  const out: string[] = [];
  if (!d) return out;
  if (booking.totalMinor !== d.totalMinor) {
    out.push(`This booking is priced at ${money(booking.totalMinor)} here, but Hostelworld's booking price is ${money(d.totalMinor)}.`);
  }
  if (d.paidMinor !== null && booking.otaCollectedMinor != null && booking.otaCollectedMinor !== d.paidMinor) {
    out.push(`The collected amount on record is ${money(booking.otaCollectedMinor)}, but Hostelworld reports a deposit of ${money(d.paidMinor)}.`);
  }
  return out;
}

/**
 * What Hostelworld said about the booking, laid out like its confirmation
 * email so the two can be read against each other line by line:
 *
 *     Total Price            ← totalMinor, after the promotion
 *     Deposit Paid           ← paidMinor
 *     Balance Due - On Arrival ← dueMinor
 *
 * with the promotion shown above them as what it took off the price that was
 * on sale, and the nights underneath, each at the price it sold for beside
 * the price that was on the channel for that night.
 */
export function HostelworldStatement({ detail, booking, className = '' }: {
  detail: HostelworldDetail;
  /** The booking as the PMS holds it, so a disagreement can be pointed at. */
  booking: { totalMinor: number; otaCollectedMinor?: number | null };
  className?: string;
}) {
  const d = detail;
  const cur = d.currency ?? undefined;
  const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '—' : money(v, { currency: cur }));
  const promo = d.promotion;
  const promoLabel = promotionLabel(d);
  const mismatch = hostelworldMismatch(d, booking);
  const pricedNights = d.nights.filter((n) => n.sellMinor !== null).length;
  const rows: { label: string; hint?: string; value: string; tone?: 'accent' | 'muted' | 'strong' }[] = [];
  if (promo) {
    rows.push({
      label: pricedNights === d.nights.length ? 'Price before promotion' : 'Discounted nights before promotion',
      hint: 'On sale at',
      value: fmt(promo.listMinor), tone: 'muted',
    });
    rows.push({ label: 'Hostelworld promotion', hint: promoLabel ?? undefined, value: `− ${fmt(promo.discountMinor)}`, tone: 'accent' });
  }
  rows.push({ label: 'Total booking price', hint: 'Total price', value: fmt(d.totalMinor), tone: 'strong' });
  rows.push({ label: 'Deposit paid to Hostelworld', hint: 'Deposit paid', value: d.paidMinor === null ? '—' : `− ${fmt(d.paidMinor)}`, tone: 'accent' });
  rows.push({ label: 'Balance due on arrival', hint: 'What the desk collects', value: fmt(d.dueMinor), tone: 'strong' });

  return (
    <div className={`rounded-xl border border-orange-100 bg-orange-50/60 p-3 ${className}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <div className="flex items-center gap-2">
          <HostelworldBadge />
          <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
            What Hostelworld confirmed
          </p>
        </div>
        <p className="text-[10px] text-dash-muted tabular-nums">
          {d.ref && <span>Ref <span className="font-mono font-bold text-dash-text">{d.ref}</span></span>}
          {d.ref && d.bookedAt && ' · '}
          {d.bookedAt && <span>booked {timestamp(d.bookedAt)}</span>}
        </p>
      </div>

      <div className="grid gap-x-8 gap-y-3 md:grid-cols-[minmax(16rem,22rem)_1fr]">
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-3">
              <span className={`text-[11px] ${r.tone === 'muted' ? 'text-dash-muted' : 'text-dash-muted'}`}>
                {r.label}
                {r.hint && <span className="opacity-60"> · {r.hint}</span>}
              </span>
              <span className={`text-[12px] tabular-nums whitespace-nowrap
                                ${r.tone === 'strong' ? 'font-black' : 'font-bold'}
                                ${r.tone === 'accent' ? 'text-orange-600' : ''}
                                ${r.tone === 'muted' ? 'text-dash-muted line-through decoration-black/20' : ''}`}>
                {r.value}
              </span>
            </div>
          ))}
          {promo && (
            <p className="text-[10px] text-dash-muted pt-1">
              {promoLabel}
              {pricedNights < d.nights.length && ` — ${d.nights.length - pricedNights} night(s) had no channel price to compare against.`}
            </p>
          )}
          {!promo && pricedNights === d.nights.length && d.nights.length > 0 && (
            <p className="text-[10px] text-dash-muted pt-1">No Hostelworld promotion — every night sold at the price on sale.</p>
          )}
          {!promo && pricedNights === 0 && (
            <p className="text-[10px] text-dash-muted pt-1">
              The channel's prices for these nights were not on record when the booking was read, so no promotion can be shown.
            </p>
          )}
        </div>

        {d.nights.length > 0 && (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-[9px] font-bold uppercase tracking-widest text-dash-muted border-b border-orange-100">
                  <th className="pb-1.5">Night</th>
                  <th className="pb-1.5 text-center">Beds</th>
                  <th className="pb-1.5 text-right">On sale</th>
                  <th className="pb-1.5 text-right">Promotion</th>
                  <th className="pb-1.5 text-right">Sold at</th>
                </tr>
              </thead>
              <tbody>
                {d.nights.map((n) => {
                  const off = n.sellMinor !== null && n.sellMinor > n.rateMinor ? n.sellMinor - n.rateMinor : 0;
                  const pct = n.sellMinor ? Math.round((off * 1000) / n.sellMinor) / 10 : 0;
                  return (
                    <tr key={n.date} className="border-b border-orange-100/60">
                      <td className="py-1 font-semibold whitespace-nowrap">{shortDate(n.date)}</td>
                      <td className="py-1 text-center text-dash-muted">{n.pax}</td>
                      <td className="py-1 text-right tabular-nums text-dash-muted">{n.sellMinor === null ? '—' : fmt(n.sellMinor)}</td>
                      <td className="py-1 text-right tabular-nums text-orange-600 whitespace-nowrap">
                        {off > 0 ? `− ${fmt(off)} (${pct}%)` : n.sellMinor === null ? '—' : ''}
                      </td>
                      <td className="py-1 text-right tabular-nums font-bold">{fmt(n.rateMinor)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} className="pt-1.5 text-[10px] font-bold text-dash-muted">{d.nights.length} night{d.nights.length === 1 ? '' : 's'}</td>
                  <td className="pt-1.5 text-right tabular-nums text-dash-muted">{promo ? fmt(promo.listMinor) : ''}</td>
                  <td className="pt-1.5 text-right tabular-nums text-orange-600">{promo ? `− ${fmt(promo.discountMinor)}` : ''}</td>
                  <td className="pt-1.5 text-right tabular-nums font-black">{fmt(d.nights.reduce((s, n) => s + n.rateMinor, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {(d.cancellableUntil || d.freeCancellableUntil || d.collectNote) && (
        <p className="text-[10px] text-dash-muted mt-3 pt-2 border-t border-orange-100 flex flex-wrap gap-x-4 gap-y-1">
          {d.freeCancellableUntil && <span>Free cancellation until <span className="font-bold">{d.freeCancellableUntil}</span></span>}
          {d.cancellableUntil && <span>Cancellable until <span className="font-bold">{d.cancellableUntil}</span></span>}
          {d.collectNote && <span>{d.collectNote}</span>}
        </p>
      )}

      {mismatch.length > 0 && (
        <div className="mt-3 rounded-lg bg-white border border-status-bad/30 p-2.5 text-[11px]">
          {mismatch.map((m) => <p key={m} className="font-semibold text-status-bad">{m}</p>)}
          <p className="text-dash-muted mt-1">
            Configuration → Hostelworld → <span className="font-bold">Refresh from Beds24</span> re-reads
            the booking and brings the figures here in line with Hostelworld's.
          </p>
        </div>
      )}
    </div>
  );
}
