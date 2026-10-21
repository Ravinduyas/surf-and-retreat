import React from 'react';
import { Check, Laptop } from 'lucide-react';
import { COWORKING_PLANS } from '../../data';
import { BookingFormState } from '../../types';
import { formatMoney } from '../../pms';
import { Counter } from './Counter';
import { addonAmount, findPlan, planPeriod } from './options';

interface DeskStepProps {
  desk: BookingFormState['desk'];
  guests: number;
  onPlan: (planId: string) => void;
  onChange: (desk: BookingFormState['desk']) => void;
}

/** The three desk passes as cards, then how many desks and for how long. */
export const DeskStep: React.FC<DeskStepProps> = ({ desk, guests, onPlan, onChange }) => {
  const plan = findPlan(desk.planId);
  const unit = plan ? planPeriod(plan.period) : '';

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Desk pass" className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {COWORKING_PLANS.map((p) => {
          const active = desk.planId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onPlan(p.id)}
              className={`relative flex flex-col gap-2 rounded-2xl border p-4 text-left transition-all duration-300 cursor-pointer ${
                active
                  ? 'bg-[#1F3A2A] border-[#1F3A2A] text-white shadow-[0_16px_40px_-24px_rgba(31,58,42,0.9)]'
                  : 'bg-white border-[#DCE2D8] text-[#18271E] hover:border-[#9DB09A] hover:-translate-y-0.5'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? 'bg-[#D8E95E] text-[#1F3A2A]' : 'bg-[#F2F6F0] text-[#2A4E38]'}`}>
                  <Laptop className="w-4 h-4" />
                </span>
                {p.popular && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#193B26] bg-[#D8E95E] rounded-full px-2 py-0.5">Popular</span>
                )}
              </span>
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold">{p.name}</span>
                <span className="flex items-baseline gap-1">
                  <span className="text-xl font-bold leading-none tabular-nums">{formatMoney(addonAmount(p.id, p.amount))}</span>
                  <span className={`text-[11px] ${active ? 'text-white/70' : 'text-[#637265]'}`}>{p.period}</span>
                </span>
              </span>
              <ul className={`space-y-1 pt-2 border-t text-[11px] leading-snug ${active ? 'border-white/15 text-white/85' : 'border-[#EEF2EB] text-[#4B5A4E]'}`}>
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <Check className={`w-3.5 h-3.5 shrink-0 mt-px ${active ? 'text-[#D8E95E]' : 'text-[#2A4E38]'}`} />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {plan && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 step-in">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#DCE2D8] bg-white px-4 py-3">
            <div>
              <p className="text-sm font-bold text-[#18271E]">Desks</p>
              <p className="text-[11px] text-[#637265]">One per person working</p>
            </div>
            <Counter value={desk.people} min={1} max={guests} label="desks" onChange={(people) => onChange({ ...desk, people })} />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#DCE2D8] bg-white px-4 py-3">
            <div>
              <p className="text-sm font-bold text-[#18271E] capitalize">{unit}s</p>
              <p className="text-[11px] text-[#637265]">Covers your stay · lower it if you work less</p>
            </div>
            <Counter
              value={desk.periods}
              min={1}
              max={unit === 'day' ? 60 : 12}
              label={`${unit}s`}
              onChange={(periods) => onChange({ ...desk, periods })}
            />
          </div>
        </div>
      )}
    </div>
  );
};
