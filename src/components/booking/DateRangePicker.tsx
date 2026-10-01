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

/** One month at a time, with pill-shaped days: the ends of the range are solid, the days between are tinted. */
export const DateRangePicker: React.FC<DateRangePickerProps> = ({ start, end, min, allowSameDay, onChange }) => {
  const [view, setView] = useState(() => parseKey(start || min));
  const [hover, setHover] = useState('');

  // Follow quick picks and other outside changes to the start date.
  useEffect(() => {
    if (start) setView(parseKey(start));
  }, [start]);

  const minView = parseKey(min);
  const atMin = view.y === minView.y && view.m === minView.m;

  const handlePick = (key: string) => {
    // Nothing chosen yet, a finished range, or a click before the start: begin a new range.
    if (!start || end || key < start) return onChange(key, '');
    if (key === start && !allowSameDay) return;
    onChange(start, key);
  };

  const { y: year, m: month } = view;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first, with the neighbouring months' days greyed out to fill the weeks.
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const prevMonthDays = new Date(year, month, 0).getDate();
  const total = Math.ceil((offset + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: total }, (_, i) => {
    const n = i - offset + 1;
    if (n < 1) return { day: prevMonthDays + n, outside: true, key: `p${i}` };
    if (n > daysInMonth) return { day: n - daysInMonth, outside: true, key: `n${i}` };
    return { day: n, outside: false, key: toKey(year, month, n) };
  });

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

  return (
    <div onMouseLeave={() => setHover('')}>
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#E5ECE2]">
        {navButton(-1, atMin, 'Previous month')}
        <span className="text-sm font-bold text-[#18271E]">
          {new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        {navButton(1, false, 'Next month')}
      </div>

      <div className="grid grid-cols-7 gap-x-1.5 sm:gap-x-2 mb-1">
        {WEEKDAYS.map((d) => (
          <span key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-[#8B9A8D] py-2">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-x-1.5 sm:gap-x-2 gap-y-1.5">
        {cells.map(({ day, outside, key }) => {
          if (outside) {
            return (
              <span key={key} className="h-10 lg:h-9 flex items-center justify-center text-[13px] text-[#CBD3C9]" aria-hidden="true">
                {day}
              </span>
            );
          }
          const disabled = key < min;
          const selected = key === start || key === end;
          const inRange = Boolean(start) && Boolean(rangeEnd) && key > start && key < rangeEnd;
          const isToday = key === min;

          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => handlePick(key)}
              onMouseEnter={() => setHover(key)}
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
