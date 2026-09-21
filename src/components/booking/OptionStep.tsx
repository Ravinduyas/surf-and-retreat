import React from 'react';
import { Ban } from 'lucide-react';
import { getBookingOptions } from './options';
import { NO_ROOM, roomFitsGuests } from './validation';
import { PickCard } from './PickCard';

interface OptionStepProps {
  guests: number;
  value: string;
  onSelect: (id: string) => void;
}

/** Room step: pick a bed, or say you only want lessons or a desk. */
export const OptionStep: React.FC<OptionStepProps> = ({ guests, value, onSelect }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {getBookingOptions('stay').map((room) => (
      <PickCard
        key={room.id}
        title={room.title}
        price={room.price}
        meta={room.meta}
        image={room.image}
        active={value === room.id}
        disabled={!roomFitsGuests(room, guests)}
        disabledReason={`Sleeps ${room.maxGuests} max — too small for ${guests} guests`}
        onClick={() => onSelect(room.id)}
      />
    ))}
    <PickCard
      title="No bed needed"
      meta="I only want surf lessons or a coworking desk"
      icon={Ban}
      active={value === NO_ROOM}
      onClick={() => onSelect(NO_ROOM)}
    />
  </div>
);
