import React from 'react';
import { ReceiptText, ShieldCheck } from 'lucide-react';
import { formatMoney } from '../../pms';
import { QuoteLine } from './quote';

interface QuoteCardProps {
  lines: QuoteLine[];
  total: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  /** Drops the outer card styling when the quote sits inside the phone sheet. */
  bare?: boolean;
}

const day = (key: string) =>
  key ? new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Add date';

/** The stay at a glance (dates, nights, guests), then one priced line per item and the total. */
export const QuoteCard: React.FC<QuoteCardProps> = ({ lines, total, checkIn, checkOut, nights, guests, bare = false }) => (
  <div className={bare ? '' : 'bg-white rounded-[22px] border border-[#E4EAE0] shadow-[0_16px_40px_-24px_rgba(24,39,30,0.3)] overflow-hidden'}>
    <div className="relative bg-[#1F3A2A] text-white px-4 pt-3 pb-3 overflow-hidden">
      <div aria-hidden="true" className="absolute -right-10 -top-12 w-40 h-40 rounded-full bg-[#D8E95E]/10" />
      <p className="relative flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-[#D8E95E]">
        <ReceiptText className="w-3.5 h-3.5" />
        Your quote
      </p>
      <div className="relative grid grid-cols-2 gap-2 mt-2">
        <div>
          <p className="text-[9.5px] uppercase tracking-[0.14em] text-white/55">Check-in</p>
          <p className={`text-xs sm:text-[13px] font-semibold mt-0.5 ${checkIn ? '' : 'text-white/45'}`}>{day(checkIn)}</p>
        </div>
        <div>
          <p className="text-[9.5px] uppercase tracking-[0.14em] text-white/55">Check-out</p>
          <p className={`text-xs sm:text-[13px] font-semibold mt-0.5 ${checkOut ? '' : 'text-white/45'}`}>{day(checkOut)}</p>
        </div>
      </div>
      <p className="relative text-[11px] text-white/70 mt-1.5">
        {nights > 0 ? `${nights} ${nights === 1 ? 'night' : 'nights'}` : 'Dates not set'} · {guests} {guests === 1 ? 'guest' : 'guests'}
      </p>
    </div>

    <div className="px-4 py-3">
      {lines.length ? (
        <ul className="space-y-1.5 sm:space-y-2">
          {lines.map((line) => (
            <li key={line.key} className="flex items-start justify-between gap-2.5 step-in">
              <span className="min-w-0">
                <span className="block text-xs sm:text-[13px] font-semibold text-[#18271E] leading-snug">{line.title}</span>
                <span className="block text-[10px] sm:text-[10.5px] text-[#637265] mt-0.5">{line.detail}</span>
              </span>
              <span className="text-xs sm:text-[13px] font-semibold text-[#18271E] shrink-0 text-right tabular-nums">
                {line.amount === null ? <span className="text-[11px] text-[#637265]">{line.note}</span> : formatMoney(line.amount)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[#8B9A8D]">Your picks and prices show up here as you go.</p>
      )}

      <div className="flex items-baseline justify-between gap-3 mt-3 pt-2.5 border-t border-dashed border-[#DCE2D8]">
        <span className="text-xs sm:text-sm font-semibold text-[#18271E]">Estimated total</span>
        <span className="text-base sm:text-lg font-bold text-[#18271E] tabular-nums">{formatMoney(total)}</span>
      </div>
      <p className="flex items-start gap-1.5 text-[10px] text-[#637265] leading-snug mt-2.5 rounded-lg bg-[#F4F7F1] px-2.5 py-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-[#2A4E38] shrink-0 mt-px" />
        Estimate only. Nothing is charged until confirmed by our team.
      </p>
    </div>
  </div>
);
