import React from 'react';
import { BedDouble, Flower2, Laptop, LucideIcon, Moon, Users, Waves, Zap } from 'lucide-react';
import { BookingFormState } from '../../types';
import { findOption } from './options';
import { StepDef, StepKind } from './steps';
import { NO_ROOM, nightsBetween } from './validation';

interface BookingSidebarProps {
  formData: BookingFormState;
  steps: StepDef[];
  stepIndex: number;
  /** The step's main button(s). Shown here on wide screens; phones get them in a bar above the step nav. */
  action: React.ReactNode;
}

const long = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const weekday = (key: string) => new Date(`${key}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' });

const card = 'bg-white rounded-2xl border border-[#E4EAE0] shadow-xs';
const eyebrow = 'text-[10px] font-bold uppercase tracking-[0.14em]';

const DateCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className={`${card} flex-1 min-w-0 px-4 py-2.5`}>
    <span className={`${eyebrow} text-[#7FA35B]`}>{label}</span>
    <span className={`block text-[15px] font-bold mt-1 truncate ${value ? 'text-[#18271E]' : 'text-[#B3BEB2]'}`}>
      {value ? long(value) : 'Not set'}
    </span>
    <span className="block text-[11px] text-[#7A897C] h-4">{value && weekday(value)}</span>
  </div>
);

const NEXT: Record<StepKind, { title: string; text: string }> = {
  guests: { title: 'Tell us who is coming', text: 'Group size decides which rooms you can book.' },
  dates: { title: 'Select your dates', text: 'Pick your arrival and departure on the calendar.' },
  room: { title: 'Pick your room', text: 'Choose a bed that fits your group, or book add-ons or a desk only.' },
  addons: { title: 'Pick your add-ons', text: 'Optional — surfing, skating, yoga or a co-working desk.' },
  coworking: { title: 'Add a desk pass', text: 'Optional — a desk on 300 Mbps fiber by the day, week or month.' },
  details: { title: 'Your details', text: 'Your name and email so we can confirm the booking.' },
  review: { title: 'Review & send', text: 'Check everything, then send the request on WhatsApp or by email.' },
};

const PickRow: React.FC<{ icon: LucideIcon; label: string; value: string; price?: string }> = ({
  icon: Icon,
  label,
  value,
  price,
}) => (
  <li className="flex items-center gap-3 py-2.5 border-b border-[#EEF2EB] last:border-b-0">
    <span className="w-8 h-8 rounded-full bg-[#F2F6F0] text-[#2A4E38] flex items-center justify-center shrink-0">
      <Icon className="w-4 h-4" />
    </span>
    <span className="flex-1 min-w-0">
      <span className={`block ${eyebrow} text-[#8B9A8D]`}>{label}</span>
      <span className="block text-[13px] font-semibold text-[#18271E] truncate">{value}</span>
    </span>
    {price && <span className="text-xs font-semibold text-[#2A4E38] shrink-0">{price}</span>}
  </li>
);

export const BookingSidebar: React.FC<BookingSidebarProps> = ({ formData, steps, stepIndex, action }) => {
  const { checkIn, checkOut, guests } = formData;
  const current = steps[stepIndex];
  const next = steps[stepIndex + 1];
  const nights = nightsBetween(checkIn, checkOut);
  const hasDates = Boolean(checkIn && checkOut);

  const room = findOption('stay', formData.roomId);
  const surf = findOption('surf', formData.surfId);
  const skate = findOption('skate', formData.skateId);
  const yoga = findOption('yoga', formData.yogaId);
  const desk = findOption('coworking', formData.coworkingId);
  // Co-working-only bookings have no room step, so "No bed needed" would only be noise there.
  const hasRoomStep = steps.some((s) => s.kind === 'room');

  const length = !hasDates ? '—' : nights === 0 ? '1 day' : `${nights} ${nights === 1 ? 'night' : 'nights'}`;
  const upNext = next ? NEXT[next.kind] : null;

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <DateCard label="Check-in" value={checkIn} />
        <DateCard label="Check-out" value={checkOut} />
      </div>

      <div className={`${card} px-4 py-3 flex items-center justify-between gap-3`}>
        <span className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-full border border-[#DCE2D8] text-[#2A4E38] flex items-center justify-center">
            <Moon className="w-4 h-4" />
          </span>
          <span className={`${eyebrow} text-[#2A4E38]`}>Length of stay</span>
        </span>
        <span className="text-sm text-[#637265]">
          <span className="text-xl font-bold text-[#18271E] mr-1">{hasDates ? (nights || 1) : '—'}</span>
          {hasDates && (nights === 0 ? 'day' : nights === 1 ? 'night' : 'nights')}
        </span>
      </div>

      {current.kind === 'dates' ? (
        <div className={`${card} px-4 py-3`}>
          <span className={`${eyebrow} text-[#8B9A8D]`}>Trip timeline</span>
          {hasDates ? (
            <div className="mt-3 flex items-start gap-2">
              <span className="flex flex-col items-center gap-1 shrink-0">
                <span className="w-9 h-9 rounded-full bg-[#2A4E38] text-white text-[10px] font-bold flex items-center justify-center">IN</span>
                <span className="text-[11px] text-[#7A897C]">{weekday(checkIn)}</span>
              </span>
              <span className="relative flex-1 h-1.5 mt-4 rounded-full bg-gradient-to-r from-[#2A4E38] to-[#7FA35B]">
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border border-[#DCE2D8] rounded-full px-2 py-0.5 text-[10px] font-bold text-[#2A4E38] whitespace-nowrap">
                  {length}
                </span>
              </span>
              <span className="flex flex-col items-center gap-1 shrink-0">
                <span className="w-9 h-9 rounded-full bg-[#D8E95E] text-[#193B26] text-[10px] font-bold flex items-center justify-center">OUT</span>
                <span className="text-[11px] text-[#7A897C]">{weekday(checkOut)}</span>
              </span>
            </div>
          ) : (
            <p className="text-xs text-[#9AA79C] mt-2">Your stay appears here once you pick both days.</p>
          )}
        </div>
      ) : current.kind === 'review' ? null : (
        // The review card already lists every pick, so the summary skips them there.
        <ul className={`${card} px-4 py-1`}>
          <PickRow icon={Users} label="Guests" value={`${guests} ${guests === 1 ? 'guest' : 'guests'}`} />
          {(room || (formData.roomId === NO_ROOM && hasRoomStep)) && (
            <PickRow
              icon={BedDouble}
              label="Room"
              value={room ? room.title : 'No bed needed'}
              price={room?.price}
            />
          )}
          {surf && <PickRow icon={Waves} label="Surf" value={surf.title} price={surf.price} />}
          {skate && <PickRow icon={Zap} label="Skate" value={skate.title} price={skate.price} />}
          {yoga && <PickRow icon={Flower2} label="Yoga" value={yoga.title} price={yoga.price} />}
          {desk && <PickRow icon={Laptop} label="Coworking" value={desk.title} price={desk.price} />}
        </ul>
      )}

      <div className="hidden lg:block rounded-2xl border border-[#E4EAE0] bg-gradient-to-br from-[#F2F6EA] to-white px-4 py-3.5">
        <span className={`${eyebrow} text-[#7FA35B]`}>{upNext ? "What's next" : 'After you send'}</span>
        <p className="text-[15px] font-bold text-[#18271E] mt-1.5">
          {upNext ? upNext.title : 'We confirm within 24 hours'}
        </p>
        <p className="text-xs text-[#637265] mt-1 leading-relaxed">
          {upNext
            ? upNext.text
            : "We'll check availability and reply with your confirmation and payment details."}
        </p>
      </div>

      <div className="hidden lg:block">{action}</div>
    </div>
  );
};
