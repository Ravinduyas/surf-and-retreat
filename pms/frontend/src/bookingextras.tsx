// What a guest bought on the website, written out for the people who have to
// deliver it.
//
// The booking engine records the extras as short tags on the reservation —
// `model:rooms-surf`, `airportPickup:UL309|2026-09-20|14:30` — because that is
// also the shape a report or a search can group on. Nobody at a desk should
// have to decode them: the driver needs a flight number and a time, the surf
// school needs who is a beginner, and both of them are reading a screen with a
// guest standing in front of them. So the tags are spelled out here, in one
// place, for every screen that shows a booking.
import { longDate } from './format';
import { BOOKING_MODEL_LABELS, type BookingModel } from './types';

const SURF_PACKAGE_NAMES: Record<string, string> = {
  moderate: 'Moderate Surf',
  full: 'Full Surf',
  'surf-yoga': 'Surf & Yoga',
};
const SURF_LEVEL_NAMES: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};
const DESK_NAMES: Record<string, string> = { normal: 'Standard desk', office: 'Private office' };

/** "AB123|2026-09-10|14:30" → "AB123 · 10 Sep 2026 · 14:30". */
function flightDetail(raw: string): string {
  const [number, date, time] = raw.split('|');
  const parts = [
    number ? `Flight ${number}` : null,
    date ? longDate(date) : null,
    time || null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Requested — no flight details given';
}

/** One traveller's line in the surf table. */
export interface SurfTraveller { who: string; package: string; level: string }

export interface Extra {
  label: string;
  value: string;
  /**
   * The surf party, when there is one. A booking for four is four people with
   * four different levels, and reading that off one run-on line is how the
   * wrong person ends up in the advanced group — so it is given a table of its
   * own, across the full width, rather than a value squeezed into half of it.
   */
  travellers?: SurfTraveller[];
}

export function describePreference(tag: string): Extra {
  const at = tag.indexOf(':');
  const key = at === -1 ? tag : tag.slice(0, at);
  const rest = at === -1 ? '' : tag.slice(at + 1);
  switch (key) {
    case 'model':
      return {
        label: 'Booking type',
        value: BOOKING_MODEL_LABELS[rest as BookingModel] ?? rest,
      };
    case 'airportPickup':
      return { label: 'Airport pickup', value: flightDetail(rest) };
    case 'airportDrop':
      return { label: 'Airport drop-off', value: flightDetail(rest) };
    // How the site wrote a pickup before it carried the flight with it.
    case 'addon':
      return rest === 'airportPickup'
        ? { label: 'Airport pickup', value: 'Requested — no flight details given' }
        : rest === 'airportDrop'
          ? { label: 'Airport drop-off', value: 'Requested — no flight details given' }
          : { label: 'Extra', value: rest };
    case 'surf': {
      const travellers = rest.split(',').filter(Boolean).map((entry, i) => {
        const [pkg, level, name] = entry.split('/');
        return {
          who: name?.trim() || `Person ${i + 1}`,
          package: SURF_PACKAGE_NAMES[pkg] ?? pkg,
          level: SURF_LEVEL_NAMES[level] ?? level,
        };
      });
      return {
        label: 'Surf packages',
        // The one-line form is the fallback for anywhere a table cannot go.
        value: travellers.map((t) => `${t.who}: ${t.package} · ${t.level}`).join(' · ') || rest,
        travellers: travellers.length ? travellers : undefined,
      };
    }
    case 'surfDate':
      return { label: 'Surf starts', value: longDate(rest) };
    case 'surfGuests':
      return { label: 'Surf lessons', value: `${rest} guest${rest === '1' ? '' : 's'}` };
    case 'coworking': {
      const [seats, kind] = rest.split('x');
      return {
        label: 'Coworking',
        value: `${seats} × ${(DESK_NAMES[kind] ?? kind ?? '').toLowerCase() || 'desk'}`,
      };
    }
    case 'party':
      return { label: 'Party', value: `${rest} beds booked together` };
    default:
      return { label: 'Booking note', value: tag };
  }
}

/**
 * The block itself. One labelled row per tag — nothing is hidden, including a
 * tag this build does not recognise, which is shown as it was written.
 */
export function BookingExtras({ preferences, className = '' }: {
  preferences: string[];
  className?: string;
}) {
  if (!preferences.length) return null;
  return (
    <div className={`rounded-xl bg-dash-bg p-3 ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-2">
        What they booked online
      </p>
      <div className="grid md:grid-cols-2 gap-x-6 gap-y-3">
        {preferences.map((tag) => {
          const d = describePreference(tag);
          // A party takes the whole row: one line per person, headed, so four
          // travellers read as four travellers.
          if (d.travellers) {
            return (
              <div key={tag} className="md:col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1">{d.label}</p>
                <div className="overflow-x-auto scroll-thin">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                        <th className="pb-1.5 w-8">#</th>
                        <th className="pb-1.5">Guest</th>
                        <th className="pb-1.5">Package</th>
                        <th className="pb-1.5">Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.travellers.map((t, i) => (
                        <tr key={`${t.who}-${i}`} className="border-b border-black/[0.03] last:border-0">
                          <td className="py-1.5 text-dash-muted tabular-nums">{i + 1}</td>
                          <td className="py-1.5 font-semibold">{t.who}</td>
                          <td className="py-1.5">{t.package}</td>
                          <td className="py-1.5">{t.level}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }
          return (
            <div key={tag}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-0.5">{d.label}</p>
              <p className="text-[13px] font-semibold">{d.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
