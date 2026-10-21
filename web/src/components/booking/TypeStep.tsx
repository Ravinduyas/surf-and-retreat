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
    <div role="radiogroup" aria-label="What are you booking" className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
      {TYPES.map(({ type, title, text, icon: Icon, image, price }) => {
        const active = value === type;
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(type)}
            className={`group relative flex sm:flex-col text-left rounded-[22px] border bg-white overflow-hidden transition-all duration-300 cursor-pointer ${
              active
                ? 'border-[#2A4E38] ring-2 ring-[#2A4E38] shadow-[0_16px_40px_-24px_rgba(42,78,56,0.7)]'
                : 'border-[#DCE2D8] hover:border-[#9DB09A] hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-28px_rgba(24,39,30,0.45)]'
            }`}
          >
            <span className="relative w-24 sm:w-full shrink-0 sm:aspect-[16/9] overflow-hidden bg-[#EBF0E8]">
              <Photo
                src={image}
                alt=""
                sizes="(min-width: 640px) 260px, 112px"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
              <span className="hidden sm:flex absolute left-3 bottom-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur text-[#2A4E38] items-center justify-center">
                <Icon className="w-4 h-4" />
              </span>
            </span>

            <span className="flex-1 min-w-0 flex flex-col gap-1 p-3">
              <span className="text-sm font-bold text-[#18271E] leading-snug pr-7">{title}</span>
              <span className="text-xs text-[#637265] leading-snug">{text}</span>
              <span className="mt-auto pt-1.5 text-xs font-semibold text-[#2A4E38]">{price}</span>
            </span>

            <span
              aria-hidden="true"
              className={`absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                active ? 'bg-[#2A4E38] text-white scale-100' : 'bg-white/90 border border-[#DCE2D8] text-transparent scale-90'
              }`}
            >
              <Check className="w-3.5 h-3.5" strokeWidth={3} />
            </span>
          </button>
        );
      })}
    </div>
  );
};
