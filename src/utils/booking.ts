import { BookingTab } from '../types';

/** URL of the standalone booking flow, optionally pre-selecting a category and item. */
export const bookingHref = (tab?: BookingTab, itemId?: string) => {
  const params = new URLSearchParams();
  if (tab) params.set('tab', tab);
  if (itemId) params.set('item', itemId);
  const query = params.toString();
  return `${import.meta.env.BASE_URL}book${query ? `?${query}` : ''}`;
};
