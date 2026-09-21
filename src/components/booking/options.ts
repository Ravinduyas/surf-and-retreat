import { ROOMS, SURF_PACKAGES, COWORKING_PLANS } from '../../data';
import { BookingOption, BookingTab } from '../../types';

/** Normalizes rooms, surf packages and coworking plans into one shape the booking flow can render. */
export const getBookingOptions = (tab: BookingTab): BookingOption[] => {
  switch (tab) {
    case 'stay':
      return ROOMS.map((room) => ({
        id: room.id,
        title: room.title,
        price: room.pricePerNight,
        meta: room.capacity,
        description: room.description,
        image: room.image,
        maxGuests: room.maxGuests,
      }));
    case 'surf':
      return SURF_PACKAGES.map((pkg) => ({
        id: pkg.id,
        title: pkg.title,
        price: pkg.price ?? '',
        meta: pkg.level,
        description: pkg.description,
        image: pkg.image,
      }));
    case 'coworking':
      return COWORKING_PLANS.map((plan) => ({
        id: plan.id,
        title: plan.name,
        price: `${plan.price} ${plan.period}`,
        meta: plan.popular ? 'Most popular' : `${plan.features.length} perks included`,
        description: plan.features.slice(0, 2).join(' · '),
      }));
  }
};
