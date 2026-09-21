import React from 'react';
import { ArrowLeft, X } from 'lucide-react';

interface StepProgressProps {
  stepIndex: number;
  totalSteps: number;
  title: string;
  subtitle: string;
  onBack: () => void;
  onClose: () => void;
}

export const StepProgress: React.FC<StepProgressProps> = ({
  stepIndex,
  totalSteps,
  title,
  subtitle,
  onBack,
  onClose,
}) => (
  <div className="shrink-0 px-4 sm:px-8 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-6 pb-4 sm:pb-5">
    <div className="flex items-center justify-between mb-4">
      {stepIndex > 0 ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="w-11 h-11 sm:w-9 sm:h-9 rounded-full border border-[#D7E0D5] flex items-center justify-center text-[#233829] hover:bg-[#F3F6F1] transition-colors cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      ) : (
        <span className="w-11 h-11 sm:w-9 sm:h-9" aria-hidden="true" />
      )}

      <span className="text-[11px] font-semibold tracking-wider uppercase text-[#8B9A8D]">
        Step {stepIndex + 1} of {totalSteps}
      </span>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close booking"
        className="w-11 h-11 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-[#6B796D] hover:text-[#18271E] hover:bg-[#F2F5F0] transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>

    <div className="flex gap-1.5 mb-4">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
            i <= stepIndex ? 'bg-[#2A4E38]' : 'bg-[#E5ECE2]'
          }`}
        />
      ))}
    </div>

    <h3 className="text-xl sm:text-2xl font-bold text-[#18271E]">{title}</h3>
    <p className="text-xs sm:text-sm text-[#637265] mt-1">{subtitle}</p>
  </div>
);
