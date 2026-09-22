import React, { useMemo, useState } from 'react';
import { CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { BookingFormState, BookingTab } from '../../types';
import { buildSteps, isExtraStep } from './steps';
import { getBookingOptions } from './options';
import { NO_ROOM, hasRoom, isDatesStepValid, isValidEmail, roomFitsGuests } from './validation';
import { StepProgress } from './StepProgress';
import { GuestsStep } from './GuestsStep';
import { OptionStep } from './OptionStep';
import { SurfStep } from './SurfStep';
import { CoworkingStep } from './CoworkingStep';
import { DatesStep } from './DatesStep';
import { DetailsStep } from './DetailsStep';
import { ReviewStep } from './ReviewStep';

interface BookingModalProps {
  /**
   * Where the guest came from. 'stay' (or nothing) starts a normal room booking; 'surf' and 'coworking'
   * start with no bed and that extra listed first, since they usually want the lessons or the desk.
   */
  initialTab?: BookingTab;
  /** Pre-selects a room, surf package or coworking pass (matching `initialTab`). */
  initialItemId?: string;
  onClose: () => void;
}

/** Fills the space under the page header: edge-to-edge on phones, a centered fixed-size card on larger screens. */
const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex-1 min-h-0 w-full flex sm:items-center justify-center sm:px-6 sm:pb-6">
    <div className="w-full sm:max-w-2xl bg-white sm:rounded-[28px] sm:border border-[#DCE2D8] sm:shadow-2xl flex flex-col min-h-0 sm:h-[min(46rem,100%)] overflow-hidden">
      {children}
    </div>
  </div>
);

const initialForm = (tab: BookingTab, itemId?: string): BookingFormState => {
  const valid = itemId && getBookingOptions(tab).some((o) => o.id === itemId) ? itemId : '';
  return {
    roomId: tab === 'stay' ? valid : NO_ROOM,
    surfId: tab === 'surf' ? valid : '',
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

export const BookingModal: React.FC<BookingModalProps> = ({ initialTab = 'stay', initialItemId, onClose }) => {
  const [formData, setFormData] = useState<BookingFormState>(() => initialForm(initialTab, initialItemId));
  // The extra the guest came from gets its screen first.
  const steps = useMemo(() => buildSteps(initialTab === 'coworking' ? 'coworking' : 'surf'), [initialTab]);

  // Group size comes first: it decides which rooms are bookable.
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const currentStep = steps[stepIndex] ?? steps[0];
  const withRoom = hasRoom(formData);
  const hasExtra = Boolean(formData.surfId || formData.coworkingId);
  // Someone with no bed has to be booking lessons or a desk. Each extra has its own screen, so the
  // first one can still be skipped while another extra screen is still to come.
  const laterExtraStep = steps.slice(stepIndex + 1).some((s) => isExtraStep(s.kind));
  const extraRequired = !withRoom && !hasExtra && !laterExtraStep;
  const selectedOnThisStep =
    currentStep.kind === 'surf' ? formData.surfId : currentStep.kind === 'coworking' ? formData.coworkingId : '';

  const update = <K extends keyof BookingFormState>(field: K, value: BookingFormState[K]) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleGuestsChange = (guests: number) =>
    setFormData((prev) => {
      const room = getBookingOptions('stay').find((o) => o.id === prev.roomId);
      const stillFits = !room || roomFitsGuests(room, guests);
      return { ...prev, guests, roomId: stillFits ? prev.roomId : '' };
    });

  const canProceed = (() => {
    switch (currentStep.kind) {
      case 'room':
        return formData.roomId !== '';
      case 'surf':
      case 'coworking':
        return !extraRequired;
      case 'dates':
        return isDatesStepValid(withRoom, formData.checkIn, formData.checkOut);
      case 'details':
        return formData.name.trim().length > 1 && isValidEmail(formData.email);
      default:
        return true;
    }
  })();

  const goNext = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  const handleSubmit = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      setTimeout(onClose, 3200);
    }, 1400);
  };

  if (submitted) {
    return (
      <Frame>
        <div className="flex-1 flex flex-col justify-center px-6 py-16 sm:p-12 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-[#2C573A] mx-auto animate-bounce" />
          <h4 className="text-lg font-bold text-[#18271E]">Request Sent!</h4>
          <p className="text-xs text-[#5D6D5F] max-w-xs mx-auto">
            We&apos;ll get back to you within 24 hours to confirm your booking. See you in Weligama!
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 text-xs font-semibold text-[#2A4E38] hover:underline cursor-pointer"
          >
            Close
          </button>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <StepProgress
        stepIndex={stepIndex}
        totalSteps={steps.length}
        title={currentStep.title}
        subtitle={currentStep.subtitle}
        onBack={goBack}
        onClose={onClose}
      />

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-4">
        {currentStep.kind === 'guests' && <GuestsStep guests={formData.guests} onChange={handleGuestsChange} />}

        {currentStep.kind === 'room' && (
          <OptionStep guests={formData.guests} value={formData.roomId} onSelect={(id) => update('roomId', id)} />
        )}

        {currentStep.kind === 'surf' && (
          <SurfStep value={formData.surfId} required={extraRequired} onChange={(id) => update('surfId', id)} />
        )}

        {currentStep.kind === 'coworking' && (
          <CoworkingStep
            value={formData.coworkingId}
            required={extraRequired}
            onChange={(id) => update('coworkingId', id)}
          />
        )}

        {currentStep.kind === 'dates' && (
          <DatesStep
            hasRoom={withRoom}
            checkIn={formData.checkIn}
            checkOut={formData.checkOut}
            onChange={(field, value) => update(field, value)}
          />
        )}

        {currentStep.kind === 'details' && (
          <DetailsStep formData={formData} onChange={(field, value) => update(field, value)} />
        )}

        {currentStep.kind === 'review' && <ReviewStep formData={formData} steps={steps} onEdit={setStepIndex} />}
      </div>

      <div className="shrink-0 px-4 sm:px-8 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6 bg-white border-t border-[#EEF2EB]">
        {stepIndex < steps.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={!canProceed}
            className="w-full bg-[#2A4E38] hover:bg-[#1E3A28] disabled:opacity-40 disabled:hover:bg-[#2A4E38] disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-full text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-98"
          >
            <span>
              {isExtraStep(currentStep.kind) && !selectedOnThisStep && !extraRequired
                ? currentStep.kind === 'surf'
                  ? 'Skip surf lessons'
                  : 'Skip desk pass'
                : 'Continue'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-[#2A4E38] hover:bg-[#1E3A28] disabled:opacity-70 text-white font-semibold py-3.5 rounded-full text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-98"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <span>Confirm &amp; Send Request</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>
    </Frame>
  );
};
