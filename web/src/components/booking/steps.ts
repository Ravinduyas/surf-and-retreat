import { BedDouble, CalendarDays, LayoutGrid, Laptop, LucideIcon, Send, Sparkles, Waves } from 'lucide-react';
import { BookingType } from '../../types';

export type StepKind = 'type' | 'dates' | 'room' | 'surf' | 'desk' | 'extras' | 'send';

export interface StepDef {
  kind: StepKind;
  /** Accessible name for the step's icon in the step bar. */
  label: string;
  icon: LucideIcon;
  /** Heading of the step's card. */
  title: string;
}

const TYPE: StepDef = { kind: 'type', label: 'Booking type', icon: LayoutGrid, title: 'What are you booking' };
const DATES: StepDef = { kind: 'dates', label: 'Dates', icon: CalendarDays, title: 'Your dates' };
const ROOM: StepDef = { kind: 'room', label: 'Room', icon: BedDouble, title: 'Choose your room' };
const SURF: StepDef = { kind: 'surf', label: 'Surf', icon: Waves, title: 'Surf package' };
const DESK: StepDef = { kind: 'desk', label: 'Desk', icon: Laptop, title: 'Coworking desk' };
const EXTRAS: StepDef = { kind: 'extras', label: 'Extras', icon: Sparkles, title: 'Extras' };
const SEND: StepDef = { kind: 'send', label: 'Review and send', icon: Send, title: 'Review and send' };

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
