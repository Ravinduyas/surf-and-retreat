import React from 'react';
import { CalendarDays } from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';
import { nightsBetween, todayString } from './validation';

interface DatesStepProps {
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string) => void;
}

const short = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** A one-month calendar in a bordered box, with the picked range and night count under it. */
export const DatesStep: React.FC<DatesStepProps> = ({ checkIn, checkOut, onChange }) => {
  const nights = nightsBetween(checkIn, checkOut);

  return (
    <div className="rounded-2xl border border-[#DCE2D8] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 pb-4 mb-4 border-b border-[#E5ECE2]">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-[#2A4E38] text-[#D8E95E] flex items-center justify-center shrink-0">
            <CalendarDays className="w-[18px] h-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-[#18271E] leading-tight">Choose your stay</p>
            <p className="text-xs text-[#637265] mt-0.5">
              {!checkIn ? 'Tap a start date, then an end date.' : !checkOut ? 'Now tap your check-out day.' : 'Tap any day to start over.'}
            </p>
          </div>
        </div>
        {checkIn && (
          <button
            type="button"
            onClick={() => onChange('', '')}
            className="text-xs font-semibold text-[#2A4E38] hover:underline cursor-pointer shrink-0 py-1"
          >
            Clear
          </button>
        )}
      </div>

      <DateRangePicker start={checkIn} end={checkOut} min={todayString()} allowSameDay={false} months={1} onChange={onChange} />

      <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-[#E5ECE2] text-xs">
        {checkIn && checkOut ? (
          <>
            <span className="font-semibold text-[#18271E]">
              {short(checkIn)} → {short(checkOut)}
            </span>
            <span className="rounded-full bg-[#F2F6F0] px-2.5 py-1 font-semibold text-[#2A4E38]">
              {nights} {nights === 1 ? 'night' : 'nights'}
            </span>
          </>
        ) : (
          <span className="text-[#637265]">{checkIn ? `Check-in ${short(checkIn)}, pick a check-out day` : 'No dates picked yet'}</span>
        )}
      </div>
    </div>
  );
};
