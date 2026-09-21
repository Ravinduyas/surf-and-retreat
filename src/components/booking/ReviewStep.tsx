import React from 'react';
import {
  BedDouble,
  Waves,
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
import { getBookingOptions } from './options';
import { StepDef } from './steps';

const TAB_LABEL: Record<BookingFormState['tab'], string> = {
  stay: 'Stay',
  surf: 'Surf',
  coworking: 'Coworking',
};

const TAB_ICON: Record<BookingFormState['tab'], LucideIcon> = {
  stay: BedDouble,
  surf: Waves,
  coworking: Laptop,
};

interface ReviewStepProps {
  formData: BookingFormState;
  steps: StepDef[];
  onEdit: (stepIndex: number) => void;
}

const formatDate = (value: string) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

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
  const option = getBookingOptions(formData.tab).find((opt) => opt.id === formData.itemId);
  const room = formData.roomId ? getBookingOptions('stay').find((r) => r.id === formData.roomId) : undefined;

  const indexOf = (kind: StepDef['kind']) => Math.max(0, steps.findIndex((s) => s.kind === kind));

  return (
    <div className="rounded-2xl border border-[#DCE2D8] bg-[#F9FAF8] px-4">
      <Row
        icon={TAB_ICON[formData.tab]}
        label={TAB_LABEL[formData.tab]}
        value={option ? `${option.title} · ${option.price}` : '—'}
        onEdit={() => onEdit(indexOf('option'))}
      />
      {room && (
        <Row
          icon={BedDouble}
          label="Room"
          value={`${room.title} · ${room.price}`}
          onEdit={() => onEdit(indexOf('room'))}
        />
      )}
      <Row
        icon={Calendar}
        label="Dates"
        value={
          !formData.checkOut
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
