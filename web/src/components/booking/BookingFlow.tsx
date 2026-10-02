import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CheckCircle2,
  ClipboardCheck,
  Laptop,
  LucideIcon,
  Mail,
  MessageCircle,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react';
import { BookingFormState, BookingTab } from '../../types';
import { usePmsPrices } from '../../pms';
import { BookingMode, buildSteps, isExtraStep, StepKind } from './steps';
import { getBookingOptions } from './options';
import { buildBookingRequest } from './request';
import { NO_ROOM, hasRoom, isDatesStepValid, isValidEmail, nightsBetween, roomFitsGuests } from './validation';
import { StepNav } from './StepNav';
import { BookingTopBar } from './BookingTopBar';
import { Panel } from './Panel';
import { BookingSidebar } from './BookingSidebar';
import { GuestsStep } from './GuestsStep';
import { DatesStep } from './DatesStep';
import { OptionStep } from './OptionStep';
import { ADDON_FIELD, AddonGroup, AddonsStep, pickedAddons, unfinishedAddons } from './AddonsStep';
import { CoworkingStep } from './CoworkingStep';
import { DetailsStep } from './DetailsStep';
import { ReviewStep } from './ReviewStep';

interface BookingFlowProps {
  /**
   * Where the guest came from. 'stay' (or nothing) starts a normal room booking; 'surf' starts it with
   * no bed, since they usually want the lessons; 'coworking' starts the co-working-only booking.
   */
  initialTab?: BookingTab;
  /** Pre-selects a room, surf package or coworking pass (matching `initialTab`). */
  initialItemId?: string;
  onClose: () => void;
}

/** Header of the main card for every step except dates, which builds its own. */
const PANELS: Record<Exclude<StepKind, 'dates'>, { icon: LucideIcon; title: string; hint: string }> = {
  guests: { icon: Users, title: 'Your group', hint: 'Count everyone, including you.' },
  room: { icon: BedDouble, title: 'Pick a bed', hint: 'Rooms too small for your group are greyed out.' },
  addons: { icon: Sparkles, title: 'Add-ons', hint: 'Tick an add-on to see its options.' },
  coworking: { icon: Laptop, title: 'Coworking passes', hint: 'Tap a pass to add it, tap again to remove it.' },
  details: { icon: UserRound, title: 'Contact details', hint: 'Only used to confirm this booking.' },
  review: { icon: ClipboardCheck, title: 'Your request', hint: 'Tap the pencil on any line to change it.' },
};

const initialForm = (tab: BookingTab, itemId?: string): BookingFormState => {
  const valid = itemId && getBookingOptions(tab).some((o) => o.id === itemId) ? itemId : '';
  return {
    roomId: tab === 'stay' ? valid : NO_ROOM,
    surfId: tab === 'surf' ? valid : '',
    skateId: '',
    yogaId: '',
    coworkingId: tab === 'coworking' ? valid : '',
    checkIn: '',
    checkOut: '',
    guests: 1,
    name: '',
    email: '',
    phone: '',
    message: '',
  };
};

const primaryBtn =
  'w-full bg-[#2A4E38] hover:bg-[#1E3A28] disabled:opacity-40 disabled:hover:bg-[#2A4E38] disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-full text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.98]';

