// ─────────────────────────────────────────────────────────────
// The bed a website booking holds, and how it lets go of it.
//
//   node --experimental-sqlite scripts/holds-check.ts
//
// This exists because the opposite behaviour shipped and was wrong in a way
// nothing caught: a booking taken by the property's own booking page held no
// inventory at all, so the last bed could be sold on the website and on
// Booking.com within the same minute. Every check here is one half of that
// defect, written so it cannot come back quietly.
//
// It builds its own database in a temp directory; the live one is never opened.
// ─────────────────────────────────────────────────────────────
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const workdir = mkdtempSync(join(tmpdir(), 'helio-holds-'));
process.env.HELIO_DB = join(workdir, 'data', 'helio.db');
process.env.HELIO_BACKUP_ENABLED = 'false';

const { migrate, run, get, all } = await import('../src/db.ts');
const { id, nowIso, addDays, todayIso } = await import('../src/lib/util.ts');
const avail = await import('../src/services/availability.ts');
const res = await import('../src/services/reservations.ts');
const holds = await import('../src/services/holds.ts');
const pending = await import('../src/services/pendingbookings.ts');

let failures = 0;
let checks = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  checks++;
  process.stdout.write(`  ${ok ? '✓' : '✗'} ${name}\n`);
  if (!ok) {
    failures++;
    if (detail !== undefined) process.stdout.write(`      ${JSON.stringify(detail).slice(0, 300)}\n`);
  }
}
function section(t: string) { process.stdout.write(`\n${t}\n${'─'.repeat(t.length)}\n`); }

const RATE = 1_000;
const TODAY = todayIso();
const IN = addDays(TODAY, 10);
const OUT = addDays(TODAY, 12);
const ACTOR = { userId: 'usr_test', userName: 'Check', propertyId: '' };

function seed() {
  const propertyId = id('prp');
  run(
    `INSERT INTO properties(id, code, name, kind, timezone, currency, locale, business_date,
                            check_in_time, check_out_time, active, created_at)
     VALUES(?,?,?,'hostel','UTC','USD','en',?,'14:00','11:00',1,?)`,
    propertyId, 'HOLDS', 'Hold Check', TODAY, nowIso(),
  );
  // A four-bed dorm: the shape the defect actually bit on.
  const roomTypeId = id('rt');
  run(
    `INSERT INTO room_types(id, property_id, code, name, kind, base_occupancy, max_occupancy,
                            max_adults, max_children, default_rate_minor, extra_adult_minor,
                            extra_child_minor, sort_order, active, created_at)
     VALUES(?,?,'D4','4 Bed Dorm','dorm',1,1,1,0,?,0,0,1,1,?)`,
    roomTypeId, propertyId, RATE, nowIso(),
  );
  const roomId = id('rm');
  run(
    `INSERT INTO rooms(id, property_id, room_type_id, number, status, active, created_at)
     VALUES(?,?,?,'201','Vacant Clean',1,?)`,
    roomId, propertyId, roomTypeId, nowIso(),
  );
  for (let i = 1; i <= 4; i++) {
    run(
      `INSERT INTO beds(id, property_id, room_id, code, bunk, status, active)
       VALUES(?,?,?,?,'bottom','Vacant Clean',1)`,
      id('bed'), propertyId, roomId, `201-0${i}`,
    );
  }
  const ratePlanId = id('rp');
  run(
    `INSERT INTO rate_plans(id, property_id, code, name, active, created_at)
     VALUES(?,?,'BAR','Standard',1,?)`,
    ratePlanId, propertyId, nowIso(),
  );
  run('INSERT INTO rate_plan_room_types(rate_plan_id, room_type_id, base_rate_minor) VALUES(?,?,?)',
    ratePlanId, roomTypeId, RATE);
  return { propertyId, roomTypeId, ratePlanId };
}

/** Beds free of one type over the test dates — what the channels would publish. */
function free(propertyId: string, roomTypeId: string): number {
  const cells = avail.availabilityGrid(propertyId, IN, OUT).filter((c) => c.roomTypeId === roomTypeId);
  return cells.length ? Math.min(...cells.map((c) => c.available)) : -1;
}

function book(propertyId: string, roomTypeId: string, ratePlanId: string, origin: string) {
  return res.createReservation(propertyId, { ...ACTOR, propertyId }, {
    guestName: 'Web Guest', email: 'web@test.test',
    arrival: IN, departure: OUT, adults: 1, children: 0,
    roomTypeId, ratePlanId,
    status: origin === 'booking_engine' ? 'Tentative' : 'Confirmed',
    source: 'Booking Engine', origin,
  } as any);
}

