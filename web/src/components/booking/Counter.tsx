import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface CounterProps {
  value: number;
  min: number;
  max: number;
  /** What is being counted, for the buttons' accessible names ("guests", "beds"...). */
  label: string;
  onChange: (value: number) => void;
}

/** A pill with − and + either side of the number. */
export const Counter: React.FC<CounterProps> = ({ value, min, max, label, onChange }) => {
  const btn =
    'w-7 h-7 rounded-full flex items-center justify-center text-[#233829] hover:bg-[#F2F6F0] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed';
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-[#DCE2D8] bg-white p-0.5 shrink-0">
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`Fewer ${label}`}>
        <Minus className="w-3 h-3" />
      </button>
      <span className="w-5 text-center text-xs sm:text-sm font-semibold text-[#18271E]" aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`More ${label}`}>
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
};
