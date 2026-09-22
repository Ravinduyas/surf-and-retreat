import React from 'react';
import { Waves } from 'lucide-react';
import { getBookingOptions } from './options';
import { PickCard } from './PickCard';
import { ExtraRequiredNote } from './ExtraRequiredNote';

interface SurfStepProps {
  value: string;
  /** The guest has no bed and no other extra, so this is the only thing left to book. */
  required: boolean;
  onChange: (id: string) => void;
}

/** Surf screen: pick a lesson package. Tapping a selected card again removes it, so leaving it empty skips the step. */
export const SurfStep: React.FC<SurfStepProps> = ({ value, required, onChange }) => (
  <div className="space-y-4">
    {required && !value && <ExtraRequiredNote />}

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {getBookingOptions('surf').map((opt) => (
        <PickCard
          key={opt.id}
          title={opt.title}
          price={opt.price}
          meta={opt.meta}
          image={opt.image}
          icon={Waves}
          active={value === opt.id}
          onClick={() => onChange(value === opt.id ? '' : opt.id)}
        />
      ))}
    </div>
  </div>
);
