import React from 'react';
import { BedDouble, Check, Laptop, LucideIcon, Waves } from 'lucide-react';
import { COWORKING_PLANS, ROOMS, SURF_PACKAGES } from '../../data';
import { BookingType } from '../../types';
import { formatMoney } from '../../pms';
import { Photo } from '../ui/Photo';
import { addonAmount, roomNightly } from './options';

const img = (name: string) => `${import.meta.env.BASE_URL}images/${name}`;

interface TypeStepProps {
  value: BookingType;
  onChange: (type: BookingType) => void;
}

/** First step: three photo cards. The choice decides whether a surf or desk step follows the room. */
export const TypeStep: React.FC<TypeStepProps> = ({ value, onChange }) => {
  const cheapestBed = Math.min(...ROOMS.map(roomNightly));
  const TYPES: { type: BookingType; title: string; text: string; icon: LucideIcon; image: string; price: string }[] = [
    {
      type: 'rooms',
      title: 'Rooms only',
      text: 'A dorm bed or a private room, nothing else.',
      icon: BedDouble,
      image: img('dorm-8bed.webp'),
      price: `Beds from ${formatMoney(cheapestBed)} / night`,
    },
    {
      type: 'surf',
      title: 'Rooms + surf',
      text: 'A stay with surf lessons, coaching or a board.',
      icon: Waves,
      image: img('surf-walk-in.webp'),
      price: `Surf weeks from ${formatMoney(addonAmount(SURF_PACKAGES[0].id, SURF_PACKAGES[0].amount))}`,
    },
    {
      type: 'coworking',
      title: 'Rooms + coworking',
      text: 'Somewhere to sleep and a desk on 300 Mbps fiber.',
      icon: Laptop,
      image: img('coworking.webp'),
      price: `Desks from ${formatMoney(addonAmount(COWORKING_PLANS[0].id, COWORKING_PLANS[0].amount))} / day`,
    },
  ];

  return (
    <div role="radiogroup" aria-label="What are you booking" className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
      {TYPES.map(({ type, title, text, icon: Icon, image, price }) => {
        const active = value === type;
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(type)}
            className={`group relative flex sm:flex-col text-left rounded-2xl border bg-white overflow-hidden transition-all duration-300 cursor-pointer ${
              active
                ? 'border-[#2A4E38] ring-2 ring-[#2A4E38] shadow-[0_12px_32px_-20px_rgba(42,78,56,0.65)]'
                : 'border-[#DCE2D8] hover:border-[#9DB09A] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-24px_rgba(24,39,30,0.35)]'
            }`}
          >
            <span className="relative w-20 sm:w-full shrink-0 sm:h-24 sm:min-h-[96px] lg:h-28 overflow-hidden bg-[#EBF0E8]">
              <Photo
                src={image}
                alt=""
                sizes="(min-width: 640px) 260px, 96px"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              <span className="hidden sm:flex absolute left-2.5 bottom-2.5 w-7.5 h-7.5 rounded-full bg-white/95 backdrop-blur text-[#2A4E38] items-center justify-center shadow-xs">
                <Icon className="w-3.5 h-3.5" />
              </span>
            </span>

            <span className="flex-1 min-w-0 flex flex-col gap-0.5 p-2.5 sm:p-3">
              <span className="text-[13px] sm:text-sm font-bold text-[#18271E] leading-snug pr-6">{title}</span>
              <span className="text-[11px] sm:text-xs text-[#637265] leading-snug">{text}</span>
              <span className="mt-auto pt-1 text-[11px] sm:text-xs font-semibold text-[#2A4E38]">{price}</span>
            </span>

            <span
              aria-hidden="true"
              className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                active ? 'bg-[#2A4E38] text-white scale-100' : 'bg-white/90 border border-[#DCE2D8] text-transparent scale-90'
              }`}
            >
              <Check className="w-3 h-3" strokeWidth={3} />
            </span>
          </button>
        );
      })}
    </div>
  );
};
