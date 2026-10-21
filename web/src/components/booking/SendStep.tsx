import React from 'react';
import { BookingFormState } from '../../types';
import { isValidEmail } from './validation';

/** Where most guests come from, each with its dialling code. Picking a country fills in the code. */
const COUNTRIES: [name: string, code: string][] = [
  ['Germany', '+49'],
  ['United Kingdom', '+44'],
  ['Netherlands', '+31'],
  ['France', '+33'],
  ['Switzerland', '+41'],
  ['Austria', '+43'],
  ['Belgium', '+32'],
  ['Sweden', '+46'],
  ['Denmark', '+45'],
  ['Norway', '+47'],
  ['Finland', '+358'],
  ['Spain', '+34'],
  ['Italy', '+39'],
  ['Portugal', '+351'],
  ['Ireland', '+353'],
  ['Poland', '+48'],
  ['Czechia', '+420'],
  ['United States', '+1'],
  ['Canada', '+1'],
  ['Australia', '+61'],
  ['New Zealand', '+64'],
  ['Sri Lanka', '+94'],
  ['India', '+91'],
  ['Israel', '+972'],
  ['Russia', '+7'],
  ['South Africa', '+27'],
  ['Brazil', '+55'],
  ['Japan', '+81'],
  ['Other', ''],
];

const CODES = [...new Set(COUNTRIES.map(([, code]) => code).filter(Boolean))];

type ContactField = 'name' | 'email' | 'emailConfirm' | 'country' | 'dialCode' | 'phone' | 'message';

interface SendStepProps {
  form: Pick<BookingFormState, ContactField>;
  onChange: (field: ContactField, value: string) => void;
}

const label = 'block text-[10px] font-bold uppercase tracking-[0.14em] text-[#8B9A8D] mb-1.5';
const field =
  'w-full bg-white border border-[#DCE2D8] rounded-xl px-3.5 py-3 text-base sm:text-sm text-[#18271E] focus:outline-hidden focus:ring-2 focus:ring-[#2C573A]/20';

/** Contact details, checked before the request can go: a name, matching emails, a country and a phone. */
export const SendStep: React.FC<SendStepProps> = ({ form, onChange }) => {
  const badEmail = Boolean(form.email) && !isValidEmail(form.email);
  const mismatch = Boolean(form.emailConfirm) && form.emailConfirm.trim().toLowerCase() !== form.email.trim().toLowerCase();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className={label}>Your name</span>
          <input className={field} type="text" autoComplete="name" value={form.name} onChange={(e) => onChange('name', e.target.value)} />
        </label>
        <label className="block">
          <span className={label}>Email</span>
          <input
            className={`${field} ${badEmail ? 'border-[#C0522D]' : ''}`}
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => onChange('email', e.target.value)}
          />
        </label>
      </div>

      <label className="block">
        <span className={label}>Confirm email</span>
        <input
          className={`${field} ${mismatch ? 'border-[#C0522D]' : ''}`}
          type="email"
          autoComplete="email"
          value={form.emailConfirm}
          onChange={(e) => onChange('emailConfirm', e.target.value)}
        />
        {mismatch && <span className="block text-xs font-medium text-[#A0522D] mt-1">The two emails don&apos;t match.</span>}
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <label className="block col-span-2 sm:col-span-1">
          <span className={label}>Country</span>
          <select
            className={`${field} cursor-pointer`}
            autoComplete="country-name"
            value={form.country}
            onChange={(e) => {
              onChange('country', e.target.value);
              const code = COUNTRIES.find(([name]) => name === e.target.value)?.[1];
              if (code) onChange('dialCode', code);
            }}
          >
            <option value="">Select country</option>
            {COUNTRIES.map(([name]) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>Code</span>
          <select className={`${field} cursor-pointer`} value={form.dialCode} onChange={(e) => onChange('dialCode', e.target.value)}>
            <option value="">Code</option>
            {CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>Phone</span>
          <input
            className={field}
            type="tel"
            autoComplete="tel-national"
            placeholder="712345678"
            value={form.phone}
            onChange={(e) => onChange('phone', e.target.value)}
          />
        </label>
      </div>

      <label className="block">
        <span className={label}>Anything else</span>
        <textarea
          className={`${field} resize-none`}
          rows={3}
          value={form.message}
          onChange={(e) => onChange('message', e.target.value)}
          placeholder="Arrival time, dietary needs, airport pickup..."
        />
        <span className="block text-xs text-[#8B9A8D] mt-1">Optional</span>
      </label>
    </div>
  );
};
