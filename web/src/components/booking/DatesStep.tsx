import React from 'react';
import { ArrowRight, Moon } from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';
import { nightsBetween, todayString } from './validation';

interface DatesStepProps {
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string) => void;
}

const QUICK = [
  { label: '1 week', nights: 7 },
  { label: '2 weeks', nights: 14 },
  { label: '1 month', nights: 30 },
];

const addDays = (key: string, days: number) => {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const long = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** Check-in and check-out tiles that light up as they're picked, quick lengths, then the calendar. */
export const DatesStep: React.FC<DatesStepProps> = ({ checkIn, checkOut, onChange }) => {
  const nights = nightsBetween(checkIn, checkOut);
  const picking = checkIn && !checkOut ? 'out' : !checkIn ? 'in' : null;

  const tile = (label: string, value: string, focus: boolean) => (
    <div
      className={`flex-1 min-w-0 rounded-xl border px-3 py-1.5 sm:py-2 transition-colors ${
        focus ? 'border-[#2A4E38] bg-[#F7FAF5] ring-2 ring-[#2A4E38]/15' : 'border-[#DCE2D8] bg-white'
      }`}
    >
      <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#7FA35B]">{label}</p>
      <p className={`text-[13px] sm:text-sm font-bold mt-0.5 truncate ${value ? 'text-[#18271E]' : 'text-[#B3BEB2]'}`}>
        {value ? long(value) : 'Select a day'}
      </p>
    </div>
  );

  return (
    <div className="space-y-2.5">
      <div className="flex items-stretch gap-2 sm:gap-2.5">
        {tile('Check-in', checkIn, picking === 'in')}
        <span className="self-center shrink-0 w-7 h-7 rounded-full bg-[#F2F6F0] text-[#2A4E38] flex items-center justify-center">
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
        {tile('Check-out', checkOut, picking === 'out')}
        <div className="hidden sm:flex shrink-0 items-center gap-1.5 rounded-xl bg-[#1F3A2A] text-white px-3 py-1.5">
          <Moon className="w-3.5 h-3.5 text-[#D8E95E]" />
          <span className="text-base font-bold leading-none tabular-nums">{nights || '-'}</span>
          <span className="text-[9.5px] uppercase tracking-[0.14em] text-white/60">{nights === 1 ? 'night' : 'nights'}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#8B9A8D] mr-1">Quick pick</span>
        {QUICK.map((q) => {
          const base = checkIn || todayString();
          const active = Boolean(checkIn) && nights === q.nights;
          return (
            <button
              key={q.label}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(base, addDays(base, q.nights))}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                active ? 'bg-[#2A4E38] text-white border-[#2A4E38]' : 'bg-white text-[#243F2D] border-[#DCE2D8] hover:border-[#9DB09A]'
              }`}
            >
              {q.label}
            </button>
          );
        })}
        {checkIn && (
          <button type="button" onClick={() => onChange('', '')} className="ml-auto text-xs font-semibold text-[#2A4E38] hover:underline cursor-pointer py-1">
            Clear dates
          </button>
        )}
      </div>

      <div className="rounded-xl border border-[#E5ECE2] bg-[#FAFBF9] p-2 sm:p-3">
        <DateRangePicker start={checkIn} end={checkOut} min={todayString()} allowSameDay={false} onChange={onChange} />
      </div>
    </div>
  );
};
