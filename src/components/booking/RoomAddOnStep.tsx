import React from 'react';
import { getBookingOptions } from './options';
import { roomFitsGuests } from './validation';
import { PickCard } from './PickCard';

interface RoomAddOnStepProps {
  guests: number;
  value: string;
  onSelect: (id: string) => void;
}

/** No explicit "skip" card — leaving every room unselected already skips the add-on. */
export const RoomAddOnStep: React.FC<RoomAddOnStepProps> = ({ guests, value, onSelect }) => (
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
        onClick={() => onSelect(value === room.id ? '' : room.id)}
      />
    ))}
  </div>
);
