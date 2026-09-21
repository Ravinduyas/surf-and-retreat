import { BookingTab } from '../../types';

export type StepKind = 'guests' | 'option' | 'room' | 'dates' | 'details' | 'review';

export interface StepDef {
  kind: StepKind;
  title: string;
  subtitle: string;
}

const OPTION_COPY: Record<BookingTab, { title: string; subtitle: string }> = {
  stay: { title: 'Choose your room', subtitle: 'Select the room that fits you best.' },
  surf: { title: 'Choose your package', subtitle: 'Select the surf package that fits you best.' },
  coworking: { title: 'Choose your pass', subtitle: 'Select the coworking pass that fits you best.' },
};

/**
 * The room step only applies to surf/coworking tabs — a surf package or coworking pass
 * doesn't include a bed, so guests can optionally add one on top. The stay tab's own
 * option step already *is* the room pick, so it's skipped there.
 */
export const buildSteps = (tab: BookingTab): StepDef[] => {
  const steps: StepDef[] = [
    {
      kind: 'guests',
      title: "Who's coming?",
      subtitle: "Room choices depend on your group size, so we'll ask this first.",
    },
    { kind: 'option', ...OPTION_COPY[tab] },
  ];

  if (tab !== 'stay') {
    steps.push({
      kind: 'room',
      title: 'Add a room?',
      subtitle: 'Staying with us too? Add a bed to this booking — totally optional.',
    });
  }

  steps.push(
    { kind: 'dates', title: 'When are you coming?', subtitle: "Give us your dates and we'll check availability." },
    { kind: 'details', title: 'Your details', subtitle: "We'll use this to confirm your booking." },
    { kind: 'review', title: 'Review & confirm', subtitle: 'Double-check everything before you send it.' }
  );

  return steps;
};
