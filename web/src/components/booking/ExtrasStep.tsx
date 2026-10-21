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

/** " / session" → "Sessions", " / 5 classes" → "Packs". */
const countLabel = (unit: string) => {
  const u = unit.replace(/^\s*\/\s*/, '');
  if (/^\d/.test(u)) return 'Packs';
  const plural = u.endsWith('s') ? `${u}es` : `${u}s`;
  return plural.charAt(0).toUpperCase() + plural.slice(1);
};

const isSkate = (id: string) => SKATE_OPTIONS.some((s) => s.id === id);

/** Skate and yoga as icon cards. "Add" puts one in the quote and opens a counter; "Added" takes it out. */
export const ExtrasStep: React.FC<ExtrasStepProps> = ({ extras, onChange }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
    {EXTRAS.map((extra) => {
      const count = extras[extra.id] ?? 0;
      const Icon = isSkate(extra.id) ? Zap : Flower2;
      return (
        <div
          key={extra.id}
          className={`flex flex-col rounded-2xl border overflow-hidden transition-all duration-300 ${
            count ? 'border-[#2A4E38] ring-1 ring-[#2A4E38] bg-[#F7FAF5]' : 'border-[#DCE2D8] bg-white'
          }`}
        >
          <div className="flex-1 flex flex-col gap-2.5 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <span
                  className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center transition-colors ${
                    count ? 'bg-[#2A4E38] text-[#D8E95E]' : 'bg-[#F2F6F0] text-[#2A4E38]'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#18271E] leading-snug">{extra.title}</p>
                  <p className="text-[11px] text-[#637265] mt-0.5">{extra.meta}</p>
                </div>
              </div>
              <p className="text-sm font-bold text-[#18271E] shrink-0 tabular-nums">
                {formatMoney(addonAmount(extra.id, extra.amount))}
                <span className="block text-[10px] font-normal text-[#637265] text-right">{extra.unit.replace(/^\s*\/\s*/, 'per ')}</span>
              </p>
            </div>

            <div className="mt-auto flex items-center justify-between gap-3">
              {count ? (
                <>
                  <button
                    type="button"
                    onClick={() => onChange(extra.id, 0)}
                    aria-label={`Remove ${extra.title}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#2A4E38] text-white text-xs font-semibold px-3.5 py-2 hover:bg-[#1E3A28] transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Added
                  </button>
                  <Counter value={count} min={1} max={30} label={countLabel(extra.unit).toLowerCase()} onChange={(n) => onChange(extra.id, n)} />
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => onChange(extra.id, 1)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#2A4E38] text-[#2A4E38] text-xs font-semibold px-3.5 py-2 hover:bg-[#2A4E38] hover:text-white transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              )}
            </div>
          </div>
        </div>
      );
    })}
  </div>
);
