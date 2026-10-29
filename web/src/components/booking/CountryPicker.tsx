import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { COUNTRIES, POPULAR, findCountry, flagSrc } from './countries';

interface CountryPickerProps {
  /** ISO alpha-2 code of the chosen country, or '' for none. */
  value: string;
  onChange: (iso: string) => void;
  /** 'country' shows the name; 'code' shows the dialling code (the list shows both either way). */
  mode: 'country' | 'code';
  placeholder?: string;
  className?: string;
}

export const Flag: React.FC<{ iso: string; className?: string }> = ({ iso, className = 'w-5 h-[15px]' }) => (
  <img src={flagSrc(iso)} alt="" width={20} height={15} loading="lazy" className={`${className} rounded-[2px] object-cover shrink-0`} />
);

/**
 * A searchable dropdown of every country with its flag and dialling code. Typing filters by name, code
 * or ISO code; Enter picks the first match, Escape closes, clicking outside closes.
 */
export const CountryPicker: React.FC<CountryPickerProps> = ({ value, onChange, mode, placeholder = 'Select', className = '' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chosen = findCountry(value);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus({ preventScroll: true });
    // Bring the open list above the fixed action bar when it opens near the bottom of the screen.
    listRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, '');
    if (!q) {
      const popular = POPULAR.map((iso) => findCountry(iso)!);
      return [...popular, ...COUNTRIES.filter((c) => !POPULAR.includes(c[0]))];
    }
    // Names that start with the search come first, then names that contain it, then dialling codes.
    const rank = ([iso, name, dial]: (typeof COUNTRIES)[number]) => {
      const n = name.toLowerCase();
      if (n.startsWith(q) || iso.toLowerCase() === q) return 0;
      if (n.split(/[\s-]/).some((word) => word.startsWith(q))) return 1;
      if (n.includes(q)) return 2;
      if (dial.slice(1).startsWith(q)) return 3;
      return -1;
    };
    return COUNTRIES.map((c) => [rank(c), c] as const)
      .filter(([r]) => r >= 0)
      .sort((a, b) => a[0] - b[0])
      .map(([, c]) => c);
  }, [query]);

  const pick = (iso: string) => {
    onChange(iso);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full h-9.5 sm:h-10 flex items-center gap-2 bg-[#FAFBF9] border rounded-xl px-3 text-left text-sm transition-colors cursor-pointer hover:border-[#B9C8B7] focus:outline-hidden focus:bg-white focus:border-[#2A4E38] focus:ring-4 focus:ring-[#2A4E38]/10 ${
          open ? 'border-[#2A4E38] bg-white' : 'border-[#DCE2D8]'
        }`}
      >
        {chosen ? (
          <>
            <Flag iso={chosen[0]} />
            <span className="flex-1 min-w-0 truncate text-[#18271E]">{mode === 'country' ? chosen[1] : chosen[2]}</span>
          </>
        ) : (
          <span className="flex-1 min-w-0 truncate text-[#A7B3A6]">{placeholder}</span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-[#637265] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={listRef}
          className="step-in absolute z-30 left-0 mt-1.5 w-full min-w-[280px] scroll-mb-28 rounded-2xl border border-[#DCE2D8] bg-white shadow-[0_20px_50px_-20px_rgba(24,39,30,0.35)] overflow-hidden"
        >
          <div className="flex items-center gap-2 px-3 border-b border-[#EEF2EB]">
            <Search className="w-3.5 h-3.5 text-[#8B9A8D] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false);
                if (e.key === 'Enter' && results[0]) {
                  e.preventDefault();
                  pick(results[0][0]);
                }
              }}
              placeholder="Search country or code"
              aria-label="Search countries"
              className="w-full h-9 bg-transparent text-sm text-[#18271E] placeholder:text-[#A7B3A6] focus:outline-hidden"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {results.length === 0 && <li className="px-3 py-3 text-sm text-[#8B9A8D]">No match</li>}
            {results.map(([iso, name, dial], i) => {
              const active = iso === value;
              const popularEnd = !query && i === POPULAR.length - 1;
              return (
                <li
                  key={iso}
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(iso)}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer ${
                    active ? 'bg-[#F2F6F0] text-[#2A4E38] font-semibold' : 'text-[#18271E] hover:bg-[#F7FAF5]'
                  } ${popularEnd ? 'border-b border-[#EEF2EB] mb-1' : ''}`}
                >
                  <Flag iso={iso} />
                  <span className="flex-1 min-w-0 truncate">{name}</span>
                  <span className="text-xs text-[#637265] tabular-nums shrink-0">{dial}</span>
                  {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
