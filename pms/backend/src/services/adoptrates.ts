// ─────────────────────────────────────────────────────────────
// Reading the channel's prices *into* this PMS.
//
// Everything else in this system pushes: the PMS decides a price and the
// channel is told. That is right once a property is running, and wrong on the
// day it starts.
//
// A property that already sells on Booking.com has months of prices sitting in
// its channel manager. Connecting a new PMS and pushing would replace all of
// it with whatever the new PMS happens to hold — which, on the day of the
// switch, is whatever somebody typed in while setting it up. Observed here:
// the PMS held $8.30 for a dorm that was selling at $16.00, across 56 dates.
// One drain would have halved the price of every dorm on every OTA within
// seconds of going live.
//
// So this is the other direction, used once, at the start: take what the
// channel already holds as the truth and write it into the rate calendar. The
// two sides then agree, the first push is a no-op, and the property carries on
// pricing from the PMS afterwards.
//
// Deliberately not automatic, and deliberately not on a timer. It overwrites
// the PMS's own rates, which is exactly what is wanted once and a disaster
// every other time.
// ─────────────────────────────────────────────────────────────
import { all, get, run, tx } from '../db.ts';
import { addDays, dateRange, id, nowIso, HttpError } from '../lib/util.ts';
import { audit } from './audit.ts';
import { getChannel, listMappings, clientFor } from './channels.ts';
import type { AuthContext } from '../auth.ts';

export interface AdoptResult {
  from: string;
  to: string;
  roomTypes: {
    roomType: string;
    roomTypeId: string;
    externalRoomId: string;
    datesRead: number;
    written: number;
    unchanged: number;
    /** A sample of what changed, for the report. */
    samples: { date: string; wasMinor: number | null; nowMinor: number }[];
  }[];
  totalWritten: number;
  dryRun: boolean;
}

/**
 * Adopt the channel's prices for every mapped room type.
 *
 * `dryRun` is the default on purpose. This rewrites the property's own rate
 * calendar, and the first thing anybody should do is look at what it would
 * change.
 *
 * Only prices are adopted, not availability. Availability is computed by this
 * PMS from beds, bookings and blocks — it is not a number anybody stores, and
 * taking the channel's idea of it would be adopting a stale copy of an answer
 * this system derives correctly.
 */
export async function adoptChannelRates(
  propertyId: string,
  actor: AuthContext,
  channelId: string,
  opts: { from?: string; days?: number; dryRun?: boolean } = {},
): Promise<AdoptResult> {
  const channel = getChannel(propertyId, channelId);
  const client = clientFor(propertyId, channel);

  const property = get<{ business_date: string }>(
    'SELECT business_date FROM properties WHERE id = ?', propertyId);
  const from = opts.from ?? property?.business_date ?? nowIso().slice(0, 10);
  const days = Math.min(730, Math.max(1, opts.days ?? 365));
  const to = addDays(from, days);
  const dryRun = opts.dryRun !== false;

  const mappings = listMappings(propertyId, channelId)
    .filter((m) => m.active && m.externalRoomId && m.roomTypeId);
  if (!mappings.length) {
    throw new HttpError(409,
      'No active room mappings. Match the rooms before adopting prices.', 'no_mappings');
  }

  const result: AdoptResult = { from, to, roomTypes: [], totalWritten: 0, dryRun };

  for (const m of mappings) {
    const res = await client.getCalendar(m.externalRoomId!, from, to);
    const remote = ((res.data as any)?.data ?? []) as any[];

    /*
     * Beds24 answers in ranges, not days.
     *
     * One entry can say "from 2026-09-23 to 2026-10-31, price1 = 14.00", and
     * the rate calendar here is one row per date. The range is expanded, with
     * `to` inclusive — a range ending on the 31st includes the 31st, so the
     * expansion runs to the day after.
     */
    const byDate = new Map<string, number>();
    for (const entry of remote) {
      for (const day of entry.calendar ?? []) {
        const price = Number(day.price1);
        if (!Number.isFinite(price) || price <= 0) continue;
        const minor = Math.round(price * 100);
        for (const date of dateRange(day.from, addDays(day.to, 1))) {
          if (date >= from && date < to) byDate.set(date, minor);
        }
      }
    }

    // Which plan these prices belong to. The mapping names one; otherwise the
    // plan the public site sells on, which is the one the channel is quoting.
    const ratePlanId = m.ratePlanId ?? get<{ id: string }>(
      `SELECT id FROM rate_plans
        WHERE property_id = ? AND active = 1 AND upper(code) = 'BAR'
        ORDER BY sort_order, name LIMIT 1`, propertyId)?.id;
    if (!ratePlanId) {
      throw new HttpError(409, 'No rate plan to write these prices to.', 'no_rate_plan');
    }

    const existing = new Map<string, number>(
      all<{ date: string; price_minor: number }>(
        `SELECT date, price_minor FROM rate_calendar
          WHERE property_id = ? AND room_type_id = ? AND rate_plan_id = ?
            AND date >= ? AND date < ?`,
        propertyId, m.roomTypeId, ratePlanId, from, to,
      ).map((r) => [r.date, r.price_minor]),
    );

    const entry = {
      roomType: m.roomType ?? m.roomTypeId!,
      roomTypeId: m.roomTypeId!,
      externalRoomId: m.externalRoomId!,
      datesRead: byDate.size,
      written: 0,
      unchanged: 0,
      samples: [] as { date: string; wasMinor: number | null; nowMinor: number }[],
    };

    const writes: [string, number][] = [];
    for (const [date, minor] of byDate) {
      const was = existing.get(date);
      if (was === minor) { entry.unchanged += 1; continue; }
      writes.push([date, minor]);
      if (entry.samples.length < 5) {
        entry.samples.push({ date, wasMinor: was ?? null, nowMinor: minor });
      }
    }
    entry.written = writes.length;

    if (!dryRun && writes.length) {
      // One transaction per room type. A partial adoption across room types is
      // recoverable by re-running; a partial one *within* a room type would
      // leave a calendar half at one price and half at another.
      tx(() => {
        for (const [date, minor] of writes) {
          run(
            `INSERT INTO rate_calendar(id, property_id, room_type_id, rate_plan_id, date,
                                       price_minor, updated_at, updated_by)
             VALUES(?,?,?,?,?,?,?,?)
             ON CONFLICT(property_id, room_type_id, rate_plan_id, date) DO UPDATE SET
               price_minor = excluded.price_minor,
               updated_at = excluded.updated_at,
               updated_by = excluded.updated_by`,
            id('rc'), propertyId, m.roomTypeId, ratePlanId, date, minor,
            nowIso(), `adopt:${channel.code}`,
          );
        }
      });
    }

    result.roomTypes.push(entry);
    result.totalWritten += entry.written;
  }

  if (!dryRun && result.totalWritten > 0) {
    audit(actor, {
      action: 'channel.adopt-rates', entity: 'CHANNEL', entityId: channelId,
      entityRef: channel.code, channel: channel.code, elevated: true,
      after: {
        from, to, datesWritten: result.totalWritten,
        roomTypes: result.roomTypes.map((r) => ({ roomType: r.roomType, written: r.written })),
      },
    });
  }

  return result;
}
