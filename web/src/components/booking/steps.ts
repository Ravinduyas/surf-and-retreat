import { BedDouble, CalendarDays, LayoutGrid, Laptop, LucideIcon, Send, Sparkles, Waves } from 'lucide-react';
import { BookingType } from '../../types';

export type StepKind = 'type' | 'dates' | 'room' | 'surf' | 'desk' | 'extras' | 'send';

export interface StepDef {
  kind: StepKind;
  /** Short name under the step's icon and in the action bar. */
  label: string;
  icon: LucideIcon;
  /** Heading of the step's card. */
  title: string;
  /** One line under the heading saying what to do. */
  subtitle: string;
}

const TYPE: StepDef = {
  kind: 'type',
  label: 'Booking',
  icon: LayoutGrid,
  title: 'What are you booking?',
  subtitle: 'Every stay starts with a bed. Add surf lessons or a desk if you want them.',
};
const DATES: StepDef = {
  kind: 'dates',
  label: 'Dates',
  icon: CalendarDays,
  title: 'When are you coming?',
  subtitle: 'Tap your check-in day, then your check-out day.',
};
const ROOM: StepDef = {
  kind: 'room',
  label: 'Room',
  icon: BedDouble,
  title: 'Choose your room',
  subtitle: 'Set how many of you there are, then pick beds or rooms for everyone.',
};
const SURF: StepDef = {
  kind: 'surf',
  label: 'Surf',
  icon: Waves,
  title: 'Surf packages',
  subtitle: 'A package and level for each traveller. Skip anyone who just wants the beach.',
};
const DESK: StepDef = {
  kind: 'desk',
  label: 'Desk',
  icon: Laptop,
  title: 'Your coworking desk',
  subtitle: 'A desk on 300 Mbps fiber with backup, by the day, week or month.',
};
const EXTRAS: StepDef = {
  kind: 'extras',
  label: 'Extras',
  icon: Sparkles,
  title: 'Anything extra?',
  subtitle: 'Optional. Lessons, classes, a gym or desk day, and trips out of Weligama.',
};
const SEND: StepDef = {
  kind: 'send',
  label: 'Send',
  icon: Send,
  title: 'Review and send',
  subtitle: 'Check your stay, add your details and send it. We confirm within 24 hours.',
};

/** Every booking has a room; surf packages and coworking each add their own step after it. */
export const buildSteps = (type: BookingType): StepDef[] => [
  TYPE,
  DATES,
  ROOM,
  ...(type === 'surf' ? [SURF] : []),
  ...(type === 'coworking' ? [DESK] : []),
  EXTRAS,
  SEND,
];
