export type StepKind = 'guests' | 'room' | 'extras' | 'dates' | 'details' | 'review';

export interface StepDef {
  kind: StepKind;
  title: string;
  subtitle: string;
}

/** A room is the main booking; surf lessons and a coworking pass are optional extras on top of it. */
export const STEPS: StepDef[] = [
  {
    kind: 'guests',
    title: "Who's coming?",
    subtitle: "Room choices depend on your group size, so we'll ask this first.",
  },
  { kind: 'room', title: 'Choose your room', subtitle: 'Select the bed that fits you best.' },
  {
    kind: 'extras',
    title: 'Add surf or coworking?',
    subtitle: 'Optional extras — add lessons, a desk pass, both or neither.',
  },
  { kind: 'dates', title: 'When are you coming?', subtitle: "Give us your dates and we'll check availability." },
  { kind: 'details', title: 'Your details', subtitle: "We'll use this to confirm your booking." },
  { kind: 'review', title: 'Review & confirm', subtitle: 'Double-check everything before you send it.' },
];
