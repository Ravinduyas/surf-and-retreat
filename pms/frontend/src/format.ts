// Display formatting. The API speaks in integer minor units and basis points;
// everything the user reads goes through here so money is never rendered from
// a float and a percentage is never off by two decimal places.

let currentCurrency = 'USD';
let currentLocale = 'en';

export function setMoneyContext(currency: string, locale = 'en') {
  currentCurrency = currency || 'USD';
  currentLocale = locale || 'en';
}

export function getCurrency() {
  return currentCurrency;
}

const formatterCache = new Map<string, Intl.NumberFormat>();
function formatter(currency: string, locale: string, decimals: boolean): Intl.NumberFormat {
  const key = `${currency}|${locale}|${decimals}`;
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
    });
    formatterCache.set(key, f);
  }
  return f;
}

/** 28500 → "$285.00" */
export function money(minor: number | null | undefined, opts: { currency?: string; decimals?: boolean } = {}): string {
  const value = (minor ?? 0) / 100;
  try {
    return formatter(opts.currency ?? currentCurrency, currentLocale, opts.decimals ?? true).format(value);
  } catch {
    return `${(opts.currency ?? currentCurrency)} ${value.toFixed(2)}`;
  }
}

/**
 * 28500 → "$285", but 550 → "$5.50" — dense, without lying.
 *
 * Cents are noise on a $285 room and they are the whole story on a $5.50 dorm
 * bed. Dropping them unconditionally rounded a hostel's rate grid to the
 * nearest dollar, so a bed priced at 5.50 was displayed as "$6" — which read as
 * a nine percent disagreement with the same rate shown on the OTA, and sent
 * somebody looking for a sync fault that did not exist.
 *
 * So: hide them when they are zero, show them when they are not.
 */
export function moneyShort(minor: number | null | undefined, currency?: string): string {
  const hasCents = Math.abs((minor ?? 0) % 100) !== 0;
  return money(minor, { currency, decimals: hasCents });
}

/** Parse "285.50" or "285,50" from an input into 28550 minor units. */
export function toMinor(input: string | number): number {
  if (typeof input === 'number') return Math.round(input * 100);
  const cleaned = String(input).replace(/[^0-9.,-]/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Minor units → editable decimal string. */
export function fromMinor(minor: number | null | undefined): string {
  return ((minor ?? 0) / 100).toFixed(2);
}

/** 1850 basis points → "18.5%" */
export function pct(bp: number | null | undefined, decimals = 1): string {
  return `${((bp ?? 0) / 100).toFixed(decimals)}%`;
}

/** 1850 basis points → 18.5 */
export function bpToPercent(bp: number | null | undefined): number {
  return Math.round((bp ?? 0)) / 100;
}

export function percentToBp(percent: number | string): number {
  const n = typeof percent === 'string' ? Number(percent) : percent;
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// ─── Dates ───────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** '2026-06-04' → 'Thu 4 Jun' */
export function shortDate(date?: string | null): string {
  if (!date) return '—';
  const d = parseDate(date);
  if (Number.isNaN(d.getTime())) return date;
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** '2026-06-04' → '4 Jun 2026' */
export function longDate(date?: string | null): string {
  if (!date) return '—';
  const d = parseDate(date);
  if (Number.isNaN(d.getTime())) return date;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function dayNumber(date: string): number {
  return parseDate(date).getUTCDate();
}

export function dayName(date: string): string {
  return DAYS[parseDate(date).getUTCDay()];
}

export function monthName(date: string): string {
  return MONTHS[parseDate(date).getUTCMonth()];
}

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * The month written out, for a heading rather than a column.
 *
 * "Jan" is right in a 46-pixel date cell and wrong in the band above it, where
 * the whole point is to tell someone scrolled five months out where they are.
 */
export function monthLongName(date: string): string {
  return MONTHS_LONG[parseDate(date).getUTCMonth()];
}

export function isWeekend(date: string): boolean {
  const d = parseDate(date).getUTCDay();
  return d === 0 || d === 6;
}

export function addDays(date: string, days: number): string {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function nightsBetween(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000);
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  let guard = 0;
  while (cur < to && guard++ < 800) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** ISO timestamp → '14:21' */
export function clock(ts?: string | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toTimeString().slice(0, 5);
}

/** ISO timestamp → '4 Jun, 14:21' */
export function timestamp(ts?: string | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${d.toTimeString().slice(0, 5)}`;
}

/** ISO timestamp → 'just now' / '4m ago' / '2h ago' / '3 Jun' */
export function relativeTime(ts?: string | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function bytes(n?: number | null): string {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function initials(name?: string | null): string {
  if (!name) return '—';
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

/**
 * Turn the tags the booking engine stamps on a reservation into English.
 *
 * The site records what the guest chose as machine-readable strings —
 * `model:rooms-coworking-surf`, `coworking:2xoffice`, `surfGuests:3` — because
 * that is what survives a round trip through a database column. Nobody at a
 * front desk should have to read them, and "what did this guest actually buy"
 * is the one thing those tags answer that nothing else in the PMS does.
 *
 * Anything unrecognised is passed through rather than dropped: a tag added by
 * a later version of the site should still be legible here, not invisible.
 */
export function bookingPreference(tag: string): string {
  const [key, rest = ''] = tag.split(/:(.+)/);
  switch (key) {
    case 'model':
      return {
        rooms: 'Rooms only',
        'rooms-coworking': 'Rooms + coworking',
        'rooms-surf': 'Rooms + surf',
        'rooms-coworking-surf': 'Rooms + coworking + surf',
      }[rest] ?? `Package: ${rest}`;
    case 'coworking': {
      const [seats, kind] = rest.split('x');
      const n = Number(seats);
      if (!Number.isFinite(n) || n <= 0) return 'Coworking';
      return `${n} coworking desk${n === 1 ? '' : 's'}${kind ? ` · ${kind}` : ''}`;
    }
    case 'surfGuests': {
      const n = Number(rest);
      return Number.isFinite(n) && n > 0
        ? `Surf lessons for ${n} guest${n === 1 ? '' : 's'}`
        : 'Surf lessons';
    }
    case 'addon':
      return rest === 'airportPickup' ? 'Airport pickup' : `Extra: ${rest}`;
    case 'party': {
      const n = Number(rest);
      return Number.isFinite(n) && n > 1 ? `Booked as a party of ${n}` : 'Part of a party';
    }
    default:
      return tag;
  }
}

/** A postal address as one line, from the JSON the profile stores it in. */
export function addressLine(a?: {
  line1?: string | null; line2?: string | null; city?: string | null;
  postcode?: string | null; country?: string | null;
} | null): string {
  if (!a) return '';
  return [a.line1, a.line2, a.city, a.postcode, a.country]
    .map((p) => (p ?? '').trim()).filter(Boolean).join(', ');
}
