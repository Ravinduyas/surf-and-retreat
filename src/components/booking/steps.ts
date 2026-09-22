export type StepKind = 'guests' | 'room' | 'surf' | 'coworking' | 'dates' | 'details' | 'review';

export interface StepDef {
  kind: StepKind;
  title: string;
  subtitle: string;
}

export type ExtraKind = Extract<StepKind, 'surf' | 'coworking'>;

export const isExtraStep = (kind: StepKind): kind is ExtraKind => kind === 'surf' || kind === 'coworking';

const EXTRA_STEPS: Record<ExtraKind, StepDef> = {
  surf: {
    kind: 'surf',
    title: 'Add surf lessons?',
    subtitle: 'Optional — lessons and coaching on Weligama Bay, or skip this.',
  },
  coworking: {
    kind: 'coworking',
    title: 'Add a coworking desk?',
    subtitle: 'Optional — a desk on 300 Mbps fiber, by the day, week or month.',
  },
};

/**
 * A room is the main booking; surf lessons and a coworking pass are optional extras on top of it, each
 * on its own screen. `first` puts the extra the guest came from (e.g. a "Desk Pass" link) before the other.
 */
export const buildSteps = (first: ExtraKind = 'surf'): StepDef[] => {
  const second: ExtraKind = first === 'surf' ? 'coworking' : 'surf';
  return [
    {
      kind: 'guests',
      title: "Who's coming?",
      subtitle: "Room choices depend on your group size, so we'll ask this first.",
    },
    { kind: 'room', title: 'Choose your room', subtitle: 'Select the bed that fits you best.' },
    EXTRA_STEPS[first],
    EXTRA_STEPS[second],
    { kind: 'dates', title: 'When are you coming?', subtitle: "Give us your dates and we'll check availability." },
    { kind: 'details', title: 'Your details', subtitle: "We'll use this to confirm your booking." },
    { kind: 'review', title: 'Review & confirm', subtitle: 'Double-check everything before you send it.' },
  ];
};
