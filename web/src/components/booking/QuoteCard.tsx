import React from 'react';
import { formatMoney } from '../../pms';
import { QuoteLine } from './quote';

interface QuoteCardProps {
  lines: QuoteLine[];
  total: number;
}

/** Running price beside the step card: one line per item, then the total. */
export const QuoteCard: React.FC<QuoteCardProps> = ({ lines, total }) => (
  <div className="bg-white rounded-[28px] border border-[#E4EAE0] shadow-xs p-6">
    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7FA35B]">Your quote</p>
    <ul className="mt-4 space-y-3.5">
      {lines.map((line) => (
        <li key={line.key} className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[#18271E] leading-snug">{line.title}</span>
            <span className="block text-[11px] text-[#637265] mt-0.5">{line.detail}</span>
          </span>
          <span className="text-sm text-[#18271E] shrink-0 text-right">
            {line.amount === null ? <span className="text-xs text-[#637265]">{line.note}</span> : formatMoney(line.amount)}
          </span>
        </li>
      ))}
    </ul>
    <div className="flex items-baseline justify-between gap-3 mt-5 pt-5 border-t border-[#E5ECE2]">
      <span className="text-sm font-semibold text-[#18271E]">Total</span>
      <span className="text-xl font-bold text-[#18271E]">{formatMoney(total)}</span>
    </div>
    <p className="text-xs text-[#637265] leading-relaxed mt-3">
      An estimate, not a confirmed booking. Nothing is charged or held until we come back to you.
    </p>
  </div>
);
