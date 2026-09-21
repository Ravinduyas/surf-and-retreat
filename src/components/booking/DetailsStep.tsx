import React from 'react';
import { BookingFormState } from '../../types';
import { isValidEmail } from './validation';

type DetailsFields = Pick<BookingFormState, 'name' | 'email' | 'phone' | 'message'>;

interface DetailsStepProps {
  formData: DetailsFields;
  onChange: (field: keyof DetailsFields, value: string) => void;
}

export const DetailsStep: React.FC<DetailsStepProps> = ({ formData, onChange }) => (
  <div className="space-y-4">
    <div>
      <label className="block text-xs font-semibold text-[#18271E] mb-1">Your Full Name</label>
      <input
        type="text"
        required
        value={formData.name}
        onChange={(e) => onChange('name', e.target.value)}
        placeholder="Jane Doe"
        className="w-full bg-[#F9FAF8] border border-[#DCE2D8] rounded-xl px-3.5 py-3 sm:py-2.5 text-base sm:text-sm text-[#18271E] focus:outline-hidden focus:ring-2 focus:ring-[#2C573A]/20"
      />
    </div>

    <div>
      <label className="block text-xs font-semibold text-[#18271E] mb-1">Email Address</label>
      <input
        type="email"
        required
        value={formData.email}
        onChange={(e) => onChange('email', e.target.value)}
        placeholder="jane@example.com"
        className={`w-full bg-[#F9FAF8] border rounded-xl px-3.5 py-3 sm:py-2.5 text-base sm:text-sm text-[#18271E] focus:outline-hidden focus:ring-2 focus:ring-[#2C573A]/20 ${
          formData.email && !isValidEmail(formData.email) ? 'border-[#C0522D]' : 'border-[#DCE2D8]'
        }`}
      />
      {formData.email && !isValidEmail(formData.email) && (
        <p className="text-xs font-medium text-[#A0522D] mt-1" role="alert">
          Enter a valid email address.
        </p>
      )}
    </div>

    <div>
      <label className="block text-xs font-semibold text-[#18271E] mb-1">Phone (optional)</label>
      <input
        type="tel"
        value={formData.phone}
        onChange={(e) => onChange('phone', e.target.value)}
        placeholder="+94 71 234 5678"
        className="w-full bg-[#F9FAF8] border border-[#DCE2D8] rounded-xl px-3.5 py-3 sm:py-2.5 text-base sm:text-sm text-[#18271E] focus:outline-hidden focus:ring-2 focus:ring-[#2C573A]/20"
      />
    </div>

    <div>
      <label className="block text-xs font-semibold text-[#18271E] mb-1">Anything Else?</label>
      <textarea
        rows={3}
        value={formData.message}
        onChange={(e) => onChange('message', e.target.value)}
        placeholder="Group size, dietary needs, airport pickup..."
        className="w-full bg-[#F9FAF8] border border-[#DCE2D8] rounded-xl px-3.5 py-3 sm:py-2.5 text-base sm:text-sm text-[#18271E] focus:outline-hidden focus:ring-2 focus:ring-[#2C573A]/20 resize-none"
      />
    </div>
  </div>
);
