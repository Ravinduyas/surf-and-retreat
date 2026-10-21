import React from 'react';
import { Pencil } from 'lucide-react';
import { BookingFormState } from '../../types';
import { CountryPicker } from './CountryPicker';
import { isValidEmail } from './validation';

type ContactField = 'name' | 'email' | 'country' | 'phoneCountry' | 'phone' | 'message';

export interface SummaryItem {
  label: string;
  value: string;
  onEdit: () => void;
}

interface SendStepProps {
  form: Pick<BookingFormState, ContactField>;
  /** The stay so far, each part with a way back to its step. */
  summary: SummaryItem[];
  onChange: (field: ContactField, value: string) => void;
}

const label = 'block text-[10px] font-bold uppercase tracking-[0.14em] text-[#637265] mb-1';
const field =
  'w-full h-11 bg-[#FAFBF9] border border-[#DCE2D8] rounded-xl px-3.5 text-base sm:text-sm text-[#18271E] placeholder:text-[#A7B3A6] transition-colors hover:border-[#B9C8B7] focus:bg-white focus:border-[#2A4E38] focus:outline-hidden focus:ring-4 focus:ring-[#2A4E38]/10';
const bad = 'border-[#C0522D] focus:border-[#C0522D] focus:ring-[#C0522D]/10';

/** The stay at a glance with edit links, then contact details: a name, an email, a country and a phone. */
export const SendStep: React.FC<SendStepProps> = ({ form, summary, onChange }) => {
  const badEmail = Boolean(form.email) && !isValidEmail(form.email);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {summary.map((item) => (
          <div key={item.label} className="flex items-start justify-between gap-2 rounded-2xl bg-[#F4F7F1] px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7FA35B]">{item.label}</p>
              <p className="text-[13px] font-semibold text-[#18271E] mt-0.5 leading-snug">{item.value}</p>
            </div>
            <button
              type="button"
              onClick={item.onEdit}
              aria-label={`Change ${item.label.toLowerCase()}`}
              className="shrink-0 w-7 h-7 rounded-full text-[#637265] hover:text-[#18271E] hover:bg-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2A4E38]">Your details</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className={label}>Your name</span>
            <input className={field} type="text" autoComplete="name" placeholder="Jane Doe" value={form.name} onChange={(e) => onChange('name', e.target.value)} />
          </label>
          <label className="block">
            <span className={label}>Email</span>
            <input
              className={`${field} ${badEmail ? bad : ''}`}
              type="email"
              autoComplete="email"
              placeholder="jane@example.com"
              value={form.email}
              onChange={(e) => onChange('email', e.target.value)}
            />
            {badEmail && <span className="block text-xs font-medium text-[#A0522D] mt-1">Enter a valid email address.</span>}
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className={label}>Country</span>
            <CountryPicker
              mode="country"
              value={form.country}
              placeholder="Select country"
              onChange={(iso) => {
                // The phone code follows the country; the guest can still change the code on its own afterwards.
                onChange('country', iso);
                onChange('phoneCountry', iso);
              }}
            />
          </div>
          <div>
            <span className={label}>Phone / WhatsApp</span>
          <div className="flex gap-2">
            <CountryPicker mode="code" value={form.phoneCountry} placeholder="Code" className="w-[124px] shrink-0" onChange={(iso) => onChange('phoneCountry', iso)} />
            <input
              className={field}
              type="tel"
              autoComplete="tel-national"
              placeholder="712345678"
              aria-label="Phone number"
              value={form.phone}
              onChange={(e) => onChange('phone', e.target.value)}
              />
            </div>
          </div>
        </div>

        <label className="block">
          <span className={label}>
            Anything else <span className="normal-case tracking-normal font-normal text-[#8B9A8D]">(optional)</span>
          </span>
          <textarea
            className={`${field} h-auto py-2.5 resize-none`}
            rows={2}
            value={form.message}
            onChange={(e) => onChange('message', e.target.value)}
            placeholder="Arrival time, dietary needs, airport pickup..."
          />
        </label>
      </div>
    </div>
  );
};
