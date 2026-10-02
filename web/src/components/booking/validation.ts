import { BookingFormState, BookingOption } from '../../types';

/** The biggest rooms (the 6-bed dorms) cap how many guests one booking can cover. */
export const MAX_GUESTS = 6;

/** roomId value for a guest who only wants add-ons or a desk, with no bed. */
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

/** Whole nights between two YYYY-MM-DD days (0 for a single-day visit). */
export const nightsBetween = (from: string, to: string) =>
  from && to ? Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000) : 0;

/**
 * Dates come before the room is chosen, so a single day (check-out = check-in) is allowed here: it suits a
 * desk day pass or a lesson. Picking a bed later needs at least one night, which the room step enforces.
 */
export const getDateError = (checkIn: string, checkOut: string): string | null => {
  if (checkIn && checkIn < todayString()) return "Check-in can't be in the past.";
  if (checkIn && checkOut && checkOut < checkIn) return "Check-out can't be before check-in.";
  return null;
};

export const isDatesStepValid = (checkIn: string, checkOut: string) =>
  Boolean(checkIn) && Boolean(checkOut) && getDateError(checkIn, checkOut) === null;
