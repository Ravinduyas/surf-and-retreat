import React from 'react';
import { Check, Flower2, Laptop, LucideIcon, Waves, Zap } from 'lucide-react';
import { BookingFormState } from '../../types';
import { getBookingOptions } from './options';
import { PickCard } from './PickCard';
import { CoworkingStep } from './CoworkingStep';
import { ExtraRequiredNote } from './ExtraRequiredNote';

export type AddonGroup = 'surf' | 'skate' | 'yoga' | 'coworking';
export type AddonField = Extract<keyof BookingFormState, 'surfId' | 'skateId' | 'yogaId' | 'coworkingId'>;

export const ADDON_FIELD: Record<AddonGroup, AddonField> = {
  surf: 'surfId',
  skate: 'skateId',
  yoga: 'yogaId',
  coworking: 'coworkingId',
};

const ADDONS: { group: AddonGroup; title: string; text: string; icon: LucideIcon }[] = [
  { group: 'surf', title: 'Surfing', text: 'Lessons, coaching and board rental', icon: Waves },
  { group: 'skate', title: 'Skating', text: 'Surfskate lessons and rental', icon: Zap },
  { group: 'yoga', title: 'Yoga', text: 'Sunrise classes and class packs', icon: Flower2 },
  { group: 'coworking', title: 'Co-working', text: 'A desk on 300 Mbps fiber by the day, week or month', icon: Laptop },
];

/** Add-ons with an open (ticked) section the guest hasn't picked an option in yet. */
export const unfinishedAddons = (open: AddonGroup[], form: Pick<BookingFormState, AddonField>) =>
  open.filter((group) => !form[ADDON_FIELD[group]]);

/** The add-ons that already have a pick, so their sections start open when the guest comes back. */
export const pickedAddons = (form: Pick<BookingFormState, AddonField>) =>
  ADDONS.map((a) => a.group).filter((group) => Boolean(form[ADDON_FIELD[group]]));

interface AddonsStepProps {
  formData: Pick<BookingFormState, AddonField>;
  /** Ticked add-ons, whose options are showing. */
  open: AddonGroup[];
  onToggle: (group: AddonGroup) => void;
  /** The guest has no bed and nothing ticked, so this is the only thing left to book. */
  required: boolean;
  onChange: (field: AddonField, id: string) => void;
}

/**
 * Add-ons screen: a tick list of surfing, skating, yoga and co-working. Ticking one opens its options
 * underneath; unticking closes it and drops whatever was picked there. Nothing ticked skips the step.
 */
export const AddonsStep: React.FC<AddonsStepProps> = ({ formData, open, onToggle, required, onChange }) => {
  return (
    <div className="space-y-3">
      {required && open.length === 0 && <ExtraRequiredNote />}

      {ADDONS.map(({ group, title, text, icon: Icon }) => {
        const ticked = open.includes(group);
        const field = ADDON_FIELD[group];
        const value = formData[field];
        return (
          <div
            key={group}
            className={`rounded-2xl border transition-colors ${
              ticked ? 'border-[#2A4E38] bg-[#F9FAF8]' : 'border-[#DCE2D8] bg-[#F9FAF8] hover:border-[#B9C8B7]'
            }`}
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={ticked}
              aria-expanded={ticked}
              onClick={() => onToggle(group)}
              className="w-full flex items-center gap-3.5 p-3.5 text-left cursor-pointer"
            >
              <span
                className={`w-6 h-6 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors ${
                  ticked ? 'bg-[#2A4E38] border-[#2A4E38] text-white' : 'bg-white border-[#B9C8B7]'
                }`}
              >
                {ticked && <Check className="w-4 h-4" />}
              </span>
              <span
                className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${
                  ticked ? 'bg-[#2A4E38] text-white' : 'bg-white text-[#2A4E38] border border-[#DCE2D8]'
                }`}
              >
                <Icon className="w-5 h-5" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-bold text-[#18271E]">{title}</span>
                <span className="block text-xs text-[#637265] mt-0.5 leading-snug">{text}</span>
              </span>
            </button>

            {ticked && (
              <div className="px-3.5 pb-3.5 pt-1 space-y-2.5">
                {!value && (
                  <p className="text-xs font-medium text-[#A0522D]" role="note">
                    Pick one, or untick {title.toLowerCase()} to skip it.
                  </p>
                )}
                {group === 'coworking' ? (
                  <CoworkingStep value={value} required={false} onChange={(id) => onChange(field, id)} />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {getBookingOptions(group).map((opt) => (
                      <PickCard
                        key={opt.id}
                        title={opt.title}
                        price={opt.price}
                        meta={opt.meta}
                        image={opt.image}
                        icon={Icon}
                        active={value === opt.id}
                        onClick={() => onChange(field, value === opt.id ? '' : opt.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
