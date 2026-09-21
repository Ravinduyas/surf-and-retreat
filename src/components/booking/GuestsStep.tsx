import React from 'react';
import { Minus, Plus, Users } from 'lucide-react';
import { MAX_GUESTS } from './validation';

interface GuestsStepProps {
  guests: number;
  onChange: (guests: number) => void;
}

const StepperButton: React.FC<{
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, disabled, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    disabled={disabled}
    className="w-12 h-12 rounded-full border border-[#DCE2D8] flex items-center justify-center text-[#233829] hover:bg-white transition-colors cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
  >
    {children}
  </button>
);

export const GuestsStep: React.FC<GuestsStepProps> = ({ guests, onChange }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between p-5 rounded-2xl bg-[#F9FAF8] border border-[#DCE2D8]">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-full bg-white border border-[#DCE2D8] flex items-center justify-center text-[#2A4E38]">
          <Users className="w-5 h-5" />
        </span>
        <div>
          <span className="block text-sm font-bold text-[#18271E]">Guests</span>
          <span className="block text-xs text-[#637265] mt-0.5">Including you</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <StepperButton label="Fewer guests" disabled={guests <= 1} onClick={() => onChange(guests - 1)}>
          <Minus className="w-4 h-4" />
        </StepperButton>
        <span className="w-6 text-center text-xl font-bold text-[#18271E]" aria-live="polite">
          {guests}
        </span>
        <StepperButton label="More guests" disabled={guests >= MAX_GUESTS} onClick={() => onChange(guests + 1)}>
          <Plus className="w-4 h-4" />
        </StepperButton>
      </div>
    </div>

    <p className="text-xs text-[#637265] leading-relaxed">
      {guests >= MAX_GUESTS
        ? `That's the most one booking can cover (${MAX_GUESTS}). Bigger group? Get in touch and we'll arrange it.`
        : 'Rooms too small for your group will be greyed out on the next screen.'}
    </p>
  </div>
);
