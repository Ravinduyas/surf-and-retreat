export interface StatItem {
  id: string;
  value: string;
  label: string;
}

export interface HighlightItem {
  id: string;
  title: string;
  description: string;
  image: string;
  iconType: 'bed' | 'wave' | 'laptop' | 'skate' | 'yoga';
  to: string;
}

export interface DetailItem {
  id: string;
  tag: string;
  title: string;
  description: string;
  image: string;
  category: string;
  highlight?: string;
  price?: string;
}

export interface ExploreCard {
  id: string;
  tag: string;
  title: string;
  description: string;
  image: string;
  to: string;
}

export interface RoomItem extends DetailItem {
  /** Bundled nightly rate in USD (per bed for dorms); the PMS can override it (see pms.ts). */
  nightly: number;
  pricePerNight: string;
  capacity: string;
  maxGuests: number;
  features: string[];
}

/** A price the PMS can override: `amount` is the bundled fallback, `unit` follows it (e.g. " / week"). */
export interface PriceTag {
  amount: number;
  unit: string;
  /** Shown as "from $5" when the price varies. */
  from?: boolean;
}

export interface SurfPackage extends DetailItem, PriceTag {
  level: string;
  includes: string[];
}

/** Skate and yoga sessions, sold as optional add-ons to a stay. */
/** Groups an extra on the booking step: it picks the row's icon and badge. */
export type ExtraCategory =
  | 'Surf'
  | 'Skate'
  | 'Yoga'
  | 'Fitness'
  | 'Co-working'
  | 'Whale Watching'
  | 'Gem Crafting';

export interface ActivityItem extends PriceTag {
  id: string;
  title: string;
  meta: string;
  description: string;
  image?: string;
  category: ExtraCategory;
}

export interface SurfSpot {
  id: string;
  name: string;
  distance: string;
  level: string;
  description: string;
}

export interface CoworkingPlan {
  id: string;
  name: string;
  /** Bundled price in USD; the PMS can override it. `price` is the same figure as display text. */
  amount: number;
  price: string;
  period: string;
  features: string[];
  popular?: boolean;
}

export interface Amenity {
  id: string;
  label: string;
  description: string;
  iconType: 'wifi' | 'ac' | 'desk' | 'booth' | 'coffee' | 'printer';
}

export interface Testimonial {
  id: string;
  name: string;
  origin: string;
  quote: string;
}

export interface Review {
  id: string;
  name: string;
  origin: string;
  rating: number;
  stayType: string;
  date: string;
  quote: string;
}

export interface ServiceItem {
  id: string;
  title: string;
  description: string;
  price: string;
  image: string;
  iconType: 'rooms' | 'coworking' | 'surfing' | 'skating' | 'yoga' | 'transfer' | 'whale';
  /** 'core' services have their own page section; 'extra' are front-desk add-ons. */
  group: 'core' | 'extra';
  to?: string;
}

export type GalleryCategory = 'rooms' | 'surf' | 'coworking' | 'around';

export interface GalleryImage {
  id: string;
  src: string;
  alt: string;
  category: GalleryCategory;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface ValueItem {
  id: string;
  title: string;
  description: string;
  iconType: 'wave' | 'community' | 'leaf';
}

/** Where a "Book" link points the booking flow: a room, a surf package or a coworking pass. */
export type BookingTab = 'stay' | 'surf' | 'coworking';

/** What the guest is booking, picked on the first step. Every type includes a room. */
export type BookingType = 'rooms' | 'surf' | 'coworking';

/** One traveller's surf choice. An empty packageId means that traveller skips surfing. */
export interface TravellerSurf {
  packageId: string;
  level: string;
}

export interface BookingFormState {
  type: BookingType;
  checkIn: string;
  checkOut: string;
  guests: number;
  /** Room id → how many are booked (beds for dorms, whole rooms for privates). */
  rooms: Record<string, number>;
  /** One entry per traveller, in the order they fill the chosen rooms. */
  surf: TravellerSurf[];
  /** Coworking pass, how many people need a desk, and how many days/weeks/months. */
  desk: { planId: string; people: number; periods: number };
  /** Skate and yoga add-on id → quantity. */
  extras: Record<string, number>;
  name: string;
  email: string;
  /** ISO alpha-2 code of the guest's country (see booking/countries.ts). */
  country: string;
  /** ISO alpha-2 code of the country whose dialling code the phone number uses. */
  phoneCountry: string;
  phone: string;
  message: string;
}
