import { useEffect } from 'react';
import type { InvoiceDocument } from './types';
import { money, longDate } from './format';

/**
 * The invoice as a guest receives it.
 *
 * Issuing an invoice already worked; there was simply nothing to hand over. The
 * number, the totals and the receivable all existed as a database row, and the
 * only way to see what was behind the figure was the live folio — which keeps
 * moving after the invoice is cut. This is the paper.
 *
 * **Why print rather than a PDF library.** "Save as PDF" in the browser's own
 * print dialog produces a real, selectable, A4 PDF with correct fonts and page
 * breaks, and costs nothing in bundle size — a client-side PDF generator is
 * roughly 300 KB and renders worse. It also prints straight to the desk's
 * printer, which is what a guest at check-out actually wants. The trade is that
 * the operator picks "Save as PDF" in the dialog; every browser offers it.
 *
 * The layout is deliberately plain: black on white, one accent rule, real
 * margins. An invoice is a financial document that gets filed, scanned and
 * argued over, so legibility beats decoration, and heavy backgrounds are the
 * first thing to betray a printed page.
 */

/**
 * Print rules, injected once.
 *
 * They live here rather than in index.css because they only ever apply while an
 * invoice is on screen, and because they are meaningless apart from the markup
 * directly below. `#invoice-print-root` is hoisted to fill the printed page and
 * everything else on the page is hidden — that is what stops a print picking up
 * the navigation, the modal chrome and the rest of the app around it.
 */
