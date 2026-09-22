import React from 'react';
import { Check, Laptop } from 'lucide-react';
import { COWORKING_PLANS } from '../../data';
import { ExtraRequiredNote } from './ExtraRequiredNote';

interface CoworkingStepProps {
  value: string;
  /** The guest has no bed and no other extra, so this is the only thing left to book. */
  required: boolean;
  onChange: (id: string) => void;
}

/**
 * Coworking screen: the three desk passes side by side with their price and perks, so the guest can
 * compare them without leaving the booking. Tapping a selected pass again removes it.
 */
export const CoworkingStep: React.FC<CoworkingStepProps> = ({ value, required, onChange }) => (
  <div className="space-y-4">
    {required && !value && <ExtraRequiredNote />}

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {COWORKING_PLANS.map((plan) => {
        const active = value === plan.id;
        return (
          <button
            key={plan.id}
            type="button"
            onClick={() => onChange(active ? '' : plan.id)}
            aria-pressed={active}
            className={`relative w-full flex flex-col text-left rounded-2xl border p-4 transition-all cursor-pointer ${
              active
                ? 'bg-[#F2F6F0] border-[#2A4E38] ring-1 ring-[#2A4E38]'
                : 'bg-[#F9FAF8] border-[#DCE2D8] hover:bg-white hover:border-[#B9C8B7]'
            }`}
          >
            <span className="flex items-center justify-between gap-2 pr-7">
              <span
                className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center ${
                  active ? 'bg-[#2A4E38] text-white' : 'bg-white text-[#2A4E38] border border-[#DCE2D8]'
                }`}
              >
                <Laptop className="w-4.5 h-4.5" />
              </span>
              {plan.popular && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#193B26] bg-[#D8E95E] rounded-full px-2 py-0.5 whitespace-nowrap">
                  Most popular
                </span>
              )}
            </span>

            <span className="block text-[15px] font-bold text-[#18271E] leading-snug mt-3">{plan.name}</span>
            <span className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold text-[#2A4E38] leading-none">{plan.price}</span>
              <span className="text-xs text-[#637265]">{plan.period}</span>
            </span>

            <ul className="mt-3 pt-3 border-t border-[#E5ECE2] space-y-1.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-1.5 text-xs text-[#4B5A4E] leading-snug">
                  <Check className="w-3.5 h-3.5 text-[#2A4E38] shrink-0 mt-px" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {active && (
              <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#2A4E38] text-white flex items-center justify-center shadow-xs">
                <Check className="w-3.5 h-3.5" />
              </span>
            )}
          </button>
        );
      })}
    </div>

    <p className="text-xs text-[#637265]">
      Passes run from your first working day. Month Pass holders can reserve a dedicated desk on arrival.
    </p>
  </div>
);