export const BookingFlow: React.FC<BookingFlowProps> = ({ initialTab = 'stay', initialItemId, onClose }) => {
  // Re-renders the flow with the PMS's prices once they arrive; until then the bundled ones show.
  usePmsPrices();
  const [formData, setFormData] = useState<BookingFormState>(() => initialForm(initialTab, initialItemId));
  const [mode, setMode] = useState<BookingMode>(initialTab === 'coworking' ? 'coworking' : 'stay');
  // Ticked add-ons on the add-ons screen. Starts with any already picked (e.g. a surf package link).
  const [openAddons, setOpenAddons] = useState<AddonGroup[]>(() =>
    initialTab === 'coworking' ? [] : pickedAddons(formData),
  );
  const steps = useMemo(() => buildSteps(mode), [mode]);
  const [stepIndex, setStepIndex] = useState(0);
  // Which channel the guest handed the request to; null until they tap one of the send links.
  const [sentVia, setSentVia] = useState<'whatsapp' | 'email' | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Each step starts at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [stepIndex]);

  const currentStep = steps[stepIndex] ?? steps[0];
  const withRoom = hasRoom(formData);
  const hasExtra = Boolean(formData.surfId || formData.skateId || formData.yogaId || formData.coworkingId);
  const nights = nightsBetween(formData.checkIn, formData.checkOut);
  // Someone with no bed has to be booking an add-on or a desk.
  const laterExtraStep = steps.slice(stepIndex + 1).some((s) => isExtraStep(s.kind));
  const extraRequired = !withRoom && !hasExtra && !laterExtraStep;
  const selectedOnThisStep =
    currentStep.kind === 'addons' ? openAddons.length > 0 : currentStep.kind === 'coworking' && Boolean(formData.coworkingId);

  const update = <K extends keyof BookingFormState>(field: K, value: BookingFormState[K]) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  // Unticking an add-on drops whatever was picked under it.
  const toggleAddon = (group: AddonGroup) => {
    if (openAddons.includes(group)) {
      setOpenAddons(openAddons.filter((g) => g !== group));
      update(ADDON_FIELD[group], '');
    } else {
      setOpenAddons([...openAddons, group]);
    }
  };

  // Co-working only has no bed or activities, so they're cleared; switching back to a stay re-opens the room choice.
  const switchMode = (next: BookingMode) => {
    setMode(next);
    setStepIndex(0);
    if (next === 'coworking') setOpenAddons([]);
    else setOpenAddons(formData.coworkingId ? ['coworking'] : []);
    setFormData((prev) =>
      next === 'coworking'
        ? { ...prev, roomId: NO_ROOM, surfId: '', skateId: '', yogaId: '' }
        : { ...prev, roomId: prev.roomId === NO_ROOM ? '' : prev.roomId },
    );
  };

  const handleGuestsChange = (guests: number) =>
    setFormData((prev) => {
      const room = getBookingOptions('stay').find((o) => o.id === prev.roomId);
      const stillFits = !room || roomFitsGuests(room, guests);
      return { ...prev, guests, roomId: stillFits ? prev.roomId : '' };
    });

  // A bed needs at least one night, so a chosen room is dropped if the dates shrink to a single day.
  const handleDatesChange = (checkIn: string, checkOut: string) =>
    setFormData((prev) => {
      const singleDay = Boolean(checkIn && checkOut) && nightsBetween(checkIn, checkOut) < 1;
      return { ...prev, checkIn, checkOut, roomId: singleDay && hasRoom(prev) ? '' : prev.roomId };
    });

  const canProceed = (() => {
    switch (currentStep.kind) {
      case 'dates':
        return isDatesStepValid(formData.checkIn, formData.checkOut);
      case 'room':
        return formData.roomId === NO_ROOM || (formData.roomId !== '' && nights >= 1);
      case 'addons':
        // Every ticked add-on needs an option picked (or unticking).
        return !extraRequired && unfinishedAddons(openAddons, formData).length === 0;
      case 'coworking':
        return !extraRequired;
      case 'details':
        return formData.name.trim().length > 1 && isValidEmail(formData.email);
      default:
        return true;
    }
  })();

  const goNext = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  // The site has no server, so the request goes out through the guest's own WhatsApp or email app.
  const request = currentStep.kind === 'review' ? buildBookingRequest(formData) : null;

  if (sentVia) {
    const other = sentVia === 'whatsapp' ? 'email' : 'whatsapp';
    const fallback = buildBookingRequest(formData);
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <BookingTopBar eyebrow="Booking" title="Request Ready" />
        <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white rounded-[28px] border border-[#E4EAE0] shadow-xl px-6 py-12 sm:p-12 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-[#2C573A] mx-auto animate-bounce" />
          <h2 className="text-xl font-bold text-[#18271E]">Almost there!</h2>
          <p className="text-sm text-[#5D6D5F]">
            Your request is written out in {sentVia === 'whatsapp' ? 'WhatsApp' : 'your mail app'} — just hit send
            there. We&apos;ll reply within 24 hours to confirm. See you in Weligama!
          </p>
          <p className="text-xs text-[#5D6D5F]">
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
            .
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 text-sm font-semibold text-[#2A4E38] hover:underline cursor-pointer"
          >
            Close
          </button>
        </div>
        </div>
      </div>
    );
  }

  const continueLabel =
    isExtraStep(currentStep.kind) && !selectedOnThisStep && !extraRequired
      ? currentStep.kind === 'addons'
        ? 'Skip Add-ons'
        : 'Skip Desk Pass'
      : currentStep.kind === 'dates'
        ? `Continue to ${steps[stepIndex + 1].label}`
        : 'Continue';

  const mainAction = request ? (
    <div className="space-y-2">
      <a href={request.whatsappHref} target="_blank" rel="noopener noreferrer" onClick={() => setSentVia('whatsapp')} className={primaryBtn}>
        <MessageCircle className="w-4 h-4" />
        <span>Send Request on WhatsApp</span>
      </a>
      <a
        href={request.mailtoHref}
        onClick={() => setSentVia('email')}
        className="w-full text-[#2A4E38] hover:bg-[#F2F6F0] font-semibold py-2.5 rounded-full text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
      >
        <Mail className="w-3.5 h-3.5" />
        <span>Send by email instead</span>
      </a>
    </div>
  ) : (
    <button type="button" onClick={goNext} disabled={!canProceed} className={primaryBtn}>
      <span>{continueLabel}</span>
      <ArrowRight className="w-4 h-4" />
    </button>
  );

  // Back sits beside the main button, so both ways through the flow are in one place.
  const action = (
    <div className="flex items-start gap-2.5">
      {stepIndex > 0 && (
        <button
          type="button"
          onClick={goBack}
          aria-label={`Back to ${steps[stepIndex - 1].label}`}
          title={`Back to ${steps[stepIndex - 1].label}`}
          className="shrink-0 h-[50px] px-4 sm:px-5 rounded-full border border-[#CBD6C8] bg-white text-[#2A4E38] font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-[#F2F6F0] transition-colors cursor-pointer active:scale-[0.98]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </button>
      )}
      <div className="flex-1 min-w-0">{mainAction}</div>
    </div>
  );

  const panel = currentStep.kind === 'dates' ? null : PANELS[currentStep.kind];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <BookingTopBar eyebrow={`Step ${stepIndex + 1} of ${steps.length}`} title={currentStep.title} />
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-4 sm:pt-6 pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
            <div className="lg:col-span-7 min-w-0">
              {currentStep.kind === 'dates' && (
                <DatesStep checkIn={formData.checkIn} checkOut={formData.checkOut} onChange={handleDatesChange} />
              )}

              {panel && (
                <Panel icon={panel.icon} title={panel.title} hint={panel.hint}>
                  {currentStep.kind === 'guests' && (
                    <>
                      <GuestsStep
                        guests={formData.guests}
                        coworkingOnly={mode === 'coworking'}
                        onChange={handleGuestsChange}
                      />
                      <button
                        type="button"
                        onClick={() => switchMode(mode === 'stay' ? 'coworking' : 'stay')}
                        className="mt-4 w-full flex items-center gap-3 p-4 rounded-2xl border border-dashed border-[#B9C8B7] text-left hover:bg-[#F2F6F0] transition-colors cursor-pointer"
                      >
                        <span className="w-10 h-10 rounded-full bg-[#F2F6F0] text-[#2A4E38] flex items-center justify-center shrink-0">
                          {mode === 'stay' ? <Laptop className="w-5 h-5" /> : <BedDouble className="w-5 h-5" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-bold text-[#18271E]">
                            {mode === 'stay' ? 'Only need a desk?' : 'Need a bed too?'}
                          </span>
                          <span className="block text-xs text-[#637265] mt-0.5">
                            {mode === 'stay'
                              ? 'Book co-working only — no room needed.'
                              : 'Switch to a stay with a room, add-ons and an optional desk.'}
                          </span>
                        </span>
                        <ArrowRight className="w-4 h-4 text-[#2A4E38] shrink-0" />
                      </button>
                    </>
                  )}
                  {currentStep.kind === 'room' && (
                    <OptionStep
                      guests={formData.guests}
                      nights={nights}
                      value={formData.roomId}
                      onSelect={(id) => update('roomId', id)}
                    />
                  )}
                  {currentStep.kind === 'addons' && (
                    <AddonsStep
                      formData={formData}
                      open={openAddons}
                      onToggle={toggleAddon}
                      required={extraRequired}
                      onChange={update}
                    />
                  )}
                  {currentStep.kind === 'coworking' && (
                    <CoworkingStep
                      value={formData.coworkingId}
                      // The "you chose no bed" note doesn't apply when the desk is the whole booking.
                      required={extraRequired && mode === 'stay'}
                      onChange={(id) => update('coworkingId', id)}
                    />
                  )}
                  {currentStep.kind === 'details' && (
                    <DetailsStep formData={formData} onChange={(field, value) => update(field, value)} />
                  )}
                  {currentStep.kind === 'review' && <ReviewStep formData={formData} steps={steps} onEdit={setStepIndex} />}
                </Panel>
              )}
            </div>

            <aside className="lg:col-span-5 lg:sticky lg:top-2" aria-label="Your booking">
              <BookingSidebar formData={formData} steps={steps} stepIndex={stepIndex} action={action} />
            </aside>
          </div>
        </div>
      </div>

      {/* Phones and tablets: the main button sits just above the step bar */}
      <div className="lg:hidden shrink-0 px-4 sm:px-8 pt-3 pb-3 bg-[#F6F7F4]">{action}</div>

      <StepNav steps={steps} current={stepIndex} onJump={setStepIndex} />
    </div>
  );
};
