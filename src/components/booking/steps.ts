import { BedDouble, CalendarDays, ClipboardCheck, Laptop, LucideIcon, UserRound, Users, Waves } from 'lucide-react';

export type StepKind = 'guests' | 'dates' | 'room' | 'surf' | 'coworking' | 'details' | 'review';

export interface StepDef {
  kind: StepKind;
  /** Short name for the bottom step navigator. */
  label: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
}

export type ExtraKind = Extract<StepKind, 'surf' | 'coworking'>;

export const isExtraStep = (kind: StepKind): kind is ExtraKind => kind === 'surf' || kind === 'coworking';

const EXTRA_STEPS: Record<ExtraKind, StepDef> = {
  surf: {
    kind: 'surf',
    label: 'Surf',
    icon: Waves,
    title: 'Add Surf Lessons?',
    subtitle: 'Optional — lessons and coaching on Weligama Bay, or skip this.',
  },
  coworking: {
    kind: 'coworking',
    label: 'Desk',
    icon: Laptop,
    title: 'Add a Coworking Desk?',
    subtitle: 'Optional — a desk on 300 Mbps fiber, by the day, week or month.',
  },
};

/**
 * Group size and dates come first, then the room (the main booking), then surf lessons and a coworking
 * pass as optional extras, each on its own screen. `first` puts the extra the guest came from (e.g. a
 * "Desk Pass" link) before the other.
 */
export const buildSteps = (first: ExtraKind = 'surf'): StepDef[] => {
  const second: ExtraKind = first === 'surf' ? 'coworking' : 'surf';
  return [
    {
      kind: 'guests',
      label: 'Guests',
      icon: Users,
      title: "Who's Coming?",
      subtitle: "Room choices depend on your group size, so we'll ask this first.",
    },
    {
      kind: 'dates',
      label: 'Dates',
      icon: CalendarDays,
      title: 'Select Your Dates',
      subtitle: "Pick your arrival and departure and we'll check availability.",
    },
    { kind: 'room', label: 'Room', icon: BedDouble, title: 'Choose Your Room', subtitle: 'Select the bed that fits you best.' },
    EXTRA_STEPS[first],
    EXTRA_STEPS[second],
    {
      kind: 'details',
      label: 'Details',
      icon: UserRound,
      title: 'Your Details',
      subtitle: "We'll use this to confirm your booking.",
    },
    {
      kind: 'review',
      label: 'Review',
      icon: ClipboardCheck,
      title: 'Review & Send',
      subtitle: 'Double-check everything, then send the request to us.',
    },
  ];
};
