import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Mail, MessageCircle, X } from 'lucide-react';
import { BookingFormState, BookingTab, BookingType, TravellerSurf } from '../../types';
import { usePmsPrices } from '../../pms';
import { StepKind, buildSteps } from './steps';
import { findPlan, findRoom, findSurf } from './options';
import { buildBookingRequest, formatDate } from './request';
import { buildQuote, defaultPeriods, travellerSurf } from './quote';
import { contactProblem, coveredGuests, isDatesValid, nightsBetween } from './validation';
import { StepBar } from './StepBar';
import { ActionBar } from './ActionBar';
import { TypeStep } from './TypeStep';
import { DatesStep } from './DatesStep';
import { RoomStep } from './RoomStep';
import { SurfStep } from './SurfStep';
import { DeskStep } from './DeskStep';
import { ExtrasStep } from './ExtrasStep';
import { SendStep, SummaryItem } from './SendStep';
import { QuoteCard } from './QuoteCard';

interface BookingFlowProps {
  /** Which "Book" link the guest followed; it picks the booking type on the first step. */
  initialTab?: BookingTab;
  /** Pre-selects a room, surf package or coworking pass (matching `initialTab`). */
  initialItemId?: string;
}

const TAB_TYPE: Record<BookingTab, BookingType> = { stay: 'rooms', surf: 'surf', coworking: 'coworking' };
const TYPE_NAME: Record<BookingType, string> = { rooms: 'Rooms only', surf: 'Rooms + surf', coworking: 'Rooms + coworking' };

const initialForm = (tab: BookingTab, itemId = ''): BookingFormState => {
  const surf = tab === 'surf' ? findSurf(itemId) : undefined;
  return {
    type: TAB_TYPE[tab],
    checkIn: '',
    checkOut: '',
    guests: 1,
    rooms: tab === 'stay' && findRoom(itemId) ? { [itemId]: 1 } : {},
    surf: surf ? [{ packageId: surf.id, level: surf.level === 'Intermediate' ? 'Intermediate' : 'Beginner' }] : [],
    desk: { planId: tab === 'coworking' && findPlan(itemId) ? itemId : '', people: 1, periods: 1 },
    extras: {},
    name: '',
    email: '',
    country: '',
    phoneCountry: '',
    phone: '',
    message: '',
  };
};

const CONTACT_HINT: Record<string, string> = {
  name: 'Add your name to send this',
  email: 'Add a valid email address',
  country: 'Pick the country you live in',
  phone: 'Add your phone or WhatsApp number',
};

const primaryBtn =
  'h-11 inline-flex items-center justify-center gap-2 rounded-full bg-[#2A4E38] hover:bg-[#1E3A28] text-white text-sm font-semibold px-5 sm:px-7 shadow-[0_10px_24px_-12px_rgba(42,78,56,0.9)] transition-all cursor-pointer active:scale-[0.97] disabled:bg-[#C9D2C7] disabled:shadow-none disabled:cursor-not-allowed disabled:active:scale-100';

/**
 * The booking page's step-by-step flow: what you're booking, dates, room, then surf or a desk when
 * chosen, extras, and contact details. Each step is one card; Back and Continue live in a bar pinned
 * to the bottom of the screen, and the running quote sits beside the card (in a sheet on phones).
 */
