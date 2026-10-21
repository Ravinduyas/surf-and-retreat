import React from 'react';
import { BookingType } from '../../types';

const TYPES: { type: BookingType; title: string; text: string }[] = [
  { type: 'rooms', title: 'Rooms only', text: 'A dorm bed or a private room, nothing else.' },
  { type: 'surf', title: 'Rooms + surf packages', text: 'A stay with surf lessons or a board.' },
  { type: 'coworking', title: 'Rooms + coworking', text: 'Somewhere to sleep and a desk on 300 Mbps fiber.' },
];

interface TypeStepProps {
  value: BookingType;
  onChange: (type: BookingType) => void;
}

/** First step: three cards, the chosen one filled in. It decides which steps follow. */
export const TypeStep: React.FC<TypeStepProps> = ({ value, onChange }) => (
  <div role="radiogroup" aria-label="What are you booking" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
    {TYPES.map(({ type, title, text }) => {
      const active = value === type;
      return (
        <button
          key={type}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(type)}
          className={`min-h-[120px] sm:min-h-[136px] flex flex-col justify-between gap-6 rounded-2xl border p-4 text-left transition-colors cursor-pointer ${
            active
              ? 'bg-[#2A4E38] border-[#2A4E38] text-white'
              : 'bg-white border-[#DCE2D8] text-[#18271E] hover:border-[#9DB09A]'
          }`}
        >
          <span className="text-[15px] font-bold leading-snug">{title}</span>
          <span className={`text-xs leading-relaxed ${active ? 'text-white/80' : 'text-[#637265]'}`}>{text}</span>
        </button>
      );
    })}
  </div>
);
