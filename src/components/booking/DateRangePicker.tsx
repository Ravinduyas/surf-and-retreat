import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DateRangePickerProps {
  /** YYYY-MM-DD, or '' when unset. */
  start: string;
  end: string;
  /** Earliest selectable day (YYYY-MM-DD). */
  min: string;
  /** When true a one-day range (start === end) is allowed, e.g. a coworking day pass. */
  allowSameDay: boolean;
  onChange: (start: string, end: string) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parseKey = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return { y, m: m - 1 };
};

const addMonths = (y: number, m: number, delta: number) => {
  const d = new Date(y, m + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
};

interface MonthProps {
  year: number;
  month: number;
  start: string;
  end: string;
  hover: string;
  min: string;
  onPick: (key: string) => void;
  onHover: (key: string) => void;
  /** Hidden on narrow screens, which show a single month. */
  className?: string;
  prev?: React.ReactNode;
  next?: React.ReactNode;
}

const Month: React.FC<MonthProps> = ({ year, month, start, end, hover, min, onPick, onHover, className = '', prev, next }) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first offset.
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // While picking the end date, preview the range up to the hovered day.
  const rangeEnd = end || (start && hover > start ? hover : '');

  return (
    <div className={`flex-1 min-w-0 ${className}`}>
      <div className="flex items-center justify-between h-10 mb-1">
        <span className="w-10 flex justify-start">{prev}</span>
        <span className="text-sm font-bold text-[#18271E]">
          {new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <span className="w-10 flex justify-end">{next}</span>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d) => (
          <span key={d} className="text-center text-[10px] font-semibold uppercase tracking-wide text-[#8B9A8D] py-1">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />;
          const key = toKey(year, month, day);
          const disabled = key < min;
          const isStart = key === start;
          const isEnd = key === end;
          const selected = isStart || isEnd;
          // Band behind the days, so a range reads as one continuous strip.
          const inBand = Boolean(start) && rangeEnd > start && key >= start && key <= rangeEnd;
          const band = inBand
            ? `bg-[#E3EDE0] ${key === start ? 'rounded-l-full' : ''} ${key === rangeEnd ? 'rounded-r-full' : ''}`
            : '';

          return (
            <span key={key} className={`relative h-11 sm:h-10 flex items-center justify-center ${band}`}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(key)}
                onMouseEnter={() => onHover(key)}
                aria-label={new Date(year, month, day).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
                aria-pressed={selected}
                className={`w-10 h-10 sm:w-9 sm:h-9 rounded-full text-[13px] sm:text-xs font-medium transition-colors ${
                  selected
                    ? 'bg-[#2A4E38] text-white font-bold'
                    : disabled
                      ? 'text-[#C3CCC1] cursor-not-allowed'
                      : 'text-[#18271E] hover:bg-[#E3EDE0] cursor-pointer'
                }`}
              >
                {day}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
};

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ start, end, min, allowSameDay, onChange }) => {
  const [view, setView] = useState(() => parseKey(start || min));
  const [hover, setHover] = useState('');

  const minView = parseKey(min);
  const atMin = view.y === minView.y && view.m === minView.m;
  const second = addMonths(view.y, view.m, 1);

  const handlePick = (key: string) => {
    // Nothing chosen yet, a finished range, or a click before the start: begin a new range.
    if (!start || end || key < start) return onChange(key, '');
    if (key === start && !allowSameDay) return;
    onChange(start, key);
  };

  const navButton = (delta: number, disabled: boolean, label: string) => (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      onClick={() => setView((v) => addMonths(v.y, v.m, delta))}
      className="w-10 h-10 rounded-full flex items-center justify-center text-[#233829] hover:bg-[#F3F6F1] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
    >
      {delta < 0 ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="rounded-2xl border border-[#DCE2D8] bg-[#F9FAF8] p-3 sm:p-4" onMouseLeave={() => setHover('')}>
      <div className="flex gap-6">
        <Month
          year={view.y}
          month={view.m}
          start={start}
          end={end}
          hover={hover}
          min={min}
          onPick={handlePick}
          onHover={setHover}
          prev={navButton(-1, atMin, 'Previous month')}
          // On narrow screens this is the only month, so it carries the "next" arrow.
          next={<span className="sm:hidden">{navButton(1, false, 'Next month')}</span>}
        />
        <Month
          year={second.y}
          month={second.m}
          start={start}
          end={end}
          hover={hover}
          min={min}
          onPick={handlePick}
          onHover={setHover}
          className="hidden sm:block"
          next={navButton(1, false, 'Next month')}
        />
      </div>
    </div>
  );
};
