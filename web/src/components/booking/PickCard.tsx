import React from 'react';
import { Check, LucideIcon } from 'lucide-react';
import { Photo } from '../ui/Photo';

interface PickCardProps {
  title: string;
  meta: string;
  price?: string;
  image?: string;
  icon?: LucideIcon;
  active: boolean;
  onClick: () => void;
  /** Greyed out and unselectable; `disabledReason` replaces the meta line. */
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * Phones: a compact row (thumbnail left, text wraps beside it).
 * Tablet and up: a tile in a 2-column grid with a large photo on top.
 */
export const PickCard: React.FC<PickCardProps> = ({
  title,
  meta,
  price,
  image,
  icon: Icon,
  active,
  onClick,
  disabled = false,
  disabledReason,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={active}
    className={`relative w-full flex ${image ? 'flex-row sm:flex-col items-stretch gap-3.5 sm:gap-0 p-2.5 sm:p-2' : 'flex-row items-center gap-3.5 p-2.5'} rounded-2xl border text-left transition-all ${
      disabled
        ? 'bg-[#F9FAF8] border-[#E5ECE2] opacity-55 cursor-not-allowed'
        : active
          ? 'bg-[#F2F6F0] border-[#2A4E38] ring-1 ring-[#2A4E38] cursor-pointer'
          : 'bg-[#F9FAF8] border-[#DCE2D8] hover:bg-white hover:border-[#B9C8B7] cursor-pointer'
    }`}
  >
    {image ? (
      <span className="w-24 h-24 sm:w-full sm:h-auto sm:aspect-[16/10] rounded-xl overflow-hidden shrink-0 bg-[#EBF0E8]">
        <Photo
          src={image}
          alt={title}
          sizes="(min-width: 640px) 300px, 96px"
          className="w-full h-full object-cover"
        />
      </span>
    ) : (
      <span
        className={`w-14 h-14 rounded-xl shrink-0 flex items-center justify-center ${
          active ? 'bg-[#2A4E38] text-white' : 'bg-white text-[#2A4E38] border border-[#DCE2D8]'
        }`}
      >
        {Icon && <Icon className="w-7 h-7" />}
      </span>
    )}

    <span className={`flex-1 min-w-0 flex flex-col justify-center ${image ? 'sm:px-1.5 sm:pt-2.5 sm:pb-1' : ''}`}>
      <span className="text-sm sm:text-[15px] font-bold text-[#18271E] leading-snug pr-6">{title}</span>
      {price && <span className="text-xs font-semibold text-[#2A4E38] mt-0.5">{price}</span>}
      <span
        className={`text-xs mt-1 leading-snug ${disabled && disabledReason ? 'text-[#A0522D] font-medium' : 'text-[#637265]'}`}
      >
        {disabled && disabledReason ? disabledReason : meta}
      </span>
    </span>

    {active && (
      <span className={`absolute top-2.5 right-2.5 ${image ? "sm:top-3.5 sm:right-3.5" : ""} w-6 h-6 rounded-full bg-[#2A4E38] text-white flex items-center justify-center shadow-xs`}>
        <Check className="w-3.5 h-3.5" />
      </span>
    )}
  </button>
);
