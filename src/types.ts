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
  pricePerNight: string;
  capacity: string;
  maxGuests: number;
  features: string[];
}

export interface SurfPackage extends DetailItem {
  level: string;
  includes: string[];
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

export interface CafeDish {
  id: string;
  name: string;
  note: string;
  image: string;
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

export type GalleryCategory = 'rooms' | 'surf' | 'coworking' | 'food' | 'around';

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

export type BookingTab = 'stay' | 'surf' | 'coworking';

/** A room, surf package or coworking plan, normalized for the booking flow. */
export interface BookingOption {
  id: string;
  title: string;
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
