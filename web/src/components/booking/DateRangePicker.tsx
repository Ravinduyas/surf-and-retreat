import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DateRangePickerProps {
  /** YYYY-MM-DD, or '' when unset. */
  start: string;
  end: string;
  /** Earliest selectable day (YYYY-MM-DD), also marked as today. */
  min: string;
  /** When true a one-day range (start === end) is allowed, e.g. a coworking day pass. */
  allowSameDay: boolean;
  onChange: (start: string, end: string) => void;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

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

const monthIndex = (v: { y: number; m: number }) => v.y * 12 + v.m;

interface MonthProps {
  year: number;
  month: number;
  start: string;
  rangeEnd: string;
  end: string;
  min: string;
  onPick: (key: string) => void;
  onHover: (key: string) => void;
  prev?: React.ReactNode;
  next?: React.ReactNode;
  className?: string;
}

const Month: React.FC<MonthProps> = ({ year, month, start, rangeEnd, end, min, onPick, onHover, prev, next, className = '' }) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first. Always six rows, so two months side by side stay the same height.
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => {
    const n = i - offset + 1;
    return n >= 1 && n <= daysInMonth ? n : null;
  });

  return (
    <div className={`flex-1 min-w-0 ${className}`}>
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#E5ECE2]">
        <span className="w-9">{prev}</span>
        <span className="text-sm font-bold text-[#18271E]">
          {new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <span className="w-9 flex justify-end">{next}</span>
      </div>

      <div className="grid grid-cols-7 gap-x-1 sm:gap-x-1.5 mb-1">
        {WEEKDAYS.map((d) => (
          <span key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-[#8B9A8D] py-2">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-x-1 sm:gap-x-1.5 gap-y-1">
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} className="h-10 lg:h-9" aria-hidden="true" />;
          const key = toKey(year, month, day);
          const disabled = key < min;
          const selected = key === start || key === end;
          const inRange = Boolean(start) && Boolean(rangeEnd) && key > start && key < rangeEnd;
          const isToday = key === min;

          return (
            <button
              key={key}
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
              className={`relative h-10 lg:h-9 rounded-full text-[13px] font-medium transition-colors ${
                selected
                  ? 'bg-[#2A4E38] text-white font-bold shadow-sm'
                  : inRange
                    ? 'bg-[#E3EDD2] text-[#1E3A28] cursor-pointer'
                    : disabled
                      ? 'text-[#C3CCC1] cursor-not-allowed'
                      : 'text-[#18271E] hover:bg-[#EEF3EA] cursor-pointer'
              }`}
            >
              {day}
              {isToday && !selected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#7FA35B]" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Two months side by side from tablet width up, one on phones. Pill-shaped days: the ends of the range
 * are solid, the days between are tinted.
 */
export const DateRangePicker: React.FC<DateRangePickerProps> = ({ start, end, min, allowSameDay, onChange }) => {
  const [view, setView] = useState(() => parseKey(start || min));
  const [hover, setHover] = useState('');

  // Follow quick picks and other outside changes, but only when the start is off-screen, so picking a
  // day in the second month doesn't make the calendar jump.
  useEffect(() => {
    if (!start) return;
    const s = monthIndex(parseKey(start));
    setView((v) => (s === monthIndex(v) || s === monthIndex(v) + 1 ? v : parseKey(start)));
  }, [start]);

  const atMin = monthIndex(view) <= monthIndex(parseKey(min));
  const second = addMonths(view.y, view.m, 1);

  const handlePick = (key: string) => {
    // Nothing chosen yet, a finished range, or a click before the start: begin a new range.
    if (!start || end || key < start) return onChange(key, '');
    if (key === start && !allowSameDay) return;
    onChange(start, key);
  };

  // While picking the end date, preview the range up to the hovered day.
  const rangeEnd = end || (start && hover > start ? hover : '');

  const navButton = (delta: number, disabled: boolean, label: string) => (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      onClick={() => setView((v) => addMonths(v.y, v.m, delta))}
      className="w-9 h-9 rounded-full flex items-center justify-center text-[#233829] hover:bg-[#F3F6F1] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
    >
      {delta < 0 ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
    </button>
  );

  const shared = { start, end, rangeEnd, min, onPick: handlePick, onHover: setHover };

  return (
    <div className="flex gap-5 sm:gap-6" onMouseLeave={() => setHover('')}>
      <Month
        {...shared}
        year={view.y}
        month={view.m}
        prev={navButton(-1, atMin, 'Previous month')}
        // On phones this is the only month, so it carries the "next" arrow too.
        next={<span className="sm:hidden">{navButton(1, false, 'Next month')}</span>}
      />
      <Month
        {...shared}
        year={second.y}
        month={second.m}
        className="hidden sm:block"
        next={navButton(1, false, 'Next month')}
      />
    </div>
  );
};
