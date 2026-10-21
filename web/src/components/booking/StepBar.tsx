import React from 'react';
import { Check } from 'lucide-react';
import { StepDef } from './steps';

interface StepBarProps {
  steps: StepDef[];
  current: number;
  /** Jump back to a finished step. Steps ahead can only be reached with Continue. */
  onJump: (index: number) => void;
}

/**
 * Labelled steps joined by a track that fills as the guest moves on. Finished steps show a tick and can be
 * tapped to go back; on phones only the current step keeps its label.
 */
export const StepBar: React.FC<StepBarProps> = ({ steps, current, onJump }) => {
  const progress = steps.length > 1 ? (current / (steps.length - 1)) * 100 : 0;

  return (
    <nav aria-label="Booking steps" className="relative">
      {/* Track behind the icons, inset by half an icon so it runs centre to centre */}
      <div aria-hidden="true" className="absolute left-4 right-4 top-4 h-[3px] -translate-y-1/2 rounded-full bg-[#E4EAE0]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#2A4E38] to-[#7FA35B] transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ol className="relative flex items-start justify-between">
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          const Icon = step.icon;
          return (
            <li key={step.kind} className="flex flex-col items-center gap-1.5 w-8">
              <button
                type="button"
                onClick={() => done && onJump(i)}
                disabled={!done}
                aria-current={active ? 'step' : undefined}
                aria-label={`Step ${i + 1}: ${step.label}${done ? ' (done, go back)' : ''}`}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  active
                    ? 'bg-[#2A4E38] text-[#D8E95E] ring-4 ring-[#D8E95E]/40 shadow-md scale-110'
                    : done
                      ? 'bg-[#2A4E38] text-white hover:bg-[#1E3A28] cursor-pointer'
                      : 'bg-white text-[#A7B3A6] border border-[#DCE2D8]'
                }`}
              >
                {done ? <Check className="w-3.5 h-3.5" strokeWidth={2.6} /> : <Icon className="w-[15px] h-[15px]" />}
              </button>
              <span
                className={`text-[10px] font-semibold whitespace-nowrap transition-colors ${
                  active ? 'text-[#18271E]' : done ? 'text-[#2A4E38] hidden sm:block' : 'text-[#9AA79C] hidden sm:block'
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
