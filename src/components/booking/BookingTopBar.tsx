import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { Logo } from '../ui/Logo';

interface BookingTopBarProps {
  /** e.g. "Step 2 of 7". Omitted before the flow has mounted. */
  eyebrow?: string;
  title?: string;
  /** Goes back one step; hidden on the first step. */
  onBack?: () => void;
  backLabel?: string;
}

/** The booking page's only header: logo, the current step in the middle, and a way out. */
export const BookingTopBar: React.FC<BookingTopBarProps> = ({ eyebrow, title, onBack, backLabel }) => (
  <header className="shrink-0 h-14 sm:h-16 px-3 sm:px-8 grid grid-cols-[1fr_auto_1fr] items-center gap-2 bg-white border-b border-[#E4EAE0]">
    {/* Phones show just the wave mark, so the step title has room */}
    <div className="min-w-0 [&_span]:hidden sm:[&_span]:inline">
      <Logo />
    </div>

    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel ?? 'Previous step'}
          title={backLabel}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-[#D7E0D5] flex items-center justify-center text-[#233829] hover:bg-[#F3F6F1] transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      )}
      {title && (
        <div className="text-center min-w-0">
          <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-[#7FA35B] leading-none">
            {eyebrow}
          </p>
          <h1 className="text-[15px] sm:text-xl font-bold text-[#18261E] tracking-tight leading-tight mt-1 truncate">
            {title}
          </h1>
        </div>
      )}
    </div>

    <Link
      to="/"
      className="justify-self-end inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold text-[#2A4E38] hover:underline py-2"
    >
      <X className="w-4 h-4 sm:hidden" aria-hidden="true" />
      <ArrowLeft className="w-3.5 h-3.5 hidden sm:block" aria-hidden="true" />
      <span className="hidden sm:inline">Back to website</span>
      <span className="sr-only sm:hidden">Leave booking</span>
    </Link>
  </header>
);
