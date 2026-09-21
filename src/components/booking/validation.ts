import { BookingOption, BookingTab } from '../../types';

/** The biggest room (the 8-bed dorm) caps how many guests one booking can cover. */
export const MAX_GUESTS = 8;

export const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

export const roomFitsGuests = (room: BookingOption, guests: number) =>
  room.maxGuests === undefined || guests <= room.maxGuests;

/** Local YYYY-MM-DD (toISOString would shift the day for users ahead of UTC). */
export const todayString = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Coworking is a day-pass by default, so an end date is only required once a room is added. */
export const needsCheckOut = (tab: BookingTab, hasRoom: boolean) => tab !== 'coworking' || hasRoom;

export const getDateError = (
  tab: BookingTab,
  hasRoom: boolean,
  checkIn: string,
  checkOut: string
): string | null => {
  if (checkIn && checkIn < todayString()) return "Check-in can't be in the past.";
  if (checkIn && checkOut) {
    const sameDayOk = tab === 'coworking' && !hasRoom;
    if (sameDayOk ? checkOut < checkIn : checkOut <= checkIn) {
      return sameDayOk ? "End date can't be before the start date." : 'Check-out must be after check-in.';
    }
  }
  return null;
};

export const isDatesStepValid = (tab: BookingTab, hasRoom: boolean, checkIn: string, checkOut: string) =>
  Boolean(checkIn) &&
  (!needsCheckOut(tab, hasRoom) || Boolean(checkOut)) &&
  getDateError(tab, hasRoom, checkIn, checkOut) === null;
