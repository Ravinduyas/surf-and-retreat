import { ROOMS, SURF_PACKAGES, COWORKING_PLANS, SKATE_OPTIONS, YOGA_OPTIONS } from '../../data';
import { ActivityItem, BookingOption, PriceTag } from '../../types';
import { formatMoney, priceFor } from '../../pms';

export type OptionGroup = 'stay' | 'surf' | 'skate' | 'yoga' | 'coworking';

/** "$149 / week", "from $5 / half-day" — the PMS price when it has sent one, else the bundled one. */
const addonPrice = (id: string, tag: PriceTag) =>
  `${tag.from ? 'from ' : ''}${formatMoney(priceFor('addons', id, tag.amount))}${tag.unit}`;

const activity = (item: ActivityItem): BookingOption => ({
  id: item.id,
  title: item.title,
  price: addonPrice(item.id, item),
  meta: item.meta,
  description: item.description,
  image: item.image,
});

/** Nightly room price for display, live from the PMS when available. */
export const roomPrice = (id: string, fallback: number) => `from ${formatMoney(priceFor('rooms', id, fallback))}/night`;

/** Normalizes rooms, add-ons and coworking plans into one shape the booking flow can render. */
export const getBookingOptions = (group: OptionGroup): BookingOption[] => {
  switch (group) {
    case 'stay':
      return ROOMS.map((room) => ({
        id: room.id,
        title: room.title,
        price: roomPrice(room.id, room.nightly),
        meta: room.capacity,
        description: room.description,
        image: room.image,
        maxGuests: room.maxGuests,
      }));
    case 'surf':
      return SURF_PACKAGES.map((pkg) => ({
        id: pkg.id,
        title: pkg.title,
        price: addonPrice(pkg.id, pkg),
        meta: pkg.level,
        description: pkg.description,
        image: pkg.image,
      }));
    case 'skate':
      return SKATE_OPTIONS.map(activity);
    case 'yoga':
      return YOGA_OPTIONS.map(activity);
    case 'coworking':
      return COWORKING_PLANS.map((plan) => ({
        id: plan.id,
        title: plan.name,
        price: addonPrice(plan.id, { amount: plan.amount, unit: ` ${plan.period}` }),
        meta: plan.popular ? 'Most popular' : `${plan.features.length} perks included`,
        description: plan.features.slice(0, 2).join(' · '),
      }));
  }
};

/** The chosen option in a group, if any. */
export const findOption = (group: OptionGroup, id: string) =>
  id ? getBookingOptions(group).find((o) => o.id === id) : undefined;
