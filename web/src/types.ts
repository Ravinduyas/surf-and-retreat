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
  iconType: 'bed' | 'wave' | 'laptop';
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
export interface ActivityItem extends PriceTag {
  id: string;
  title: string;
  meta: string;
  description: string;
  image?: string;
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
  iconType: 'rooms' | 'coworking' | 'surfing' | 'skating' | 'yoga' | 'transfer' | 'laundry';
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

/** Where a booking starts. 'coworking' is the co-working-only flow, with no bed. */
export type BookingTab = 'stay' | 'surf' | 'coworking';

/** A room, add-on or coworking plan, normalized for the booking flow. */
export interface BookingOption {
  id: string;
  title: string;
  /** Display price, live from the PMS when it has sent one. */
  price: string;
  meta: string;
  description: string;
  image?: string;
  /** Only rooms are capacity-limited; undefined means any party size fits. */
  maxGuests?: number;
}

export interface BookingFormState {
  /** The bed for the stay. NO_ROOM when the guest only wants lessons or a desk; '' until chosen. */
  roomId: string;
  /** Optional surf package added to the stay. */
  surfId: string;
  /** Optional skate session added to the stay. */
  skateId: string;
  /** Optional yoga class or pack added to the stay. */
  yogaId: string;
  /** Optional coworking pass added to the stay. */
  coworkingId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  name: string;
  email: string;
  phone: string;
  message: string;
}