export const BookingFlow: React.FC<BookingFlowProps> = ({ initialTab = 'stay', initialItemId }) => {
  // Re-renders with the PMS's prices once they arrive; until then the bundled ones show.
  usePmsPrices();
  const [form, setForm] = useState<BookingFormState>(() => initialForm(initialTab, initialItemId));
  const [stepIndex, setStepIndex] = useState(0);
  const [quoteOpen, setQuoteOpen] = useState(false);
  // Which channel the guest handed the request to; null until they tap a send link.
  const [sentVia, setSentVia] = useState<'whatsapp' | 'email' | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  const steps = useMemo(() => buildSteps(form.type), [form.type]);
  const step = steps[stepIndex] ?? steps[0];
  const nights = nightsBetween(form.checkIn, form.checkOut);
  const { lines, total } = buildQuote(form);

  // A new step starts at the top of the flow when the guest has scrolled past it.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const top = topRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [stepIndex, sentVia]);

  // Escape closes the phone quote sheet.
  useEffect(() => {
    if (!quoteOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setQuoteOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [quoteOpen]);

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
  const missingBeds = form.guests - Math.min(coveredGuests(form.rooms), form.guests);

  const canProceed = (() => {
    switch (step.kind) {
      case 'dates':
        return isDatesValid(form.checkIn, form.checkOut);
      case 'room':
        return missingBeds === 0;
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

  // What the bar says: what's missing while Continue is disabled, else a nudge (or null for "Next up").
  const hint = (() => {
    switch (step.kind) {
      case 'dates':
        return nights >= 1
          ? `${nights} ${nights === 1 ? 'night' : 'nights'} chosen · next, your room`
          : form.checkIn
            ? 'Now pick your check-out day'
            : 'Pick your check-in and check-out days';
      case 'room':
        return missingBeds ? `${missingBeds} ${missingBeds === 1 ? 'guest still needs' : 'guests still need'} a bed` : null;
      case 'surf':
        return anySurf ? null : 'Pick a package for at least one traveller';
      case 'desk':
        return form.desk.planId ? null : 'Pick a desk pass to continue';
      case 'send':
        return problem ? CONTACT_HINT[problem] : 'All set · opens WhatsApp with your request written out';
      default:
        return null;
    }
  })();

  const jumpTo = (kind: StepKind) => setStepIndex(Math.max(0, steps.findIndex((s) => s.kind === kind)));
  const goNext = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  const request = step.kind === 'send' && !problem ? buildBookingRequest(form) : null;

  const summary: SummaryItem[] = [
    { label: 'Booking', value: TYPE_NAME[form.type], onEdit: () => jumpTo('type') },
    {
      label: 'Dates',
      value: `${formatDate(form.checkIn).replace(/, \d{4}$/, '')} → ${formatDate(form.checkOut).replace(/, \d{4}$/, '')}`,
      onEdit: () => jumpTo('dates'),
    },
    { label: 'Guests', value: `${form.guests} ${form.guests === 1 ? 'guest' : 'guests'}`, onEdit: () => jumpTo('room') },
  ];

  const quote = (bare = false) => (
    <QuoteCard lines={lines} total={total} checkIn={form.checkIn} checkOut={form.checkOut} nights={nights} guests={form.guests} bare={bare} />
  );

  if (sentVia) {
    const other = sentVia === 'whatsapp' ? 'email' : 'whatsapp';
    const fallback = buildBookingRequest(form);
    return (
      <div ref={topRef} className="scroll-mt-24 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-8 step-in bg-white rounded-[28px] border border-[#E4EAE0] shadow-xs px-6 py-12 sm:p-14 text-center">
          <span className="relative mx-auto w-20 h-20 rounded-full bg-[#F2F6F0] flex items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-[#D8E95E]/40 animate-ping" aria-hidden="true" />
            <CheckCircle2 className="relative w-10 h-10 text-[#2A4E38]" />
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#18271E] tracking-tight mt-6">Almost there!</h2>
          <p className="text-sm sm:text-base text-[#5D6D5F] max-w-md mx-auto mt-3 leading-relaxed">
            Your reservation is written out in {sentVia === 'whatsapp' ? 'WhatsApp' : 'your mail app'}. Just hit send there and
            we&apos;ll come back within 24 hours to confirm. See you in Weligama!
          </p>
          <p className="text-xs text-[#637265] mt-5">
            Nothing opened?{' '}
            <a
              href={other === 'whatsapp' ? fallback.whatsappHref : fallback.mailtoHref}
              target={other === 'whatsapp' ? '_blank' : undefined}
              rel="noopener noreferrer"
              onClick={() => setSentVia(other)}
              className="font-semibold text-[#2A4E38] hover:underline"
            >
              Send it by {other === 'whatsapp' ? 'WhatsApp' : 'email'} instead
            </a>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            <button
              type="button"
              onClick={() => setSentVia(null)}
              className="h-11 px-5 rounded-full border border-[#DCE2D8] text-sm font-semibold text-[#2A4E38] hover:border-[#2A4E38] transition-colors cursor-pointer"
            >
              Change something
            </button>
            <Link to="/" className="h-11 px-5 rounded-full bg-[#2A4E38] text-white text-sm font-semibold inline-flex items-center hover:bg-[#1E3A28] transition-colors">
              Back to the website
            </Link>
          </div>
        </section>
        <aside className="lg:col-span-4 lg:sticky lg:top-24" aria-label="Your quote">
          {quote()}
        </aside>
      </div>
    );
  }

  const primary =
    step.kind !== 'send' ? (
      <button type="button" onClick={goNext} disabled={!canProceed} className={primaryBtn}>
        Continue
        <ArrowRight className="w-4 h-4" />
      </button>
    ) : request ? (
      <a href={request.whatsappHref} target="_blank" rel="noopener noreferrer" onClick={() => setSentVia('whatsapp')} className={primaryBtn}>
        <MessageCircle className="w-4 h-4" />
        <span>
          Send<span className="hidden sm:inline"> reservation</span>
        </span>
      </a>
    ) : (
      <button type="button" disabled className={primaryBtn}>
        <MessageCircle className="w-4 h-4" />
        <span>
          Send<span className="hidden sm:inline"> reservation</span>
        </span>
      </button>
    );

  return (
    <>
      <div ref={topRef} className="scroll-mt-20 space-y-4 sm:space-y-5 pb-28 sm:pb-32">
        <StepBar steps={steps} current={stepIndex} onJump={setStepIndex} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
          <section
            key={step.kind}
            className="lg:col-span-8 step-in bg-white rounded-[24px] border border-[#E4EAE0] shadow-[0_20px_50px_-36px_rgba(24,39,30,0.4)] p-4 sm:p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-4 sm:mb-5">
              <h2 className="text-xl sm:text-2xl font-bold text-[#18271E] tracking-tight leading-tight">{step.title}</h2>
              <p className="text-xs sm:text-sm text-[#637265]">{step.subtitle}</p>
            </div>

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
            {step.kind === 'send' && (
              <>
                <SendStep form={form} summary={summary} onChange={(key, value) => set(key, value)} />
                <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-[#637265] mt-5 pt-4 border-t border-[#EEF2EB]">
                  <Mail className="w-3.5 h-3.5" />
                  Prefer email?
                  {request ? (
                    <a href={request.mailtoHref} onClick={() => setSentVia('email')} className="font-semibold text-[#2A4E38] hover:underline">
                      Send it by email instead
                    </a>
                  ) : (
                    <span>You can send it by email once your details are in.</span>
                  )}
                </p>
              </>
            )}
          </section>

          <aside className="hidden lg:block lg:col-span-4 lg:sticky lg:top-[72px]" aria-label="Your quote">
            {quote()}
          </aside>
        </div>
      </div>

      <ActionBar
        steps={steps}
        current={stepIndex}
        hint={hint}
        blocked={!canProceed}
        total={total}
        onBack={goBack}
        onOpenQuote={() => setQuoteOpen(true)}
        primary={primary}
      />

      {quoteOpen && (
        <div className="lg:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Your quote">
          <button type="button" aria-label="Close quote" onClick={() => setQuoteOpen(false)} className="modal-fade absolute inset-0 bg-[#0F1D15]/50 backdrop-blur-[2px]" />
          <div className="sheet-up absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[28px] bg-white pb-[env(safe-area-inset-bottom)]">
            <div className="sticky top-0 z-10 flex justify-center pt-2.5 pb-1 bg-[#1F3A2A]">
              <span className="w-10 h-1 rounded-full bg-white/30" aria-hidden="true" />
            </div>
            <button
              type="button"
              onClick={() => setQuoteOpen(false)}
              aria-label="Close quote"
              className="absolute right-4 top-4 z-20 w-8 h-8 rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            {quote(true)}
          </div>
        </div>
      )}
    </>
  );
};
