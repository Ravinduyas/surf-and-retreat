import React from 'react';
import { DateRangePicker } from './DateRangePicker';
import { getDateError, todayString } from './validation';

interface DatesStepProps {
  hasRoom: boolean;
  checkIn: string;
  checkOut: string;
  onChange: (field: 'checkIn' | 'checkOut', value: string) => void;
}

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const nightsBetween = (from: string, to: string) =>
  Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000);

const DateChip: React.FC<{ label: string; value: string; placeholder: string; active: boolean }> = ({
  label,
  value,
  placeholder,
  active,
}) => (
  <div
    className={`flex-1 min-w-0 rounded-xl border px-3.5 py-2.5 bg-[#F9FAF8] ${
      active ? 'border-[#2A4E38] ring-2 ring-[#2C573A]/15' : 'border-[#DCE2D8]'
    }`}
  >
    <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#8B9A8D]">{label}</span>
    <span className={`block text-sm font-semibold mt-0.5 truncate ${value ? 'text-[#18271E]' : 'text-[#9AA79C]'}`}>
      {value ? formatDate(value) : placeholder}
    </span>
  </div>
);

export const DatesStep: React.FC<DatesStepProps> = ({ hasRoom, checkIn, checkOut, onChange }) => {
  const today = todayString();
  const error = getDateError(hasRoom, checkIn, checkOut);
  const lodging = hasRoom;
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;

  const handleRange = (start: string, end: string) => {
    onChange('checkIn', start);
    onChange('checkOut', end);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <DateChip
          label={lodging ? 'Check-in' : 'Start date'}
          value={checkIn}
          placeholder="Select a date"
          active={!checkIn}
        />
        <DateChip
          label={lodging ? 'Check-out' : 'End date (optional)'}
          value={checkOut}
          placeholder={checkIn ? 'Select a date' : '—'}
          active={Boolean(checkIn) && !checkOut}
        />
      </div>

      <DateRangePicker start={checkIn} end={checkOut} min={today} allowSameDay={!lodging} onChange={handleRange} />

      <div className="flex items-center justify-between gap-3 min-h-5">
        {error ? (
          <p className="text-xs font-medium text-[#A0522D]" role="alert">
            {error}
          </p>
        ) : (
          <p className="text-xs text-[#637265]" aria-live="polite">
            {nights > 0
              ? `${nights} ${nights === 1 ? 'night' : 'nights'}`
              : checkIn && !checkOut
                ? lodging
                  ? 'Now pick your check-out day.'
                  : 'Pick an end date, or continue for a single day.'
                : 'Tap a day to start.'}
          </p>
        )}
        {checkIn && (
          <button
            type="button"
            onClick={() => handleRange('', '')}
            className="text-xs font-semibold text-[#2A4E38] hover:underline cursor-pointer shrink-0"
          >
            Clear dates
          </button>
        )}
      </div>
    </div>
  );
};
