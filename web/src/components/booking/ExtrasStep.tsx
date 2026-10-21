import React from 'react';
import { Check, Flower2, Zap } from 'lucide-react';
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

/** Optional skate and yoga. "Add" puts one in the quote and opens a counter; "Added" takes it out again. */
export const ExtrasStep: React.FC<ExtrasStepProps> = ({ extras, onChange }) => (
  <div className="space-y-3">
    <p className="text-xs text-[#637265]">
      Add surfskate or sunrise yoga if you want them. Each is priced per session, day or class pack, and you can always add more once you are here.
    </p>
    {EXTRAS.map((extra) => {
      const count = extras[extra.id] ?? 0;
      const Icon = isSkate(extra.id) ? Zap : Flower2;
      return (
        <div
          key={extra.id}
          className={`rounded-2xl border p-4 transition-colors ${count ? 'border-[#2A4E38] bg-[#F7FAF5]' : 'border-[#DCE2D8] bg-white'}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[15px] font-bold text-[#18271E]">
                <Icon className="w-4 h-4 text-[#2A4E38] shrink-0" />
                {extra.title}
              </p>
              <p className="text-xs text-[#637265] mt-0.5">
                {extra.meta} · <span className="font-semibold text-[#2A4E38]">{formatMoney(addonAmount(extra.id, extra.amount))}{extra.unit}</span>
              </p>
            </div>
            {count ? (
              <button
                type="button"
                onClick={() => onChange(extra.id, 0)}
                aria-label={`Remove ${extra.title}`}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[#2A4E38] bg-white text-[#2A4E38] text-xs font-semibold px-3.5 py-2 hover:bg-[#F2F6F0] transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Added
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onChange(extra.id, 1)}
                className="shrink-0 rounded-full bg-[#2A4E38] hover:bg-[#1E3A28] text-white text-xs font-semibold px-4 py-2 transition-colors cursor-pointer"
              >
                Add
              </button>
            )}
          </div>

          {count > 0 && (
            <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-[#E5ECE2]">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8B9A8D]">{countLabel(extra.unit)}</span>
              <Counter value={count} min={1} max={30} label={countLabel(extra.unit).toLowerCase()} onChange={(n) => onChange(extra.id, n)} />
            </div>
          )}
        </div>
      );
    })}
  </div>
);
