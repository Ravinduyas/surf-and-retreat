// ─────────────────────────────────────────────────────────────
// Tape chart: chunking time, and stitching it back together.
//
// The chart scrolls sideways without end, but the server will not hand out an
// unbounded range — `/api/calendar/tape` refuses anything over 400 days, and it
// is right to. One query returning five years of nights would hold the write
// lock while the front desk waited.
//
// So time is cut into fixed chunks, each fetched and cached on its own, and the
// pieces are stitched here. Two things about that stitching are easy to get
// wrong and both produce a chart that lies:
//
//   · **A stay is clipped to the window it was asked about.** The endpoint
//     computes a span as MIN/MAX of the reservation's nights *within the range
//     queried*, so a stay from 1 → 20 August fetched as two chunks comes back
//     as 1 → 10 and 10 → 20. Concatenating them draws two touching bars with a
//     seam down the middle of somebody's stay. They must be merged per lane, by
//     earliest start and latest end.
//
//   · **Chunk boundaries must not move.** If a chunk started wherever the user
//     happened to be looking, every scroll would produce a new cache key and
//     nothing would ever be reused. Chunks are aligned to a fixed grid from a
//     fixed epoch, so the same 60 days always has the same key no matter how it
//     was arrived at.
//
// Everything here is pure and free of React and the DOM, so it can be tested
// directly — see `scripts/tapechart-check.ts`.
// ─────────────────────────────────────────────────────────────
// Imported with its extension so this module loads unchanged under plain Node,
// which is what lets `scripts/tapechart-check.ts` test the stitching directly
// rather than through a browser. Vite and `allowImportingTsExtensions` both
// accept it.
import { addDays, nightsBetween } from './format.ts';

/**
 * Days per chunk.
 *
 * Wide enough that ordinary scrolling rarely crosses a boundary, and well under
 * the server's 400-day ceiling so a request is never refused. Sixty days is
 * also about two screens at the widest zoom, which is what makes prefetching
 * one chunk ahead feel like the data was always there.
 */
export const CHUNK_DAYS = 60;

/**
 * The epoch chunk boundaries are measured from.
 *
 * Arbitrary but *fixed*: what matters is that it never changes, because it is
 * what makes a chunk's identity stable across sessions and users.
 */
const EPOCH = '2020-01-01';

/** The start of the chunk containing `date`. */
export function chunkStart(date: string): string {
  const offset = nightsBetween(EPOCH, date);
  // Math.floor, not truncation: dates before the epoch must round down too, or
  // chunks either side of it would overlap.
  return addDays(EPOCH, Math.floor(offset / CHUNK_DAYS) * CHUNK_DAYS);
}

/** Every chunk start needed to cover `from` (inclusive) → `to` (exclusive). */
export function chunksCovering(from: string, to: string): string[] {
  const out: string[] = [];
  for (let c = chunkStart(from); c < to; c = addDays(c, CHUNK_DAYS)) out.push(c);
  return out;
}

// ─── The shapes the endpoint returns ─────────────────────────
export interface TapeSpan {
  reservationId: string; roomId: string; bedId: string | null;
  confirmation: string; guest: string; status: string;
  /** Clipped to the queried window — merge before drawing. */
  from: string; to: string;
  arrival: string; departure: string; vip: boolean;
  source: string; channel: string | null; otaChannel?: string | null;
  nights: number; totalMinor: number; adults: number; children: number;
  /** What Hostelworld collected at booking, when the split applies. */
  otaCollectedMinor?: number | null;
}

export interface TapeBlock {
  id: string; roomId: string; kind: string; from: string; to: string; reason: string | null;
}

export interface TapeRoom {
  id: string; number: string; floor: number; status: string;
  roomTypeId: string; roomType: string; roomTypeCode: string; kind: string;
  beds: { id: string; code: string; bunk: string }[];
}

export interface TapeUnassigned {
  reservationId: string; confirmation: string; guest: string; status: string;
  arrival: string; departure: string; roomType: string; roomTypeId: string; vip: boolean;
}

export interface TapeAvailability {
  roomTypeId: string; date: string;
  physical: number; blocked: number; sold: number; available: number;
}

export interface TapeChunk {
  from: string; to: string;
  rooms: TapeRoom[];
  spans: TapeSpan[];
  blocks: TapeBlock[];
  unassigned: TapeUnassigned[];
  availability: TapeAvailability[];
}

/** A span after stitching: `from`/`to` now describe the whole stay in this lane. */
export type MergedSpan = TapeSpan;

export interface MergedTape {
  rooms: TapeRoom[];
  spans: MergedSpan[];
  blocks: TapeBlock[];
  unassigned: TapeUnassigned[];
  availability: TapeAvailability[];
}

/** Which line of the chart a span belongs to: a bed in a dorm, else the room. */
export function laneKeyOf(span: { roomId: string; bedId: string | null }): string {
  return span.bedId ?? span.roomId;
}

/**
 * Stitch chunks into one chart.
 *
 * Order does not matter — chunks arrive as their requests resolve, not in date
 * order, and a merge that depended on arrival order would draw differently
 * depending on the network.
 */
