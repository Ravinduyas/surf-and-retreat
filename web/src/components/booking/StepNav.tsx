import React from 'react';
import { Check } from 'lucide-react';
import { StepDef } from './steps';

interface StepNavProps {
  steps: StepDef[];
  current: number;
  /** Jump back to an earlier step. Later steps aren't clickable until they're reached in order. */
  onJump: (index: number) => void;
}

/** Bottom bar: every step as an icon with its number, joined by a line that fills in as the guest moves on. */
export const StepNav: React.FC<StepNavProps> = ({ steps, current, onJump }) => (
  <nav
    aria-label="Booking steps"
    className="shrink-0 bg-white border-t border-[#E4EAE0] rounded-t-[24px] shadow-[0_-8px_30px_-12px_rgba(24,39,30,0.18)] px-3 sm:px-8 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
  >
    <ol className="max-w-4xl mx-auto flex items-start">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const Icon = step.icon;
        return (
          <li key={step.kind} className="flex-1 flex items-start min-w-0">
            <button
              type="button"
              onClick={() => done && onJump(i)}
              disabled={!done}
              aria-current={active ? 'step' : undefined}
              aria-label={`Step ${i + 1}: ${step.label}${done ? ' (done, go back)' : ''}`}
              className={`group shrink-0 flex flex-col items-center gap-1.5 w-9 sm:w-16 ${done ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span
                className={`relative w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-300 ${
                  active
                    ? 'bg-[#2A4E38] text-[#D8E95E] ring-4 ring-[#D8E95E]/45 shadow-md'
                    : done
                      ? 'bg-[#2A4E38] text-white group-hover:bg-[#1E3A28]'
                      : 'bg-white text-[#9AA79C] border border-[#DCE2D8]'
                }`}
              >
                {done ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : <Icon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />}
                <span
                  className={`absolute -top-1 -right-1 min-w-4 h-4 sm:min-w-[18px] sm:h-[18px] px-1 rounded-full text-[9px] sm:text-[10px] font-bold flex items-center justify-center border-2 border-white ${
                    active || done ? 'bg-[#D8E95E] text-[#193B26]' : 'bg-[#E5ECE2] text-[#6B796D]'
                  }`}
                >
                  {i + 1}
                </span>
              </span>
              <span
                className={`text-[10px] sm:text-xs font-semibold whitespace-nowrap ${
                  active ? 'text-[#18271E]' : done ? 'text-[#2A4E38]' : 'text-[#9AA79C]'
                } ${active ? '' : 'hidden sm:block'}`}
              >
                {step.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={`flex-1 h-0.5 mt-[18px] sm:mt-[22px] mx-0.5 sm:mx-1 rounded-full transition-colors duration-300 ${
                  done ? 'bg-[#2A4E38]' : 'bg-[#E5ECE2]'
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);
