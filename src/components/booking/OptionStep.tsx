import React from 'react';
import { Ban } from 'lucide-react';
import { getBookingOptions } from './options';
import { NO_ROOM, roomFitsGuests } from './validation';
import { PickCard } from './PickCard';

interface OptionStepProps {
  guests: number;
  /** Nights between the chosen dates; 0 means a single-day visit, which can't include a bed. */
  nights: number;
  value: string;
  onSelect: (id: string) => void;
}

/** Room step: pick a bed, or say you only want lessons or a desk. */
export const OptionStep: React.FC<OptionStepProps> = ({ guests, nights, value, onSelect }) => (
  <div className="space-y-3">
    {nights < 1 && (
      <p className="text-xs font-medium text-[#A0522D]" role="note">
        Your dates are a single day, so beds are unavailable. Go back to Dates to add a night, or continue without a bed.
      </p>
    )}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {getBookingOptions('stay').map((room) => {
        const fits = roomFitsGuests(room, guests);
        return (
          <PickCard
            key={room.id}
            title={room.title}
            price={room.price}
            meta={room.meta}
            image={room.image}
            active={value === room.id}
            disabled={!fits || nights < 1}
            disabledReason={!fits ? `Sleeps ${room.maxGuests} max — too small for ${guests} guests` : 'Needs at least one night'}
            onClick={() => onSelect(room.id)}
          />
        );
      })}
      <PickCard
        title="No bed needed"
        meta="I only want surf lessons or a coworking desk"
        icon={Ban}
        active={value === NO_ROOM}
        onClick={() => onSelect(NO_ROOM)}
      />
    </div>
  </div>
);
