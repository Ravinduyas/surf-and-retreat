import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Mail } from 'lucide-react';
import { BookingFormState, BookingTab, BookingType, TravellerSurf } from '../../types';
import { usePmsPrices } from '../../pms';
import { buildSteps } from './steps';
import { findPlan, findRoom, findSurf } from './options';
import { buildBookingRequest } from './request';
import { buildQuote, defaultPeriods, travellerSurf } from './quote';
import { contactProblem, coveredGuests, isDatesValid, nightsBetween } from './validation';
import { StepBar } from './StepBar';
import { TypeStep } from './TypeStep';
import { DatesStep } from './DatesStep';
import { RoomStep } from './RoomStep';
import { SurfStep } from './SurfStep';
import { DeskStep } from './DeskStep';
import { ExtrasStep } from './ExtrasStep';
import { SendStep } from './SendStep';
import { QuoteCard } from './QuoteCard';

interface BookingFlowProps {
  /** Which "Book" link the guest followed; it picks the booking type on the first step. */
  initialTab?: BookingTab;
  /** Pre-selects a room, surf package or coworking pass (matching `initialTab`). */
  initialItemId?: string;
}

const TAB_TYPE: Record<BookingTab, BookingType> = { stay: 'rooms', surf: 'surf', coworking: 'coworking' };

const initialForm = (tab: BookingTab, itemId = ''): BookingFormState => ({
  type: TAB_TYPE[tab],
  checkIn: '',
  checkOut: '',
  guests: 1,
  rooms: tab === 'stay' && findRoom(itemId) ? { [itemId]: 1 } : {},
  surf: tab === 'surf' && findSurf(itemId) ? [{ packageId: itemId, level: findSurf(itemId)!.level === 'Intermediate' ? 'Intermediate' : 'Beginner' }] : [],
  desk: { planId: tab === 'coworking' && findPlan(itemId) ? itemId : '', people: 1, periods: 1 },
  extras: {},
  name: '',
  email: '',
  emailConfirm: '',
  country: '',
  dialCode: '',
  phone: '',
  message: '',
});

