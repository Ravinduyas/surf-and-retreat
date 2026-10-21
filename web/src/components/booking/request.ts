import { CONTACT_INFO } from '../../data';
import { BookingFormState } from '../../types';
import { formatMoney } from '../../pms';
import { countryName, dialCode } from './countries';
import { findSurf } from './options';
import { buildQuote, travellerRooms, travellerSurf } from './quote';

export const formatDate = (value: string) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '-';

export interface BookingRequest {
  /** Plain-text summary of the booking, ready to paste into a chat or email. */
  text: string;
  /** Opens a WhatsApp chat with the hostel, message prefilled. Works on phones and WhatsApp Web. */
  whatsappHref: string;
  /** Opens the guest's mail app with the request prefilled, for people without WhatsApp. */
  mailtoHref: string;
}

/**
 * The site is static, so there is no server to post the form to. Instead the request is handed to the
 * guest's own WhatsApp or email, addressed to the hostel, with the whole quote already written out.
 */
export const buildBookingRequest = (form: BookingFormState): BookingRequest => {
  const { lines, total } = buildQuote(form);
  const dates = `${formatDate(form.checkIn)} to ${formatDate(form.checkOut)}`;
  const rooms = travellerRooms(form);

  const surfLines =
    form.type === 'surf'
      ? Array.from({ length: form.guests }, (_, i) => {
          const pick = travellerSurf(form, i);
          const pkg = findSurf(pick.packageId);
          return `  Traveller ${i + 1}${rooms[i] ? ` (${rooms[i]})` : ''}: ${pkg ? `${pkg.title}, ${pick.level}` : 'no surf'}`;
        })
      : [];

  const text = [
    "Hi Surf & Retreat! I'd like to book:",
    '',
    `- Dates: ${dates}`,
    `- Guests: ${form.guests}`,
    ...lines.map(
      (line) =>
        `- ${line.title} (${line.detail}): ${line.amount === null ? (line.note ?? 'priced at the desk') : formatMoney(line.amount)}`,
    ),
    ...(surfLines.length ? ['- Surf per traveller:', ...surfLines] : []),
    `- Estimated total: ${formatMoney(total)}`,
    '',
    `Name: ${form.name.trim()}`,
    `Email: ${form.email.trim()}`,
    `Country: ${countryName(form.country)}`,
    `Phone: ${dialCode(form.phoneCountry)} ${form.phone.trim()}`,
    form.message.trim() ? `Note: ${form.message.trim()}` : null,
    '',
    'Sent from the website booking form.',
  ]
    .filter((line): line is string => typeof line === 'string')
    .join('\n');

  const phone = CONTACT_INFO.phone.replace(/\D/g, '');
  const subject = `Booking request · ${dates} · ${form.guests} ${form.guests === 1 ? 'guest' : 'guests'}`;

  return {
    text,
    whatsappHref: `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
    mailtoHref: `mailto:${CONTACT_INFO.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`,
  };
};
