import { CONTACT_INFO } from '../../data';
import { BookingFormState } from '../../types';
import { getBookingOptions } from './options';
import { hasRoom } from './validation';

export const formatDate = (value: string) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

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
 * guest's own WhatsApp or email, addressed to the hostel, with everything they chose already written out.
 */
export const buildBookingRequest = (form: BookingFormState): BookingRequest => {
  const room = hasRoom(form) ? getBookingOptions('stay').find((o) => o.id === form.roomId) : undefined;
  const surf = getBookingOptions('surf').find((o) => o.id === form.surfId);
  const coworking = getBookingOptions('coworking').find((o) => o.id === form.coworkingId);

  const dates = form.checkOut ? `${formatDate(form.checkIn)} to ${formatDate(form.checkOut)}` : formatDate(form.checkIn);
  const guests = `${form.guests} ${form.guests === 1 ? 'guest' : 'guests'}`;

  const lines = [
    "Hi Surf & Retreat! I'd like to book:",
    '',
    room && `- Room: ${room.title} (${room.price})`,
    surf && `- Surf: ${surf.title} (${surf.price})`,
    coworking && `- Coworking: ${coworking.title} (${coworking.price})`,
    `- Dates: ${dates}`,
    `- Guests: ${guests}`,
    '',
    `Name: ${form.name.trim()}`,
    `Email: ${form.email.trim()}`,
    form.phone.trim() && `Phone: ${form.phone.trim()}`,
    form.message.trim() && `Note: ${form.message.trim()}`,
    '',
    'Sent from the website booking form.',
  ].filter((line): line is string => typeof line === 'string');

  const text = lines.join('\n');
  const phoneDigits = CONTACT_INFO.phone.replace(/\D/g, '');
  const subject = `Booking request: ${[room?.title, surf?.title, coworking?.title].filter(Boolean).join(' + ')} · ${dates}`;

  return {
    text,
    whatsappHref: `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`,
    mailtoHref: `mailto:${CONTACT_INFO.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`,
  };
};
