import React from 'react';
import { BookingTab } from '../../types';
import { bookingHref } from '../../utils/booking';

interface BookLinkProps {
  tab?: BookingTab;
  itemId?: string;
  className?: string;
  id?: string;
  children: React.ReactNode;
}

/**
 * A real link to the booking flow, which opens in a new tab. Being an <a>, it is
 * crawlable, can be cmd-clicked, and is announced as a link — unlike a button.
 */
export const BookLink: React.FC<BookLinkProps> = ({ tab, itemId, className, id, children }) => (
  <a id={id} href={bookingHref(tab, itemId)} target="_blank" rel="noopener" className={className}>
    {children}
    <span className="sr-only"> (opens in a new tab)</span>
  </a>
);