const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 14mm 14mm 16mm 14mm; }
  html, body { background: #fff !important; }
  body * { visibility: hidden !important; }
  #invoice-print-root, #invoice-print-root * { visibility: visible !important; }
  #invoice-print-root {
    position: absolute !important;
    inset: 0 auto auto 0 !important;
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    border: 0 !important;
    border-radius: 0 !important;
  }
  /* A table split mid-row is unreadable; keep each line whole. */
  #invoice-print-root tr, #invoice-print-root .no-break { break-inside: avoid; }
  #invoice-print-root thead { display: table-header-group; }
  .print-hide { display: none !important; }
}
`;

function usePrintStyles() {
  useEffect(() => {
    const el = document.createElement('style');
    el.setAttribute('data-invoice-print', '');
    el.textContent = PRINT_CSS;
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);
}

const line = (v: string | null | undefined) => (v && v.trim() ? v : null);

/**
 * `longDate` parses a bare `YYYY-MM-DD`, but `issuedAt` and `dueAt` arrive as
 * full ISO timestamps — handing one straight over yields an Invalid Date and
 * the raw string is printed on the invoice. Folio line dates are already
 * date-only, so trimming is harmless for them.
 */
const fmtDate = (v: string | null | undefined) => (v ? longDate(String(v).slice(0, 10)) : '—');

/** Address blocks arrive as free text with newlines; keep the operator's breaks. */
function Multiline({ text, className = '' }: { text: string | null; className?: string }) {
  if (!text) return null;
  return (
    <>
      {text.split('\n').map((l, i) => (
        <div key={i} className={className}>{l}</div>
      ))}
    </>
  );
}

export function InvoicePaper({ doc }: { doc: InvoiceDocument }) {
  usePrintStyles();
  const { invoice: inv, from, billTo, stay, lines, taxes, payments, branding } = doc;
  const cur = inv.currency;
  const m = (v: number) => money(v, { currency: cur, decimals: true });

  // The legal entity, if the property trades under a different one, then the
  // operating name. A guest's accountant needs the name that matches the tax id.
  const headerName = branding.headerName ?? from.legalName ?? from.name;
  const settled = inv.balanceMinor === 0;

  return (
    <div
      id="invoice-print-root"
      className="bg-white text-black mx-auto w-full max-w-[820px] p-10 sm:p-12 rounded-2xl border border-black/10"
      style={{ fontFeatureSettings: '"tnum" 1' }}
    >
      {/* ── Header: who is billing ───────────────────────────── */}
      <div className="flex items-start justify-between gap-8 pb-6 border-b-2 border-black">
        <div className="flex items-start gap-4 min-w-0">
          {branding.logoDataUrl && (
            // Fixed height, auto width: logos arrive at every aspect ratio and a
            // box would squash a wide one. 40mm ≈ 150px at print resolution.
            <img
              src={branding.logoDataUrl}
              alt=""
              className="h-14 w-auto max-w-[180px] object-contain shrink-0"
            />
          )}
          <div className="min-w-0">
            <div className="text-[17px] font-bold tracking-tight leading-tight">{headerName}</div>
            {branding.headerName && from.name !== branding.headerName && (
              <div className="text-[11px] text-black/60">{from.name}</div>
            )}
            <div className="mt-1 text-[10.5px] leading-[1.5] text-black/70">
              <Multiline text={line(from.address)} />
              {(from.city || from.country) && (
                <div>{[from.city, from.country].filter(Boolean).join(', ')}</div>
              )}
              {line(from.phone) && <div>{from.phone}</div>}
              {line(from.email) && <div>{from.email}</div>}
              {line(from.website) && <div>{from.website}</div>}
              {branding.showTaxId && line(from.taxId) && (
                <div className="mt-1 font-medium text-black">Tax ID: {from.taxId}</div>
              )}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-[22px] font-bold tracking-[-0.02em] leading-none">INVOICE</div>
          <div className="mt-2 font-mono text-[12px] font-bold">{inv.number}</div>
          <div className="mt-2 text-[10.5px] leading-[1.6] text-black/70">
            <div>Issued <span className="text-black">{fmtDate(inv.issuedAt)}</span></div>
            {inv.dueAt && <div>Due <span className="text-black">{fmtDate(inv.dueAt)}</span></div>}
          </div>
          {/* Status is stated in words. A coloured chip is the first thing to
              vanish on a monochrome office printer. */}
          <div className={`mt-2 inline-block px-2 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider border ${
            settled ? 'border-black/30 text-black/70' : 'border-black text-black'
          }`}>
            {settled ? 'Paid in full' : inv.status === 'ar' ? 'Charged to account' : 'Balance due'}
          </div>
        </div>
      </div>

      {/* ── Bill to, and the stay it covers ──────────────────── */}
      <div className="grid grid-cols-2 gap-8 py-6">
        <div>
          <div className="text-[9.5px] font-bold uppercase tracking-wider text-black/50 mb-1.5">Billed to</div>
          <div className="text-[13px] font-bold">{billTo.name}</div>
          {billTo.company && billTo.company !== billTo.name && (
            <div className="text-[11px] font-medium">{billTo.company}</div>
          )}
          <div className="mt-1 text-[10.5px] leading-[1.5] text-black/70">
            <Multiline text={line(billTo.address)} />
          </div>
        </div>

        {stay && (
          <div>
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-black/50 mb-1.5">Stay</div>
            <table className="text-[10.5px] leading-[1.6]">
              <tbody>
                {stay.confirmation && (
                  <tr><td className="pr-3 text-black/60">Confirmation</td><td className="font-mono font-medium">{stay.confirmation}</td></tr>
                )}
                {stay.guest && billTo.name !== stay.guest && (
                  <tr><td className="pr-3 text-black/60">Guest</td><td className="font-medium">{stay.guest}</td></tr>
                )}
                {stay.arrival && (
                  <tr>
                    <td className="pr-3 text-black/60">Dates</td>
                    <td className="font-medium">
                      {fmtDate(stay.arrival)} — {stay.departure ? fmtDate(stay.departure) : ''}
                      {stay.nights ? ` · ${stay.nights} night${stay.nights > 1 ? 's' : ''}` : ''}
                    </td>
                  </tr>
                )}
                {(stay.roomNumber || stay.roomType) && (
                  <tr>
                    <td className="pr-3 text-black/60">Room</td>
                    <td className="font-medium">{[stay.roomNumber, stay.roomType].filter(Boolean).join(' · ')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── The charges ──────────────────────────────────────── */}
      <table className="w-full text-[10.5px] border-collapse">
        <thead>
          <tr className="border-y border-black/20 text-[9.5px] uppercase tracking-wider text-black/50">
            <th className="text-left font-bold py-2 w-[80px]">Date</th>
            <th className="text-left font-bold py-2">Description</th>
            <th className="text-right font-bold py-2 w-[44px]">Qty</th>
            <th className="text-right font-bold py-2 w-[90px]">Unit</th>
            <th className="text-right font-bold py-2 w-[100px]">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr><td colSpan={5} className="py-6 text-center text-black/50">No charges on this invoice.</td></tr>
          )}
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-black/8">
              <td className="py-1.5 align-top text-black/60 whitespace-nowrap">{fmtDate(l.date)}</td>
              <td className="py-1.5 align-top pr-4">{l.description}</td>
              <td className="py-1.5 align-top text-right text-black/60">{l.qty}</td>
              <td className="py-1.5 align-top text-right text-black/60 tabular-nums">{m(l.unitMinor)}</td>
              <td className="py-1.5 align-top text-right font-medium tabular-nums">{m(l.amountMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Totals ───────────────────────────────────────────── */}
      <div className="flex justify-end pt-5 no-break">
        <table className="text-[11px] min-w-[280px]">
          <tbody>
            <tr>
              <td className="py-1 pr-8 text-black/60">Subtotal</td>
              <td className="py-1 text-right font-medium tabular-nums">{m(inv.netMinor)}</td>
            </tr>
            {/* Tax broken out by code. A guest reclaiming VAT needs the figure
                on its own, and the property's returns need it separable from a
                service charge or a levy. */}
            {taxes.map((t) => (
              <tr key={t.code}>
                <td className="py-1 pr-8 text-black/60">{t.description}</td>
                <td className="py-1 text-right tabular-nums">{m(t.amountMinor)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-black">
              <td className="pt-2 pr-8 font-bold text-[13px]">Total</td>
              <td className="pt-2 text-right font-bold text-[13px] tabular-nums">{m(inv.totalMinor)}</td>
            </tr>
            {inv.paidMinor !== 0 && (
              <tr>
                <td className="py-1 pr-8 text-black/60">Paid</td>
                <td className="py-1 text-right tabular-nums">−{m(inv.paidMinor)}</td>
              </tr>
            )}
            <tr className="border-t border-black/20">
              <td className="pt-1.5 pr-8 font-bold">{settled ? 'Balance' : 'Balance due'}</td>
              <td className="pt-1.5 text-right font-bold tabular-nums">{m(inv.balanceMinor)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Payments received ────────────────────────────────── */}
      {payments.length > 0 && (
        <div className="pt-6 no-break">
          <div className="text-[9.5px] font-bold uppercase tracking-wider text-black/50 mb-1.5">Payments received</div>
          <table className="w-full text-[10.5px]">
            <tbody>
              {payments.map((p, i) => (
                <tr key={i} className="border-b border-black/8">
                  <td className="py-1.5 text-black/60 w-[80px] whitespace-nowrap">{fmtDate(p.date)}</td>
                  <td className="py-1.5">{p.description}{p.method ? ` · ${p.method}` : ''}</td>
                  <td className="py-1.5 text-right tabular-nums">{m(p.amountMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Terms and footer ─────────────────────────────────── */}
      {(branding.terms || branding.footerNote) && (
        <div className="pt-6 mt-6 border-t border-black/15 text-[10px] leading-[1.6] text-black/70 no-break">
          {branding.terms && <div className="font-medium text-black mb-1"><Multiline text={branding.terms} /></div>}
          {branding.footerNote && <Multiline text={branding.footerNote} />}
        </div>
      )}

      <div className="pt-6 text-[9px] text-black/40 text-center">
        {inv.number} · {headerName}
        {inv.createdBy ? ` · issued by ${inv.createdBy}` : ''}
      </div>
    </div>
  );
}

/**
 * Hands the page to the browser's print dialog, where "Save as PDF" lives.
 *
 * A plain `window.print()` — no timers, no hidden iframe. The print stylesheet
 * above has already reduced the page to the invoice, so what the operator
 * previews is what comes out.
 */
export function printInvoice() {
  window.print();
}
