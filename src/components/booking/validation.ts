import { BookingFormState, BookingOption } from '../../types';

/** The biggest room (the 8-bed dorm) caps how many guests one booking can cover. */
export const MAX_GUESTS = 8;

/** roomId value for a guest who only wants lessons or a desk, with no bed. */
export const NO_ROOM = 'none';

export const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

export const roomFitsGuests = (room: BookingOption, guests: number) =>
  room.maxGuests === undefined || guests <= room.maxGuests;

/** True when the booking includes a bed, so it needs a check-out date. */
export const hasRoom = (form: Pick<BookingFormState, 'roomId'>) => form.roomId !== '' && form.roomId !== NO_ROOM;

/** Local YYYY-MM-DD (toISOString would shift the day for users ahead of UTC). */
export const todayString = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * With a bed the stay needs a check-out day after check-in. Without one (just lessons or a desk) it is
 * a day-based booking: an end date is optional and it can be a single day.
 */
export const getDateError = (withRoom: boolean, checkIn: string, checkOut: string): string | null => {
  if (checkIn && checkIn < todayString()) return "Check-in can't be in the past.";
  if (checkIn && checkOut) {
    if (withRoom ? checkOut <= checkIn : checkOut < checkIn) {
      return withRoom ? 'Check-out must be after check-in.' : "End date can't be before the start date.";
    }
  }
  return null;
};

export const isDatesStepValid = (withRoom: boolean, checkIn: string, checkOut: string) =>
  Boolean(checkIn) && (!withRoom || Boolean(checkOut)) && getDateError(withRoom, checkIn, checkOut) === null;
