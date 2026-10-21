import { ROOMS } from '../../data';
import { BookingFormState } from '../../types';
import { unitSleeps } from './options';

/** Three private doubles or six dorm beds: the most one online booking covers. */
export const MAX_GUESTS = 6;

/** Private rooms one booking can hold. Dorm beds are capped by the guest count instead. */
export const MAX_ROOMS = 3;

export const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

/** Local YYYY-MM-DD (toISOString would shift the day for users ahead of UTC). */
export const todayString = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Whole nights between two YYYY-MM-DD days. */
export const nightsBetween = (from: string, to: string) =>
  from && to ? Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000) : 0;

export const isDatesValid = (checkIn: string, checkOut: string) =>
  Boolean(checkIn) && checkIn >= todayString() && nightsBetween(checkIn, checkOut) >= 1;

/** How many guests the chosen beds and rooms sleep. */
export const coveredGuests = (rooms: BookingFormState['rooms']) =>
  ROOMS.reduce((sum, room) => sum + (rooms[room.id] ?? 0) * unitSleeps(room), 0);

/** Private rooms in the booking (dorm beds don't count toward MAX_ROOMS). */
export const privateRoomCount = (rooms: BookingFormState['rooms']) =>
  ROOMS.reduce((sum, room) => sum + (unitSleeps(room) > 1 ? (rooms[room.id] ?? 0) : 0), 0);

export const phoneDigits = (value: string) => value.replace(/\D/g, '');

/** What the send step still needs, or null when it can go. */
export const contactProblem = (form: BookingFormState): string | null => {
  if (form.name.trim().length < 2) return 'name';
  if (!isValidEmail(form.email)) return 'email';
  if (!form.country) return 'country';
  if (!form.phoneCountry || phoneDigits(form.phone).length < 6) return 'phone';
  return null;
};
