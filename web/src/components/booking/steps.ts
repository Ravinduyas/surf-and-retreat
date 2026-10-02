import { BedDouble, CalendarDays, ClipboardCheck, Laptop, LucideIcon, Sparkles, UserRound, Users } from 'lucide-react';

export type StepKind = 'guests' | 'dates' | 'room' | 'addons' | 'coworking' | 'details' | 'review';

/** A stay (bed plus optional add-ons) or co-working only (a desk pass, no bed). */
export type BookingMode = 'stay' | 'coworking';

export interface StepDef {
  kind: StepKind;
  /** Short name for the bottom step navigator. */
  label: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
}

export type ExtraKind = Extract<StepKind, 'addons' | 'coworking'>;

export const isExtraStep = (kind: StepKind): kind is ExtraKind => kind === 'addons' || kind === 'coworking';

const GUESTS: StepDef = {
  kind: 'guests',
  label: 'Guests',
  icon: Users,
  title: "Who's Coming?",
  subtitle: "Room choices depend on your group size, so we'll ask this first.",
};

const DATES: StepDef = {
  kind: 'dates',
  label: 'Dates',
  icon: CalendarDays,
  title: 'Select Your Dates',
  subtitle: "Pick your arrival and departure and we'll check availability.",
};

const ROOM: StepDef = {
  kind: 'room',
  label: 'Room',
  icon: BedDouble,
  title: 'Choose Your Room',
  subtitle: 'Select the bed that fits you best.',
};

const ADDONS: StepDef = {
  kind: 'addons',
  label: 'Add-ons',
  icon: Sparkles,
  title: 'Any Add-ons?',
  subtitle: "Optional — tick surfing, skating, yoga or co-working to see the options.",
};

const DETAILS: StepDef = {
  kind: 'details',
  label: 'Details',
  icon: UserRound,
  title: 'Your Details',
  subtitle: "We'll use this to confirm your booking.",
};

const REVIEW: StepDef = {
  kind: 'review',
  label: 'Review',
  icon: ClipboardCheck,
  title: 'Review & Send',
  subtitle: 'Double-check everything, then send the request to us.',
};

/**
 * Stay: group size and dates first, then the room (the main booking), then optional add-ons (surf,
 * skate, yoga, co-working). Co-working only skips the bed and the add-ons and makes the desk the booking.
 */
export const buildSteps = (mode: BookingMode): StepDef[] =>
  mode === 'coworking'
    ? [
        { ...GUESTS, subtitle: 'Count everyone who needs a desk, including you.' },
        { ...DATES, subtitle: 'Pick the days you want to work here — a single day is fine.' },
        {
          kind: 'coworking',
          label: 'Desk',
          icon: Laptop,
          title: 'Choose a Desk Pass',
          subtitle: 'A desk on 300 Mbps fiber, by the day, week or month.',
        },
        DETAILS,
        REVIEW,
      ]
    : [GUESTS, DATES, ROOM, ADDONS, DETAILS, REVIEW];
