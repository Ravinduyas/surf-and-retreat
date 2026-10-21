import React from 'react';
import { Check } from 'lucide-react';
import { StepDef } from './steps';

interface StepBarProps {
  steps: StepDef[];
  current: number;
  /** Jump back to a finished step. Steps ahead can only be reached with Continue. */
  onJump: (index: number) => void;
}

/** One icon per step joined by a line: done steps show a tick, the current one is filled. */
export const StepBar: React.FC<StepBarProps> = ({ steps, current, onJump }) => (
  <nav aria-label="Booking steps">
    <ol className="flex items-center">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const Icon = step.icon;
        return (
          <li key={step.kind} className={`flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}`}>
            <button
              type="button"
              onClick={() => done && onJump(i)}
              disabled={!done}
              aria-current={active ? 'step' : undefined}
              aria-label={`Step ${i + 1}: ${step.label}${done ? ' (done, go back)' : ''}`}
              title={step.label}
              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300 ${
                active
                  ? 'bg-[#2A4E38] text-[#D8E95E] shadow-sm'
                  : done
                    ? 'bg-white text-[#2A4E38] border border-[#DCE2D8] hover:border-[#2A4E38] cursor-pointer'
                    : 'bg-white text-[#B3BEB2] border border-[#E4EAE0]'
              }`}
            >
              {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
            </button>
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={`flex-1 h-px mx-2 transition-colors duration-300 ${done ? 'bg-[#9DB09A]' : 'bg-[#E4EAE0]'}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);