export function mergeChunks(chunks: (TapeChunk | undefined | null)[]): MergedTape {
  const present = chunks.filter(Boolean) as TapeChunk[];

  // Rooms are configuration, identical in every chunk. Take the largest set
  // rather than the first: a chunk that failed or is still loading contributes
  // nothing, and a room added mid-session should appear rather than be masked.
  let rooms: TapeRoom[] = [];
  for (const c of present) if (c.rooms.length > rooms.length) rooms = c.rooms;

  // Spans: one entry per (lane, reservation), widened to cover every chunk it
  // was seen in. This is what makes a stay crossing a seam draw as one bar.
  const spans = new Map<string, MergedSpan>();
  for (const c of present) {
    for (const s of c.spans) {
      const key = `${laneKeyOf(s)}|${s.reservationId}`;
      const seen = spans.get(key);
      if (!seen) {
        spans.set(key, { ...s });
        continue;
      }
      if (s.from < seen.from) seen.from = s.from;
      if (s.to > seen.to) seen.to = s.to;
    }
  }

  // Blocks and unassigned bookings carry their true dates, so they only need
  // de-duplicating where two chunks both overlap them.
  const blocks = new Map<string, TapeBlock>();
  for (const c of present) for (const b of c.blocks) blocks.set(b.id, b);

  const unassigned = new Map<string, TapeUnassigned>();
  for (const c of present) for (const u of c.unassigned) unassigned.set(u.reservationId, u);

  // Availability is already per date and per room type, so a key of the two is
  // exact. Later chunks win, which matters only where chunks overlap — and then
  // both values are the same.
  const availability = new Map<string, TapeAvailability>();
  for (const c of present) {
    for (const a of c.availability) availability.set(`${a.roomTypeId}|${a.date}`, a);
  }

  return {
    rooms,
    spans: [...spans.values()],
    blocks: [...blocks.values()],
    unassigned: [...unassigned.values()],
    availability: [...availability.values()],
  };
}

// ─── Filtering ───────────────────────────────────────────────

export interface TapeFilters {
  roomTypeIds: string[];
  floors: number[];
  /** Housekeeping status of the room, e.g. "Vacant Clean". */
  housekeeping: string[];
  /** Reservation status, e.g. "Confirmed", "Checked-in". */
  reservationStatus: string[];
  /** Business source, e.g. "OTA", "Direct". */
  sources: string[];
  /** The OTA behind a hub connection, e.g. "Hostelworld". */
  otaChannels: string[];
  vipOnly: boolean;
  /** Hide lanes that have nothing booked in the visible range. */
  occupiedOnly: boolean;
  /** Free text over guest name and confirmation. */
  search: string;
}

export const NO_FILTERS: TapeFilters = {
  roomTypeIds: [], floors: [], housekeeping: [], reservationStatus: [],
  sources: [], otaChannels: [], vipOnly: false, occupiedOnly: false, search: '',
};

/** How many filters are doing something. Drives the "Filters (3)" badge. */
export function activeFilterCount(f: TapeFilters): number {
  return (f.roomTypeIds.length ? 1 : 0)
    + (f.floors.length ? 1 : 0)
    + (f.housekeeping.length ? 1 : 0)
    + (f.reservationStatus.length ? 1 : 0)
    + (f.sources.length ? 1 : 0)
    + (f.otaChannels.length ? 1 : 0)
    + (f.vipOnly ? 1 : 0)
    + (f.occupiedOnly ? 1 : 0)
    + (f.search.trim() ? 1 : 0);
}

/**
 * Does this span survive the reservation-side filters?
 *
 * Search is deliberately **not** included: a search dims non-matches rather
 * than removing them, because the useful question is "which room is Nadeeka
 * in?" and hiding every other bar hides the answer's context.
 */
export function spanMatches(span: TapeSpan, f: TapeFilters): boolean {
  if (f.reservationStatus.length && !f.reservationStatus.includes(span.status)) return false;
  if (f.sources.length && !f.sources.includes(span.source)) return false;
  if (f.otaChannels.length) {
    const ota = span.otaChannel ?? span.channel ?? '';
    if (!f.otaChannels.includes(ota)) return false;
  }
  if (f.vipOnly && !span.vip) return false;
  return true;
}

/** Does a span match the search box? */
export function spanMatchesSearch(span: TapeSpan, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return false;
  return span.guest.toLowerCase().includes(q)
    || span.confirmation.toLowerCase().includes(q);
}

/** Does this room survive the room-side filters? */
export function roomMatches(room: TapeRoom, f: TapeFilters): boolean {
  if (f.roomTypeIds.length && !f.roomTypeIds.includes(room.roomTypeId)) return false;
  if (f.floors.length && !f.floors.includes(room.floor)) return false;
  if (f.housekeeping.length && !f.housekeeping.includes(room.status)) return false;
  return true;
}

// ─── X-axis virtualisation ───────────────────────────────────

/**
 * Which slice of dates is worth rendering.
 *
 * A year of dates across a property's rooms is tens of thousands of cells, and
 * the browser will build every one of them if asked. `overscan` days either
 * side keep a fast scroll from showing blank columns before React catches up.
 */
export function visibleSlice(
  totalDays: number, scrollLeft: number, viewportWidth: number,
  cellWidth: number, overscan = 10,
): { startIndex: number; endIndex: number } {
  if (cellWidth <= 0 || totalDays <= 0) return { startIndex: 0, endIndex: 0 };
  const first = Math.floor(scrollLeft / cellWidth) - overscan;
  const count = Math.ceil(viewportWidth / cellWidth) + overscan * 2;
  const startIndex = Math.max(0, Math.min(first, totalDays - 1));
  const endIndex = Math.max(startIndex, Math.min(totalDays, startIndex + count));
  return { startIndex, endIndex };
}
