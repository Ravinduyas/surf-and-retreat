export interface StatItem {
  id: string;
  value: string;
  label: string;
}

export interface HeroLinkCard {
  id: string;
  title: string;
  description: string;
  image: string;
  to: string;
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
  avatar: string;
}

export interface Review {
  id: string;
  name: string;
  origin: string;
  rating: number;
  stayType: string;
  date: string;
  quote: string;
  avatar: string;
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
