import React from 'react';
import { Check, Flower2, Plus, Zap } from 'lucide-react';
import { SKATE_OPTIONS } from '../../data';
import { BookingFormState } from '../../types';
import { formatMoney } from '../../pms';
import { Counter } from './Counter';
import { EXTRAS, addonAmount } from './options';

interface ExtrasStepProps {
  extras: BookingFormState['extras'];
  onChange: (id: string, count: number) => void;
}

/** " / session" → "sessions", " / 5 classes" → "packs". */
const countLabel = (unit: string) => {
  const u = unit.replace(/^\s*\/\s*/, '');
  if (/^\d/.test(u)) return 'packs';
  return u.endsWith('s') ? `${u}es` : `${u}s`;
};

const isSkate = (id: string) => SKATE_OPTIONS.some((s) => s.id === id);

/**
 * The four extras as thin rows, one under the other: icon, title and detail on the left, price and Add
 * on the right. Adding fills the row and swaps Add for a quantity counter with the line total.
 */
export const ExtrasStep: React.FC<ExtrasStepProps> = ({ extras, onChange }) => (
  <ul className="space-y-2">
    {EXTRAS.map((extra) => {
      const count = extras[extra.id] ?? 0;
      const added = count > 0;
      const Icon = isSkate(extra.id) ? Zap : Flower2;
      const price = addonAmount(extra.id, extra.amount);
      const unit = extra.unit.replace(/^\s*\/\s*/, '');
      return (
        <li
          key={extra.id}
          className={`group flex items-center gap-3 sm:gap-4 rounded-2xl border px-3 py-2.5 sm:px-4 transition-all duration-300 ${
            added
              ? 'border-[#2A4E38] bg-[#F7FAF5] ring-1 ring-[#2A4E38]'
              : 'border-[#DCE2D8] bg-white hover:border-[#9DB09A] hover:shadow-[0_14px_30px_-24px_rgba(24,39,30,0.45)]'
          }`}
        >
          <button
            type="button"
            onClick={() => onChange(extra.id, added ? 0 : 1)}
            aria-pressed={added}
            aria-label={`${added ? 'Remove' : 'Add'} ${extra.title}`}
            title={extra.description}
            className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer"
          >
            <span
              className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center transition-colors ${
                added ? 'bg-[#2A4E38] text-[#D8E95E]' : 'bg-[#F2F6F0] text-[#2A4E38] group-hover:bg-[#E3EDD2]'
              }`}
            >
              {added ? <Check className="w-4 h-4" strokeWidth={3} /> : <Icon className="w-4 h-4" />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-bold text-[#18271E] leading-snug truncate">{extra.title}</span>
                <span className="hidden sm:inline rounded-full bg-[#F2F6F0] px-2 py-0.5 text-[10px] font-semibold text-[#2A4E38] shrink-0">
                  {isSkate(extra.id) ? 'Skate' : 'Yoga'}
                </span>
              </span>
              <span className="block text-[11px] text-[#637265] leading-snug truncate mt-0.5">
                {extra.meta}
                <span className="hidden md:inline"> · {extra.description}</span>
              </span>
            </span>
          </button>

          <span className="shrink-0 text-right w-[72px] sm:w-[84px]">
            <span className="block text-base font-bold text-[#18271E] tabular-nums leading-none">
              {added ? formatMoney(price * count) : formatMoney(price)}
            </span>
            <span className="block text-[10px] text-[#637265] mt-1 truncate">{added ? `${formatMoney(price)} / ${unit}` : `per ${unit}`}</span>
          </span>

          <span className="shrink-0 w-[92px] sm:w-[108px] flex justify-end">
            {added ? (
              <Counter value={count} min={0} max={30} label={countLabel(extra.unit)} onChange={(n) => onChange(extra.id, n)} />
            ) : (
              <button
                type="button"
                onClick={() => onChange(extra.id, 1)}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#2A4E38] text-white text-xs font-semibold pl-3 pr-3.5 py-2 hover:bg-[#1E3A28] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                Add
              </button>
            )}
          </span>
        </li>
      );
    })}
  </ul>
);
