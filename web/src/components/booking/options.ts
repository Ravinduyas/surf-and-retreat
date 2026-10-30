import {
  ROOMS,
  SURF_PACKAGES,
  COWORKING_PLANS,
  SURF_EXTRAS,
  SKATE_OPTIONS,
  YOGA_OPTIONS,
  FITNESS_OPTIONS,
  COWORKING_EXTRAS,
  WHALE_OPTIONS,
  GEM_OPTIONS,
} from '../../data';
import { ActivityItem, RoomItem } from '../../types';
import { formatMoney, priceFor } from '../../pms';

/** Nightly room price for display, live from the PMS when available. */
export const roomPrice = (id: string, fallback: number) => `from ${formatMoney(priceFor('rooms', id, fallback))}/night`;

/** Dorms are booked by the bed, private rooms as a whole. */
export const isDorm = (room: RoomItem) => room.category === 'Shared';

/** How many guests one booked unit (a dorm bed or a private room) sleeps. */
export const unitSleeps = (room: RoomItem) => (isDorm(room) ? 1 : room.maxGuests);

/** "bed" / "beds" for dorms, "room" / "rooms" for privates. */
export const unitName = (room: RoomItem, count: number) => `${isDorm(room) ? 'bed' : 'room'}${count === 1 ? '' : 's'}`;

export const roomNightly = (room: RoomItem) => priceFor('rooms', room.id, room.nightly);

/** Live add-on price (surf, skate, yoga, fitness, coworking, trips), else the bundled one. */
export const addonAmount = (id: string, fallback: number) => priceFor('addons', id, fallback);

/** Every one-off add-on, offered on the extras step of every booking. On-site first, trips last. */
export const EXTRAS: ActivityItem[] = [
  ...SURF_EXTRAS,
  ...SKATE_OPTIONS,
  ...YOGA_OPTIONS,
  ...FITNESS_OPTIONS,
  ...COWORKING_EXTRAS,
  ...WHALE_OPTIONS,
  ...GEM_OPTIONS,
];

export const SURF_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export const findRoom = (id: string) => ROOMS.find((r) => r.id === id);
export const findSurf = (id: string) => SURF_PACKAGES.find((p) => p.id === id);
export const findPlan = (id: string) => COWORKING_PLANS.find((p) => p.id === id);
export const findExtra = (id: string) => EXTRAS.find((e) => e.id === id);

/** "per week" → "week". */
export const planPeriod = (period: string) => period.replace(/^per\s+/, '');
