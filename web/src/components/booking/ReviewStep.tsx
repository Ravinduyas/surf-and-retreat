import React from 'react';
import {
  BedDouble,
  Waves,
  Zap,
  Flower2,
  Laptop,
  Calendar,
  Users,
  User,
  Mail,
  Phone,
  MessageSquare,
  Pencil,
  LucideIcon,
} from 'lucide-react';
import { BookingFormState } from '../../types';
import { findOption } from './options';
import { StepDef } from './steps';
import { hasRoom } from './validation';
import { formatDate } from './request';

interface ReviewStepProps {
  formData: BookingFormState;
  /** The flow's steps in order, so each row can jump back to the right screen. */
  steps: StepDef[];
  onEdit: (stepIndex: number) => void;
}

const Row: React.FC<{ icon: LucideIcon; label: string; value: React.ReactNode; onEdit: () => void }> = ({
  icon: Icon,
  label,
  value,
  onEdit,
}) => (
  <div className="flex items-start justify-between gap-3 py-3 border-b border-[#E5ECE2] last:border-b-0">
    <div className="flex items-start gap-3 min-w-0">
      <Icon className="w-4 h-4 text-[#2A4E38] shrink-0 mt-0.5" />
      <div className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#8B9A8D]">{label}</span>
        <span className="block text-sm text-[#18271E] font-medium mt-0.5 break-words">{value}</span>
      </div>
    </div>
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Edit ${label}`}
      className="text-[#6B796D] hover:text-[#18271E] p-1.5 -m-1.5 rounded-full hover:bg-white transition-colors cursor-pointer shrink-0"
    >
      <Pencil className="w-3.5 h-3.5" />
    </button>
  </div>
);

export const ReviewStep: React.FC<ReviewStepProps> = ({ formData, steps, onEdit }) => {
  const room = hasRoom(formData) ? findOption('stay', formData.roomId) : undefined;
  const coworking = findOption('coworking', formData.coworkingId);
  const addons = [
    { icon: Waves, label: 'Surf', option: findOption('surf', formData.surfId) },
    { icon: Zap, label: 'Skate', option: findOption('skate', formData.skateId) },
    { icon: Flower2, label: 'Yoga', option: findOption('yoga', formData.yogaId) },
  ];

  const indexOf = (kind: StepDef['kind']) => Math.max(0, steps.findIndex((s) => s.kind === kind));
  // A stay picks the desk on the add-ons screen; co-working only has its own desk screen.
  const deskStep = steps.some((s) => s.kind === 'coworking') ? indexOf('coworking') : indexOf('addons');

  return (
    <div className="rounded-2xl border border-[#DCE2D8] bg-[#F9FAF8] px-4">
      {room && (
        <Row icon={BedDouble} label="Room" value={`${room.title} · ${room.price}`} onEdit={() => onEdit(indexOf('room'))} />
      )}
      {addons.map(
        ({ icon, label, option }) =>
          option && (
            <Row
              key={label}
              icon={icon}
              label={label}
              value={`${option.title} · ${option.price}`}
              onEdit={() => onEdit(indexOf('addons'))}
            />
          ),
      )}
      {coworking && (
        <Row
          icon={Laptop}
          label="Coworking"
          value={`${coworking.title} · ${coworking.price}`}
          onEdit={() => onEdit(deskStep)}
        />
      )}
      <Row
        icon={Calendar}
        label="Dates"
        value={
          !formData.checkOut || formData.checkOut === formData.checkIn
            ? formatDate(formData.checkIn)
            : `${formatDate(formData.checkIn)} → ${formatDate(formData.checkOut)}`
        }
        onEdit={() => onEdit(indexOf('dates'))}
      />
      <Row
        icon={Users}
        label="Guests"
        value={`${formData.guests} ${formData.guests === 1 ? 'guest' : 'guests'}`}
        onEdit={() => onEdit(indexOf('guests'))}
      />
      <Row icon={User} label="Name" value={formData.name} onEdit={() => onEdit(indexOf('details'))} />
      <Row icon={Mail} label="Email" value={formData.email} onEdit={() => onEdit(indexOf('details'))} />
      {formData.phone && (
        <Row icon={Phone} label="Phone" value={formData.phone} onEdit={() => onEdit(indexOf('details'))} />
      )}
      {formData.message && (
        <Row icon={MessageSquare} label="Note" value={formData.message} onEdit={() => onEdit(indexOf('details'))} />
      )}
    </div>
  );
};