const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-full bg-[#2A4E38] hover:bg-[#1E3A28] text-white text-sm font-semibold px-6 py-3.5 transition-colors cursor-pointer active:scale-[0.98] disabled:bg-[#B9C4B8] disabled:cursor-not-allowed disabled:active:scale-100';

/**
 * The booking page's step-by-step flow: what you're booking, dates, room, then surf or a desk when
 * chosen, extras, and finally contact details. Each step is one card with Back and Continue in its
 * footer; the running quote sits beside it once something is priced.
 */
export const BookingFlow: React.FC<BookingFlowProps> = ({ initialTab = 'stay', initialItemId }) => {
  // Re-renders with the PMS's prices once they arrive; until then the bundled ones show.
  usePmsPrices();
  const [form, setForm] = useState<BookingFormState>(() => initialForm(initialTab, initialItemId));
  const [stepIndex, setStepIndex] = useState(0);
  // Which channel the guest handed the request to; null until they tap a send link.
  const [sentVia, setSentVia] = useState<'whatsapp' | 'email' | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  const steps = useMemo(() => buildSteps(form.type), [form.type]);
  const step = steps[stepIndex] ?? steps[0];
  const nights = nightsBetween(form.checkIn, form.checkOut);
  const { lines, total } = buildQuote(form);

  // A new step starts with its card in view, without jumping when the guest is already looking at it.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const top = topRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [stepIndex, sentVia]);

  const set = <K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleDates = (checkIn: string, checkOut: string) =>
    setForm((prev) => {
      const plan = findPlan(prev.desk.planId);
      const periods = plan ? defaultPeriods(plan.period, nightsBetween(checkIn, checkOut)) : prev.desk.periods;
      return { ...prev, checkIn, checkOut, desk: { ...prev.desk, periods } };
    });

  const handleGuests = (guests: number) =>
    setForm((prev) => ({ ...prev, guests, desk: { ...prev.desk, people: Math.min(prev.desk.people, guests) } }));

  const handleRoom = (id: string, count: number) =>
    setForm((prev) => {
      const rooms = { ...prev.rooms };
      if (count > 0) rooms[id] = count;
      else delete rooms[id];
      return { ...prev, rooms };
    });

  const handleSurf = (index: number, pick: TravellerSurf) =>
    setForm((prev) => {
      const surf = Array.from({ length: Math.max(prev.guests, prev.surf.length) }, (_, i) => travellerSurf(prev, i));
      surf[index] = pick;
      return { ...prev, surf };
    });

  const handlePlan = (planId: string) => {
    const plan = findPlan(planId);
    if (plan) set('desk', { planId, people: form.desk.people, periods: defaultPeriods(plan.period, nights) });
  };

  const handleExtra = (id: string, count: number) =>
    setForm((prev) => {
      const extras = { ...prev.extras };
      if (count > 0) extras[id] = count;
      else delete extras[id];
      return { ...prev, extras };
    });

  const anySurf = Array.from({ length: form.guests }, (_, i) => travellerSurf(form, i)).some((t) => t.packageId);
  const problem = contactProblem(form);

  const canProceed = (() => {
    switch (step.kind) {
      case 'dates':
        return isDatesValid(form.checkIn, form.checkOut);
      case 'room':
        return coveredGuests(form.rooms) >= form.guests;
      case 'surf':
        return anySurf;
      case 'desk':
        return Boolean(form.desk.planId);
      case 'send':
        return problem === null;
      default:
        return true;
    }
  })();

  const footnote = (() => {
    switch (step.kind) {
      case 'dates':
        return nights >= 1
          ? `${nights} ${nights === 1 ? 'night' : 'nights'} chosen. Next, tell us how many of you there are and pick your room.`
          : 'Pick your check-in and check-out dates, then choose your room.';
      case 'surf':
        return anySurf ? null : 'Pick a package for at least one traveller, or go back and choose Rooms only.';
      case 'desk':
        return form.desk.planId ? null : 'Pick a desk pass to continue.';
      case 'send':
        return problem ? 'A name, matching emails, country and phone are needed before we can send this.' : null;
      default:
        return null;
    }
  })();

  const goNext = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  const request = step.kind === 'send' && !problem ? buildBookingRequest(form) : null;

  const body = sentVia ? (
    <div className="text-center py-8 space-y-3">
      <CheckCircle2 className="w-12 h-12 text-[#2C573A] mx-auto" />
      <h2 className="text-2xl font-bold text-[#18271E]">Almost there!</h2>
      <p className="text-sm text-[#5D6D5F] max-w-md mx-auto">
        Your reservation is written out in {sentVia === 'whatsapp' ? 'WhatsApp' : 'your mail app'}. Just hit send there and
        we&apos;ll come back within 24 hours to confirm. See you in Weligama!
      </p>
      <p className="text-xs text-[#5D6D5F]">
        Nothing opened?{' '}
        {(() => {
          const other = sentVia === 'whatsapp' ? 'email' : 'whatsapp';
          const fallback = buildBookingRequest(form);
          return (
            <a
              href={other === 'whatsapp' ? fallback.whatsappHref : fallback.mailtoHref}
              target={other === 'whatsapp' ? '_blank' : undefined}
              rel="noopener noreferrer"
              onClick={() => setSentVia(other)}
              className="font-semibold text-[#2A4E38] hover:underline"
            >
              Send it by {other === 'whatsapp' ? 'WhatsApp' : 'email'} instead
            </a>
          );
        })()}
        .
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-sm font-semibold">
        <button type="button" onClick={() => setSentVia(null)} className="text-[#2A4E38] hover:underline cursor-pointer">
          Change something
        </button>
        <Link to="/" className="text-[#2A4E38] hover:underline">
          Back to the website
        </Link>
      </div>
    </div>
  ) : (
    <>
      <h2 className="text-2xl font-bold text-[#18271E] tracking-tight mb-6">{step.title}</h2>

      {step.kind === 'type' && <TypeStep value={form.type} onChange={(type) => set('type', type)} />}
      {step.kind === 'dates' && <DatesStep checkIn={form.checkIn} checkOut={form.checkOut} onChange={handleDates} />}
      {step.kind === 'room' && (
        <RoomStep guests={form.guests} rooms={form.rooms} nights={nights} onGuests={handleGuests} onRoom={handleRoom} />
      )}
      {step.kind === 'surf' && <SurfStep form={form} onChange={handleSurf} />}
      {step.kind === 'desk' && (
        <DeskStep desk={form.desk} guests={form.guests} onPlan={handlePlan} onChange={(desk) => set('desk', desk)} />
      )}
      {step.kind === 'extras' && <ExtrasStep extras={form.extras} onChange={handleExtra} />}
      {step.kind === 'send' && <SendStep form={form} onChange={(key, value) => set(key, value)} />}

      {footnote && <p className="text-xs text-[#637265] mt-5">{footnote}</p>}

      <div className="flex items-center justify-between gap-3 mt-6 pt-6 border-t border-[#E5ECE2]">
        <button
          type="button"
          onClick={goBack}
          disabled={stepIndex === 0}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#4B5A4E] hover:text-[#18271E] py-2 cursor-pointer disabled:text-[#C3CCC1] disabled:cursor-not-allowed"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {step.kind !== 'send' ? (
          <button type="button" onClick={goNext} disabled={!canProceed} className={primaryBtn}>
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : request ? (
          <a href={request.whatsappHref} target="_blank" rel="noopener noreferrer" onClick={() => setSentVia('whatsapp')} className={primaryBtn}>
            Send reservation
            <ArrowRight className="w-4 h-4" />
          </a>
        ) : (
          <button type="button" disabled className={primaryBtn}>
            Send reservation
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {step.kind === 'send' && (
        <p className="text-xs text-[#637265] text-right mt-3">
          Opens WhatsApp with your request written out.{' '}
          {request ? (
            <a href={request.mailtoHref} onClick={() => setSentVia('email')} className="inline-flex items-center gap-1 font-semibold text-[#2A4E38] hover:underline">
              <Mail className="w-3 h-3" />
              Send by email instead
            </a>
          ) : (
            <span className="text-[#9AA79C]">Or send it by email.</span>
          )}
        </p>
      )}
    </>
  );

  return (
    <div ref={topRef} className="scroll-mt-24 space-y-6">
      {!sentVia && <StepBar steps={steps} current={stepIndex} onJump={setStepIndex} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-8 bg-white rounded-[28px] border border-[#E4EAE0] shadow-xs p-5 sm:p-8">{body}</section>
        {lines.length > 0 && (
          <aside className="lg:col-span-4 lg:sticky lg:top-24" aria-label="Your quote">
            <QuoteCard lines={lines} total={total} />
          </aside>
        )}
      </div>
    </div>
  );
};
