import React from 'react';
import { Check } from 'lucide-react';
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
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Desk pass" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {COWORKING_PLANS.map((p) => {
          const active = desk.planId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onPlan(p.id)}
              className={`flex flex-col gap-3 rounded-2xl border p-4 text-left transition-colors cursor-pointer ${
                active ? 'bg-[#2A4E38] border-[#2A4E38] text-white' : 'bg-white border-[#DCE2D8] text-[#18271E] hover:border-[#9DB09A]'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-bold">{p.name}</span>
                {p.popular && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#193B26] bg-[#D8E95E] rounded-full px-2 py-0.5">
                    Popular
                  </span>
                )}
              </span>
              <span className="flex items-baseline gap-1">
                <span className="text-xl font-bold leading-none">{formatMoney(addonAmount(p.id, p.amount))}</span>
                <span className={`text-xs ${active ? 'text-white/75' : 'text-[#637265]'}`}>{p.period}</span>
              </span>
              <ul className={`space-y-1 text-xs leading-snug ${active ? 'text-white/85' : 'text-[#4B5A4E]'}`}>
                {p.features.slice(0, 3).map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <Check className="w-3.5 h-3.5 shrink-0 mt-px" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {plan && (
        <div className="rounded-2xl border border-[#DCE2D8] divide-y divide-[#E5ECE2]">
          <div className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm font-bold text-[#18271E]">Desks</p>
              <p className="text-xs text-[#637265] mt-0.5">One per person working</p>
            </div>
            <Counter value={desk.people} min={1} max={guests} label="desks" onChange={(people) => onChange({ ...desk, people })} />
          </div>
          <div className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm font-bold text-[#18271E] capitalize">{unit}s</p>
              <p className="text-xs text-[#637265] mt-0.5">Set to cover your stay; change it if you work fewer {unit}s</p>
            </div>
            <Counter value={desk.periods} min={1} max={unit === 'day' ? 60 : 12} label={`${unit}s`} onChange={(periods) => onChange({ ...desk, periods })} />
          </div>
        </div>
      )}
    </div>
  );
};
