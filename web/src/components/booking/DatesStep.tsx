import React from 'react';
import { CalendarDays, Zap } from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';
import { Panel } from './Panel';
import { getDateError, nightsBetween, todayString } from './validation';

interface DatesStepProps {
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string) => void;
}

const QUICK_PICKS = [
  { label: '1 Week', nights: 7 },
  { label: '2 Weeks', nights: 14 },
  { label: '3 Weeks', nights: 21 },
];

const addDays = (key: string, days: number) => {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const LegendDot: React.FC<{ className: string; label: string }> = ({ className, label }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className={`w-2.5 h-2.5 rounded-full ${className}`} aria-hidden="true" />
    {label}
  </span>
);

export const DatesStep: React.FC<DatesStepProps> = ({ checkIn, checkOut, onChange }) => {
  const today = todayString();
  const error = getDateError(checkIn, checkOut);
  const nights = nightsBetween(checkIn, checkOut);
  const base = checkIn || today;

  const hint = !checkIn
    ? 'Tap a start date, then an end date.'
    : !checkOut
      ? 'Now tap your check-out day — or the same day again for a single day.'
      : 'Tap any day to start over.';

  return (
    <Panel
      icon={CalendarDays}
      title="Choose your stay"
      hint={hint}
      aside={
        checkIn && (
          <button
            type="button"
            onClick={() => onChange('', '')}
            className="text-xs font-semibold text-[#2A4E38] hover:underline cursor-pointer shrink-0 py-1"
          >
            Clear
          </button>
        )
      }
    >
      <div className="rounded-2xl border border-[#E5ECE2] bg-[#FAFBF9] p-3 sm:p-4">
        <DateRangePicker start={checkIn} end={checkOut} min={today} allowSameDay onChange={onChange} />
      </div>

      {error && (
        <p className="text-xs font-medium text-[#A0522D] mt-3" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7FA35B] mr-1">
          <Zap className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
          Quick pick
        </span>
        {QUICK_PICKS.map((pick) => {
          const active = checkIn === base && nights === pick.nights;
          return (
            <button
              key={pick.label}
              type="button"
              onClick={() => onChange(base, addDays(base, pick.nights))}
              aria-pressed={active}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                active
                  ? 'bg-[#2A4E38] text-white border-[#2A4E38]'
                  : 'bg-white text-[#243F2D] border-[#DCE2D8] hover:border-[#B9C8B7]'
              }`}
            >
              {pick.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-[#7A897C]">
        <LegendDot className="bg-[#2A4E38]" label="Selected" />
        <LegendDot className="bg-[#E3EDD2]" label="In range" />
        <LegendDot className="bg-[#7FA35B] scale-50" label="Today" />
      </div>
    </Panel>
  );
};
