import React from 'react';
import { Laptop, LucideIcon, Waves } from 'lucide-react';
import { BookingTab } from '../../types';
import { getBookingOptions } from './options';
import { PickCard } from './PickCard';

interface ExtrasStepProps {
  surfId: string;
  coworkingId: string;
  /** The guest has no bed, so at least one extra is needed to have a booking at all. */
  required: boolean;
  /** Which extra to list first (e.g. the guest came from a "Desk Pass" link). */
  first?: 'surf' | 'coworking';
  onSurf: (id: string) => void;
  onCoworking: (id: string) => void;
}

type ExtraTab = Extract<BookingTab, 'surf' | 'coworking'>;

const SECTIONS: Record<ExtraTab, { title: string; hint: string; icon: LucideIcon }> = {
  surf: { title: 'Surf lessons', hint: 'Lessons and coaching on Weligama Bay.', icon: Waves },
  coworking: { title: 'Coworking desk', hint: 'A desk on 300 Mbps fiber, by the day, week or month.', icon: Laptop },
};

/** Tapping a selected card again removes it, so leaving both empty just skips the step. */
export const ExtrasStep: React.FC<ExtrasStepProps> = ({ surfId, coworkingId, required, first, onSurf, onCoworking }) => {
  const order: ExtraTab[] = first === 'coworking' ? ['coworking', 'surf'] : ['surf', 'coworking'];
  const selected: Record<ExtraTab, string> = { surf: surfId, coworking: coworkingId };
  const change: Record<ExtraTab, (id: string) => void> = { surf: onSurf, coworking: onCoworking };

  return (
    <div className="space-y-6">
      {required && (
        <p className="text-xs font-medium text-[#A0522D]" role="note">
          You chose no bed, so pick at least one of these.
        </p>
      )}
      {order.map((tab) => {
        const { title, hint, icon: Icon } = SECTIONS[tab];
        return (
          <section key={tab} aria-label={title}>
            <div className="mb-2.5">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-[#2A4E38] shrink-0" />
                <h4 className="text-sm font-bold text-[#18271E]">{title}</h4>
              </div>
              <p className="text-xs text-[#637265] mt-0.5 pl-6">{hint}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {getBookingOptions(tab).map((opt) => (
                <PickCard
                  key={opt.id}
                  title={opt.title}
                  price={opt.price}
                  meta={opt.meta}
                  image={opt.image}
                  icon={tab === 'coworking' ? Laptop : Waves}
                  active={selected[tab] === opt.id}
                  onClick={() => change[tab](selected[tab] === opt.id ? '' : opt.id)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};
