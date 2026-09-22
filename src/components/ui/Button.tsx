import React from 'react';
import { Link } from 'react-router-dom';
import { BookingTab } from '../../types';
import { bookingHref } from '../../utils/booking';

type Variant = 'primary' | 'lime' | 'outline';

interface ButtonProps {
  children: React.ReactNode;
  variant?: Variant;
  to?: string;
  /** Renders a real link to the booking flow (new tab); pass the pre-selected category, or `true` for none. */
  book?: BookingTab | true;
  /** With `book`: pre-selects this room, package or pass in the booking flow. */
  bookItem?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  className?: string;
  id?: string;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-[#2A4E38] hover:bg-[#1E3B29] text-white text-sm font-medium px-6 py-3 rounded-full inline-flex items-center gap-2 transition-all duration-200 cursor-pointer shadow-xs active:scale-98',
  lime:
    'bg-[#F3F45C] hover:bg-[#DADB54] active:scale-98 transition-all duration-200 text-[#193B26] text-[14px] font-semibold px-6 py-2.5 rounded-full shadow-xs cursor-pointer inline-flex items-center gap-2',
  outline:
    'border border-[#D2DCD0] hover:border-[#1E3B29] hover:bg-[#F6F8F5] text-[#223528] text-sm font-medium px-6 py-3 rounded-full inline-flex items-center gap-2 transition-all duration-200 cursor-pointer',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  to,
  book,
  bookItem,
  onClick,
  type = 'button',
  className = '',
  id,
}) => {
  const classes = `${VARIANT_CLASSES[variant]} ${className}`.trim();
  if (book) {
    return (
      <a id={id} href={bookingHref(book === true ? undefined : book, bookItem)} target="_blank" rel="noopener" className={classes}>
        {children}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  if (to) {
    return (
      <Link id={id} to={to} onClick={onClick} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button id={id} type={type} onClick={onClick} className={classes}>
      {children}
    </button>
  );
};
