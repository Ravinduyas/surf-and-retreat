import React from 'react';
import { Laptop } from 'lucide-react';
import { BookingTab } from '../../types';
import { getBookingOptions } from './options';
import { roomFitsGuests } from './validation';
import { PickCard } from './PickCard';

interface OptionStepProps {
  tab: BookingTab;
  guests: number;
  value: string;
  onSelect: (id: string) => void;
}

export const OptionStep: React.FC<OptionStepProps> = ({ tab, guests, value, onSelect }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {getBookingOptions(tab).map((opt) => {
      const fits = roomFitsGuests(opt, guests);
      return (
        <PickCard
          key={opt.id}
          title={opt.title}
          price={opt.price}
          meta={opt.meta}
          image={opt.image}
          icon={Laptop}
          active={value === opt.id}
          disabled={!fits}
          disabledReason={`Sleeps ${opt.maxGuests} max — too small for ${guests} guests`}
          onClick={() => onSelect(opt.id)}
        />
      );
    })}
  </div>
);
