import { COWORKING_PLANS, ROOMS, SURF_PACKAGES } from '../../data';
import { BookingFormState, TravellerSurf } from '../../types';
import { formatMoney } from '../../pms';
import { EXTRAS, addonAmount, planPeriod, roomNightly, unitName, unitSleeps } from './options';
import { nightsBetween } from './validation';

export interface QuoteLine {
  key: string;
  title: string;
  detail: string;
  /** null for "from" prices, which are settled at the desk and left out of the total. */
  amount: number | null;
  /** Shown instead of the amount when it is null. */
  note?: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Weeks a weekly package covers for the stay: a 4-night stay is still one week of lessons. */
export const stayWeeks = (nights: number) => Math.max(1, Math.ceil(nights / 7));

/** Days, weeks or months of a desk pass that cover the stay. */
export const defaultPeriods = (period: string, nights: number) => {
  const unit = planPeriod(period);
  if (unit === 'week') return stayWeeks(nights);
  if (unit === 'month') return Math.max(1, Math.ceil(nights / 30));
  return Math.max(1, nights);
};

export const travellerSurf = (form: Pick<BookingFormState, 'surf'>, i: number): TravellerSurf =>
  form.surf[i] ?? { packageId: '', level: 'Beginner' };

/** The room each traveller sleeps in, filling the chosen beds and rooms in list order. */
export const travellerRooms = (form: Pick<BookingFormState, 'rooms' | 'guests'>): string[] => {
  const slots: string[] = [];
  for (const room of ROOMS) {
    const sleeps = (form.rooms[room.id] ?? 0) * unitSleeps(room);
    for (let i = 0; i < sleeps; i++) slots.push(room.title);
  }
  return Array.from({ length: form.guests }, (_, i) => slots[i] ?? '');
};

/** Everything priced so far, in the order the guest picked it. */
export const buildQuote = (form: BookingFormState) => {
  const nights = nightsBetween(form.checkIn, form.checkOut);
  const lines: QuoteLine[] = [];

  for (const room of ROOMS) {
    const count = form.rooms[room.id] ?? 0;
    if (!count || nights < 1) continue;
    lines.push({
      key: `room-${room.id}`,
      title: room.title,
      detail: `${plural(nights, 'night')} · ${count} ${unitName(room, count)}`,
      amount: roomNightly(room) * count * nights,
    });
  }

  if (form.type === 'surf') {
    for (const pkg of SURF_PACKAGES) {
      const count = Array.from({ length: form.guests }, (_, i) => travellerSurf(form, i)).filter(
        (t) => t.packageId === pkg.id,
      ).length;
      if (!count) continue;
      const weekly = pkg.unit.includes('week');
      const weeks = stayWeeks(nights);
      const each = addonAmount(pkg.id, pkg.amount);
      lines.push({
        key: `surf-${pkg.id}`,
        title: pkg.title,
        detail: weekly ? `${plural(count, 'traveller')} · ${plural(weeks, 'week')}` : plural(count, 'traveller'),
        amount: pkg.from ? null : each * count * (weekly ? weeks : 1),
        note: pkg.from ? `from ${formatMoney(each)}${pkg.unit}` : undefined,
      });
    }
  }

  const plan = form.type === 'coworking' ? COWORKING_PLANS.find((p) => p.id === form.desk.planId) : undefined;
  if (plan) {
    lines.push({
      key: 'desk',
      title: plan.name,
      detail: `${plural(form.desk.people, 'desk')} · ${plural(form.desk.periods, planPeriod(plan.period))}`,
      amount: addonAmount(plan.id, plan.amount) * form.desk.people * form.desk.periods,
    });
  }

  for (const extra of EXTRAS) {
    const count = form.extras[extra.id] ?? 0;
    if (!count) continue;
    lines.push({
      key: `extra-${extra.id}`,
      title: extra.title,
      detail: `${count} ×${extra.unit.replace(' /', '')}`,
      amount: addonAmount(extra.id, extra.amount) * count,
    });
  }

  const total = lines.reduce((sum, line) => sum + (line.amount ?? 0), 0);
  return { lines, total };
};
