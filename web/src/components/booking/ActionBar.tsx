import React from 'react';
import { ArrowLeft, ChevronUp } from 'lucide-react';
import { formatMoney } from '../../pms';
import { StepDef } from './steps';

interface ActionBarProps {
  steps: StepDef[];
  current: number;
  /** Says what's missing when the main button is disabled, or what comes next. */
  hint: string | null;
  blocked: boolean;
  total: number;
  onBack: () => void;
  /** Phones: opens the quote sheet. */
  onOpenQuote: () => void;
  /** Continue, or on the last step the send link. */
  primary: React.ReactNode;
}

/**
 * Pinned to the bottom of the screen on every step, so Back and Continue never move. The middle says where
 * the guest is and what's missing; phones get the running total there instead, which opens the quote.
 */
export const ActionBar: React.FC<ActionBarProps> = ({ steps, current, hint, blocked, total, onBack, onOpenQuote, primary }) => {
  const step = steps[current];
  const next = steps[current + 1];

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E4EAE0] bg-white/90 backdrop-blur-xl shadow-[0_-12px_40px_-20px_rgba(24,39,30,0.25)]">
      {/* Thin progress line across the top edge of the bar */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px] bg-[#EEF2EB]">
        <div
          className="h-full bg-[#7FA35B] transition-[width] duration-500 ease-out"
          style={{ width: `${((current + 1) / steps.length) * 100}%` }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-2 flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={onBack}
          disabled={current === 0}
          aria-label="Back"
          className="shrink-0 h-9.5 sm:h-10 w-9.5 sm:w-auto sm:px-4 rounded-full border border-[#DCE2D8] bg-white text-[#2A4E38] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 hover:border-[#2A4E38] hover:bg-[#F7FAF5] transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:border-[#DCE2D8] disabled:hover:bg-white"
        >
          <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Back</span>
        </button>

        {/* Wide screens: where you are and what's missing */}
        <div className="hidden sm:block flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7FA35B]">
            Step {current + 1} of {steps.length} · {step.label}
          </p>
          <p className={`text-sm mt-0.5 truncate ${blocked ? 'text-[#A0522D] font-medium' : 'text-[#4B5A4E]'}`}>
            {hint ?? (next ? `Next up: ${next.label.toLowerCase()}` : 'Last step')}
          </p>
        </div>

        {/* Phones: the running total, which opens the full quote */}
        <button
          type="button"
          onClick={onOpenQuote}
          className="sm:hidden flex-1 min-w-0 text-left cursor-pointer"
          aria-label="Show your quote"
        >
          <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#7FA35B]">
            Step {current + 1}/{steps.length} · Total
          </span>
          <span className="flex items-center gap-1 text-lg font-bold text-[#18271E] tabular-nums leading-tight">
            {formatMoney(total)}
            <ChevronUp className="w-4 h-4 text-[#637265]" />
          </span>
        </button>

        <div className="shrink-0">{primary}</div>
      </div>
    </div>
  );
};