async function main() {
  process.stdout.write(`\nBooking hold checks\n${'─'.repeat(19)}\nWorking in ${workdir}\n`);
  migrate();
  const { propertyId: P, roomTypeId: RT, ratePlanId: RP } = seed();

  section('1 · The timestamp format the whole thing rests on');
  // The predicate compares an ISO string against SQLite's clock. Compared
  // against `datetime('now')` — which has a space where ISO has a `T`, and `T`
  // sorts after a space — every hold would look unexpired forever and no bed
  // would ever come back.
  const sqlNow = get<{ n: string }>(`SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now') AS n`)!.n;
  const jsNow = new Date().toISOString();
  check('SQLite\'s clock and toISOString() have the same shape',
    sqlNow.length === jsNow.length && sqlNow[10] === 'T' && sqlNow.endsWith('Z'), [sqlNow, jsNow]);
  check('a future timestamp really does compare as future',
    addDays(TODAY, 1) + 'T00:00:00.000Z' > sqlNow);

  section('2 · A website booking holds its bed immediately');
  check('four beds to start with', free(P, RT) === 4, free(P, RT));
  const b1 = book(P, RT, RP, 'booking_engine');
  check('the booking is awaiting confirmation', b1.status === 'Tentative', b1.status);
  check('one bed is now gone', free(P, RT) === 3, free(P, RT));

  const row = get<any>('SELECT status, origin, hold_expires_at FROM reservations WHERE id = ?', b1.id);
  check('and it carries an expiry', typeof row.hold_expires_at === 'string' && !!row.hold_expires_at,
    row.hold_expires_at);
  check('roughly the default window away',
    Math.abs(Date.parse(row.hold_expires_at) - Date.now() - holds.DEFAULT_HOLD_HOURS * 3_600_000) < 60_000,
    row.hold_expires_at);

  section('3 · The whole dorm can be held, and then nothing is sellable');
  book(P, RT, RP, 'booking_engine');
  book(P, RT, RP, 'booking_engine');
  book(P, RT, RP, 'booking_engine');
  check('four website bookings take all four beds', free(P, RT) === 0, free(P, RT));
  // The exact defect: this number is what gets pushed to the OTAs. Before the
  // fix it was still 4 with every bed sold.
  check('so the channels would be told nothing is free', free(P, RT) === 0);

  section('4 · An expired hold frees the bed on the clock alone');
  const past = new Date(Date.now() - 60_000).toISOString();
  run('UPDATE reservations SET hold_expires_at = ? WHERE id = ?', past, b1.id);
  // Deliberately without running the sweep. Availability must be right even on
  // a machine that was asleep, or the sweep becomes load-bearing.
  check('the bed is back before any sweep has run', free(P, RT) === 1, free(P, RT));
  check('the booking is still on the books, though',
    get<any>('SELECT status FROM reservations WHERE id = ?', b1.id).status === 'Tentative');

  section('5 · The sweep then tidies up');
  const swept = holds.releaseExpiredHolds();
  check('it released exactly the expired one', swept.released === 1, swept);
  const after = get<any>('SELECT status, cancel_reason, hold_expires_at FROM reservations WHERE id = ?', b1.id);
  check('which is now cancelled', after.status === 'Cancelled', after.status);
  check('with a reason a person can read', /hold expired/i.test(after.cancel_reason ?? ''), after.cancel_reason);
  check('and no stale expiry left on it', after.hold_expires_at === null, after.hold_expires_at);
  check('the other three are untouched', free(P, RT) === 1, free(P, RT));
  check('running it again does nothing', holds.releaseExpiredHolds().released === 0);
  check('it is written to the audit trail',
    all<any>(`SELECT id FROM audit_log WHERE action = 'reservation.hold-expired'`).length === 1);

  section('6 · Confirming a booking makes the hold permanent');
  const live = all<any>(
    `SELECT id FROM reservations WHERE property_id = ? AND status = 'Tentative'`, P);
  res.confirmBooking(P, { ...ACTOR, propertyId: P }, live[0].id, { auto: true } as any);
  const confirmed = get<any>('SELECT status, hold_expires_at FROM reservations WHERE id = ?', live[0].id);
  check('the status is Confirmed', confirmed.status === 'Confirmed', confirmed.status);
  check('and the expiry is cleared', confirmed.hold_expires_at === null, confirmed.hold_expires_at);
  check('the bed stays held', free(P, RT) === 1, free(P, RT));

  section('7 · A hand-made Tentative booking is not a website hold');
  // The state is the *pair* — status and origin. Matching on status alone
  // would strip the inventory from every Tentative booking a person made.
  const manual = res.createReservation(P, { ...ACTOR, propertyId: P }, {
    guestName: 'Phone Guest', arrival: IN, departure: OUT, adults: 1, children: 0,
    roomTypeId: RT, ratePlanId: RP, status: 'Tentative', source: 'Direct', origin: 'pms',
  } as any);
  const manualRow = get<any>('SELECT origin, hold_expires_at FROM reservations WHERE id = ?', manual.id);
  check('it has no expiry at all', manualRow.hold_expires_at === null, manualRow);
  check('it is not treated as pending',
    !pending.isPending({ status: 'Tentative', origin: manualRow.origin }));
  check('and it holds its bed like any other booking', free(P, RT) === 0, free(P, RT));
  check('the sweep leaves it alone', holds.releaseExpiredHolds().released === 0);

  section('8 · The hold window is the property\'s, and is clamped');
  check('the default applies when nothing is set',
    holds.holdWindowHours(P) === holds.DEFAULT_HOLD_HOURS);
  holds.setHoldWindowHours(P, { userId: 'u' }, 4);
  check('a chosen window is kept', holds.holdWindowHours(P) === 4);
  check('zero is refused — it would hold nothing',
    holds.setHoldWindowHours(P, { userId: 'u' }, 0) === holds.MIN_HOLD_HOURS);
  check('and a year is refused — it would hold forever',
    holds.setHoldWindowHours(P, { userId: 'u' }, 9999) === holds.MAX_HOLD_HOURS);

  process.stdout.write(`\n${checks - failures}/${checks} hold checks passed\n`);
  if (failures) { process.exitCode = 1; return; }
  process.stdout.write(
    'A website booking takes the bed off the market, and gives it back on time.\n');
}

try {
  await main();
} catch (e) {
  process.stderr.write(`\nAborted: ${e instanceof Error ? e.stack : String(e)}\n`);
  process.exitCode = 1;
} finally {
  try { rmSync(workdir, { recursive: true, force: true }); } catch { /* windows file locks */ }
}
