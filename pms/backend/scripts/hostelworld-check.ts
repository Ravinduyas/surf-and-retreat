// ─────────────────────────────────────────────────────────────
// Hostelworld money: total, what Hostelworld collected, business price.
//
//   node --experimental-sqlite scripts/hostelworld-check.ts
//
// The defect this guards against is quiet and expensive: a Hostelworld guest
// has already paid part of the stay to Hostelworld, and a desk shown only the
// total asks for it again. Every check here is one half of getting that
// right — the arithmetic, which bookings it touches, what the folio does, and
// what happens when the booking dies.
//
// It builds its own database in a temp directory; the live one is never opened.
// ─────────────────────────────────────────────────────────────
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const workdir = mkdtempSync(join(tmpdir(), 'helio-hostelworld-'));
process.env.HELIO_DB = join(workdir, 'data', 'helio.db');
process.env.HELIO_BACKUP_ENABLED = 'false';

const { migrate, run, get, all } = await import('../src/db.ts');
const { id, nowIso, addDays, todayIso, dateRange } = await import('../src/lib/util.ts');
const res = await import('../src/services/reservations.ts');
const hw = await import('../src/services/hostelworld.ts');
const folio = await import('../src/services/folio.ts');
const { normaliseBooking } = await import('../src/channels/beds24.ts');

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

const RATE = 3_000;
const TODAY = todayIso();
const IN = addDays(TODAY, 5);
const OUT = addDays(TODAY, 8);   // three nights
const ACTOR = { userId: 'usr_test', userName: 'Check', propertyId: '' };

function seed() {
  const propertyId = id('prp');
  run(
    `INSERT INTO properties(id, code, name, kind, timezone, currency, locale, business_date,
                            check_in_time, check_out_time, active, created_at)
     VALUES(?,?,?,'hostel','UTC','USD','en',?,'14:00','11:00',1,?)`,
    propertyId, 'HWCK', 'Hostelworld Check', TODAY, nowIso(),
  );
  const roomTypeId = id('rt');
  run(
    `INSERT INTO room_types(id, property_id, code, name, kind, base_occupancy, max_occupancy,
                            max_adults, max_children, default_rate_minor, extra_adult_minor,
                            extra_child_minor, sort_order, active, created_at)
     VALUES(?,?,'DBL','Double','room',2,2,2,0,?,0,0,1,1,?)`,
    roomTypeId, propertyId, RATE, nowIso(),
  );
  for (const n of ['101', '102', '103', '104', '105', '106']) {
    run(
      `INSERT INTO rooms(id, property_id, room_type_id, number, status, active, created_at)
       VALUES(?,?,?,?,'Vacant Clean',1,?)`,
      id('rm'), propertyId, roomTypeId, n, nowIso(),
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

function book(
  P: string, RT: string, RP: string,
  extra: Record<string, unknown> = {},
) {
  return res.createReservation(P, { ...ACTOR, propertyId: P }, {
    guestName: 'Test Guest', arrival: IN, departure: OUT, adults: 1, children: 0,
    roomTypeId: RT, ratePlanId: RP, status: 'Confirmed',
    ...extra,
  } as any);
}

function creditLines(reservationId: string) {
  return all<any>(
    `SELECT l.* FROM folio_lines l JOIN folios f ON f.id = l.folio_id
      WHERE f.reservation_id = ? AND l.code = ? ORDER BY l.posted_at`,
    reservationId, hw.HW_CREDIT_CODE);
}

async function main() {
  process.stdout.write(`\nHostelworld money checks\n${'─'.repeat(24)}\nWorking in ${workdir}\n`);
  migrate();
  const { propertyId: P, roomTypeId: RT, ratePlanId: RP } = seed();
  const A = { ...ACTOR, propertyId: P };

  section('1 · The arithmetic');
  const on = { ...hw.DEFAULT_HW_POLICY, enabled: true, percentBp: 1_500 };
  check('deposit from the channel wins', hw.resolveCollected(on, 10_000, { depositMinor: 1_234, commissionMinor: 999 }) === 1_234);
  check('commission stands in when there is no deposit', hw.resolveCollected(on, 10_000, { depositMinor: 0, commissionMinor: 999 }) === 999);
  check('the percentage applies when the channel sent nothing', hw.resolveCollected(on, 10_000, {}) === 1_500);
  check('percent mode ignores the channel figures',
    hw.resolveCollected({ ...on, collectedMode: 'percent' }, 10_000, { depositMinor: 1_234 }) === 1_500);
  check('a deposit larger than the booking is clamped, not negative',
    hw.resolveCollected(on, 5_000, { depositMinor: 9_000 }) === 5_000);
  check('business price is total − collected', hw.businessPrice(10_000, 1_500) === 8_500);
  check('business price never goes below zero', hw.businessPrice(1_000, 5_000) === 0);
  const split = hw.splitTotal(10_000, 3);
  check('a total split over nights adds up exactly', split.reduce((s, n) => s + n, 0) === 10_000, split);
  check('the rounding remainder lands on the last night', split[0] === 3_333 && split[2] === 3_334, split);
  check('"Hostelworld" is recognised however it is spelled',
    hw.isHostelworld('Hostelworld', null) && hw.isHostelworld('hostelworld', 'BEDS24') && hw.isHostelworld('HostelWorld.com', null));
  check('Booking.com and a direct booking are not', !hw.isHostelworld('Booking.com', 'BEDS24') && !hw.isHostelworld(null, null));

  section('2 · Off by default, and nothing changes while it is off');
  check('the policy is off on a fresh property', hw.hostelworldPolicy(P).enabled === false);
  const offBooking = book(P, RT, RP, {
    source: 'OTA', channelCode: 'BEDS24', otaChannel: 'Hostelworld', otaReference: 'HW-OFF',
    origin: 'channel', otaTotalMinor: 12_000, force: true,
  });
  check('a Hostelworld booking is still recognised as one', offBooking.hostelworld === true);
  check('but carries no split', offBooking.otaCollectedMinor === null && offBooking.businessMinor === null);
  check('and is priced from the rate plan as before', offBooking.totalMinor === RATE * 3, offBooking.totalMinor);
  check('and has no folio credit', creditLines(offBooking.id).length === 0);

  section('3 · Switched on: a Hostelworld booking arrives');
  hw.saveHostelworldPolicy(P, A, { enabled: true, percentBp: 1_500 });
  check('the policy reads back enabled', hw.hostelworldPolicy(P).enabled === true);
  const policy = hw.hostelworldPolicy(P);
  const booking = book(P, RT, RP, {
    source: 'OTA', channelCode: 'BEDS24', otaChannel: 'Hostelworld', otaReference: 'HW-1',
    origin: 'channel', force: true,
    otaTotalMinor: 10_000, totalOverrideMinor: 10_000,
    otaCollectedMinor: hw.resolveCollected(policy, 10_000, { depositMinor: 1_200 }),
  });
  hw.syncCollectedCredit(P, A, booking.id, policy);
  const b1 = res.getReservationDetail(P, booking.id);
  check('the total is what Hostelworld said, not the rate plan', b1.totalMinor === 10_000, b1.totalMinor);
  check('the nights add up to that total',
    b1.nightRows.reduce((s: number, n: any) => s + n.rateMinor, 0) === 10_000);
  check('Hostelworld collected is the channel deposit', b1.otaCollectedMinor === 1_200, b1.otaCollectedMinor);
  check('business price is total − collected', b1.businessMinor === 8_800, b1.businessMinor);
  const lines1 = creditLines(booking.id);
  check('one credit line is on the folio', lines1.length === 1, lines1.length);
  check('it is an adjustment, not a payment — the till must not see it',
    lines1[0]?.kind === 'adjustment' && lines1[0]?.amount_minor === -1_200, lines1[0]);
  check('the folio balance is the credit (nothing posted yet)', b1.balanceMinor === -1_200, b1.balanceMinor);
  check('the credit is reported on the booking', b1.otaCreditMinor === 1_200, b1.otaCreditMinor);
  const totals = folio.folioTotals(b1.folios[0].id);
  check('folio totals count it under adjustments, and payments stay zero',
    totals.adjustmentsMinor === -1_200 && totals.paymentsMinor === 0, totals);

  section('4 · A Booking.com booking is left alone while the switch is on');
  const other = book(P, RT, RP, {
    source: 'OTA', channelCode: 'BEDS24', otaChannel: 'Booking.com', otaReference: 'BDC-1',
    origin: 'channel', force: true, otaTotalMinor: 9_000,
  });
  hw.syncCollectedCredit(P, A, other.id, policy);
  check('no split on the booking', other.hostelworld === false && other.businessMinor === null);
  check('no credit on its folio', creditLines(other.id).length === 0);
  check('priced from the rate plan, as before', other.totalMinor === RATE * 3);

  section('5 · Idempotent sync, hand corrections, and the folio following them');
  check('syncing again changes nothing', hw.syncCollectedCredit(P, A, booking.id, policy) === 'unchanged');
  check('still exactly one live credit line', creditLines(booking.id).filter((l) => l.voided === 0).length === 1);
  res.updateReservation(P, A, booking.id, { otaCollectedMinor: 1_500 });
  const b2 = res.getReservationDetail(P, booking.id);
  check('a corrected amount is stored', b2.otaCollectedMinor === 1_500);
  check('business price follows it', b2.businessMinor === 8_500);
  const lines2 = creditLines(booking.id);
  check('the old line is struck and a new one posted',
    lines2.filter((l) => l.voided === 1).length === 1
      && lines2.filter((l) => l.voided === 0).length === 1
      && lines2.find((l) => l.voided === 0)?.amount_minor === -1_500, lines2.map((l) => [l.voided, l.amount_minor]));
  check('folio balance follows too', b2.balanceMinor === -1_500, b2.balanceMinor);
  res.updateReservation(P, A, booking.id, { otaCollectedMinor: null });
  const b3 = res.getReservationDetail(P, booking.id);
  check('clearing the amount takes the booking out of the split', b3.businessMinor === null);
  check('and removes the credit', creditLines(booking.id).every((l) => l.voided === 1));
  res.updateReservation(P, A, booking.id, { otaCollectedMinor: 1_200 });
  check('putting it back posts it again', creditLines(booking.id).filter((l) => l.voided === 0).length === 1);

  section('6 · The whole stay: post the nights, take the business price, check out clean');
  // Arriving today, so it can be checked in on the open business date.
  const stay = book(P, RT, RP, {
    arrival: TODAY, departure: addDays(TODAY, 3),
    source: 'OTA', channelCode: 'BEDS24', otaChannel: 'Hostelworld', otaReference: 'HW-STAY',
    origin: 'channel', force: true,
    otaTotalMinor: 10_000, totalOverrideMinor: 10_000, otaCollectedMinor: 1_200,
  });
  hw.syncCollectedCredit(P, A, stay.id, policy);
  res.assignRoom(P, A, stay.id, { auto: true });
  res.checkIn(P, A, stay.id, {});
  run('UPDATE properties SET business_date = ? WHERE id = ?', addDays(TODAY, 3), P);
  res.postOutstandingNights(P, A, stay.id, addDays(TODAY, 3));
  const b4 = res.getReservationDetail(P, stay.id);
  check('with every night posted the balance is the business price', b4.balanceMinor === 8_800, b4.balanceMinor);
  folio.postPayment(P, A, {
    folioId: b4.folios[0].id, method: 'Cash', amountMinor: 8_800, businessDate: addDays(TODAY, 3),
  });
  const b5 = res.getReservationDetail(P, stay.id);
  check('paying the business price settles the folio', b5.balanceMinor === 0, b5.balanceMinor);
  let checkedOut = false;
  try { res.checkOut(P, A, stay.id, {}); checkedOut = true; } catch (e) { check('check-out threw', false, String(e)); }
  check('check-out closes at zero', checkedOut);
  run('UPDATE properties SET business_date = ? WHERE id = ?', TODAY, P);

  section('7 · Cancellation and no-show take the credit off again');
  const cxl = book(P, RT, RP, {
    source: 'OTA', channelCode: 'BEDS24', otaChannel: 'Hostelworld', otaReference: 'HW-CXL',
    origin: 'channel', force: true, otaTotalMinor: 6_000, totalOverrideMinor: 6_000,
    otaCollectedMinor: 900,
  });
  hw.syncCollectedCredit(P, A, cxl.id, policy);
  check('credit posted on the new booking', creditLines(cxl.id).filter((l) => l.voided === 0).length === 1);
  res.cancelReservation(P, A, cxl.id, { reason: 'Guest cancelled on Hostelworld' });
  check('cancelling strikes it', creditLines(cxl.id).every((l) => l.voided === 1));
  check('so the cancelled folio owes nobody anything', res.reservationBalance(cxl.id) === 0);
  const ns = book(P, RT, RP, {
    source: 'OTA', channelCode: 'BEDS24', otaChannel: 'Hostelworld', otaReference: 'HW-NS',
    origin: 'channel', force: true, otaTotalMinor: 6_000, totalOverrideMinor: 6_000,
    otaCollectedMinor: 900,
  });
  hw.syncCollectedCredit(P, A, ns.id, policy);
  run('UPDATE properties SET business_date = ? WHERE id = ?', addDays(IN, 1), P);
  res.markNoShow(P, A, ns.id, { chargeMinor: 2_000 });
  check('a no-show strikes it', creditLines(ns.id).every((l) => l.voided === 1));
  check('and the no-show fee stands in full', res.reservationBalance(ns.id) === 2_000, res.reservationBalance(ns.id));
  run('UPDATE properties SET business_date = ? WHERE id = ?', TODAY, P);

  section('8 · Settings reach the bookings on the books');
  const legacy = book(P, RT, RP, {
    source: 'OTA', channelCode: 'BEDS24', otaChannel: 'Hostelworld', otaReference: 'HW-OLD',
    origin: 'channel', force: true,
  });
  check('a booking imported before the switch has no collected amount', legacy.otaCollectedMinor === null);
  const saved = hw.applyPolicyToBookings(P, A, { fillMissing: false });
  check('saving alone does not invent a figure for it', res.getReservationDetail(P, legacy.id).otaCollectedMinor === null, saved);
  const applied = hw.applyPolicyToBookings(P, A, { fillMissing: true });
  const legacy2 = res.getReservationDetail(P, legacy.id);
  check('"apply to existing" gives it the percentage of its total', legacy2.otaCollectedMinor === Math.round(RATE * 3 * 0.15), legacy2.otaCollectedMinor);
  check('and posts its credit', applied.filled >= 1 && creditLines(legacy.id).filter((l) => l.voided === 0).length === 1, applied);
  hw.saveHostelworldPolicy(P, A, { postCredit: false });
  hw.applyPolicyToBookings(P, A, {});
  check('turning the credit off strikes every live line',
    creditLines(legacy.id).every((l) => l.voided === 1) && creditLines(booking.id).every((l) => l.voided === 1));
  const noCredit = res.getReservationDetail(P, legacy.id);
  check('while the figures are still shown', noCredit.businessMinor !== null && noCredit.otaCreditMinor === 0);
  hw.saveHostelworldPolicy(P, A, { postCredit: true });
  hw.applyPolicyToBookings(P, A, {});
  check('turning it back on posts them again, and the departed stay still carries exactly one',
    creditLines(legacy.id).filter((l) => l.voided === 0).length === 1
      && creditLines(stay.id).filter((l) => l.voided === 0).length === 1);
  hw.saveHostelworldPolicy(P, A, { enabled: false });
  hw.applyPolicyToBookings(P, A, {});
  check('switching the whole thing off hides the split and removes the credit',
    res.getReservationDetail(P, legacy.id).businessMinor === null
      && creditLines(legacy.id).every((l) => l.voided === 1));

  section('9 · What the connector reads from Beds24');
  const n1 = normaliseBooking({ id: 1, referer: 'Hostelworld', price: 100, deposit: 15, commission: 15 });
  check('the deposit field is read', n1.depositMajor === 15 && n1.totalMajor === 100);
  const n2 = normaliseBooking({
    id: 2, referer: 'Hostelworld', price: 100, commission: 12,
    invoiceItems: [
      { type: 'charge', description: 'Room', amount: 100, qty: 1 },
      { type: 'payment', description: 'Hostelworld deposit', amount: -12, qty: 1 },
      { type: 'payment', description: 'Cash at desk', amount: -50, qty: 1 },
    ],
  });
  check('without a deposit field, the Hostelworld payment line is read and a desk payment is not', n2.depositMajor === 12, n2.depositMajor);
  const n3 = normaliseBooking({ id: 3, referer: 'Booking.com', price: 80 });
  check('nothing is invented when Beds24 said nothing', n3.depositMajor === 0);

  section('10 · A booking imported before the switch, re-read from the channel');
  // The Fun Bunk's own case: Hostelworld said 64.39 with a 19.32 deposit; the
  // PMS had priced the stay from its rate plan at something else entirely.
  const { backfillOtaMoney } = await import('../src/services/channels.ts');
  hw.saveHostelworldPolicy(P, A, { enabled: true, postCredit: true, useChannelTotal: true, percentBp: 1_500 });
  const policyOn = hw.hostelworldPolicy(P);
  const old = book(P, RT, RP, {
    arrival: addDays(TODAY, 20), departure: addDays(TODAY, 27),
    source: 'OTA', channelCode: 'BEDS24', otaChannel: 'Hostelworld.com', otaReference: '93684853',
    origin: 'channel', force: true,
  });
  check('priced from the rate plan, no channel figures', old.totalMinor === RATE * 7 && old.otaTotalMinor === null);
  const fromChannel = normaliseBooking({
    id: 93684853, referer: 'Hostelworld.com', price: 64.39, deposit: 19.32, commission: 19.32,
    arrival: addDays(TODAY, 20), departure: addDays(TODAY, 27), status: 'confirmed',
  });
  const did = backfillOtaMoney(P, A, get<any>('SELECT * FROM reservations WHERE id = ?', old.id), fromChannel, policyOn);
  const old2 = res.getReservationDetail(P, old.id);
  check('the stay is re-priced to Hostelworld\'s total', did.repriced && old2.totalMinor === 6_439, old2.totalMinor);
  check('the seven nights add up to it exactly',
    old2.nightRows.reduce((s: number, n: any) => s + n.rateMinor, 0) === 6_439);
  check('the channel total is kept as a fact', old2.otaTotalMinor === 6_439);
  check('collected is Hostelworld\'s deposit, not the percentage', old2.otaCollectedMinor === 1_932, old2.otaCollectedMinor);
  check('business price is the balance due on arrival', old2.businessMinor === 4_507, old2.businessMinor);
  check('and the credit on the folio matches', old2.otaCreditMinor === 1_932);
  check('reading it again changes nothing',
    backfillOtaMoney(P, A, get<any>('SELECT * FROM reservations WHERE id = ?', old.id), fromChannel, policyOn).changed === false);
  res.updateReservation(P, A, old.id, { otaCollectedMinor: 2_000 });
  const silent = normaliseBooking({
    id: 93684853, referer: 'Hostelworld.com', price: 64.39,
    arrival: addDays(TODAY, 20), departure: addDays(TODAY, 27), status: 'confirmed',
  });
  backfillOtaMoney(P, A, get<any>('SELECT * FROM reservations WHERE id = ?', old.id), silent, policyOn);
  check('a hand-typed amount survives a poll that carries no deposit',
    res.getReservationDetail(P, old.id).otaCollectedMinor === 2_000);
  backfillOtaMoney(P, A, get<any>('SELECT * FROM reservations WHERE id = ?', old.id), fromChannel, policyOn);
  check('but a deposit the channel does send wins over it',
    res.getReservationDetail(P, old.id).otaCollectedMinor === 1_932);
  // A night already charged pins the price: the folio and the stay must agree.
  run('UPDATE reservation_nights SET posted = 1 WHERE reservation_id = ? AND date = ?', old.id, addDays(TODAY, 20));
  const dearer = normaliseBooking({ ...fromChannel.raw as object, price: 70 });
  backfillOtaMoney(P, A, get<any>('SELECT * FROM reservations WHERE id = ?', old.id), dearer, policyOn);
  const old3 = res.getReservationDetail(P, old.id);
  check('once a night is posted the total is not re-priced', old3.totalMinor === 6_439, old3.totalMinor);
  check('though the channel\'s new total is still recorded', old3.otaTotalMinor === 7_000);
  hw.saveHostelworldPolicy(P, A, { useChannelTotal: false });
  const fresh = book(P, RT, RP, {
    arrival: addDays(TODAY, 30), departure: addDays(TODAY, 32),
    source: 'OTA', channelCode: 'BEDS24', otaChannel: 'Hostelworld', otaReference: 'HW-KEEP',
    origin: 'channel', force: true,
  });
  backfillOtaMoney(P, A, get<any>('SELECT * FROM reservations WHERE id = ?', fresh.id),
    normaliseBooking({ id: 'HW-KEEP', referer: 'Hostelworld', price: 10, deposit: 3, status: 'confirmed' }),
    hw.hostelworldPolicy(P));
  const fresh2 = res.getReservationDetail(P, fresh.id);
  check('with "use the channel total" off the rate-plan price is kept', fresh2.totalMinor === RATE * 2);
  check('while the deposit is still applied against it', fresh2.otaCollectedMinor === 300 && fresh2.businessMinor === RATE * 2 - 300);

  section('11 · The real Beds24 payload: `price` is the balance due, `commission` is the deposit');
  // Booking 93684853 as Beds24 actually sent it, dates shifted into the
  // future. Hostelworld's email said Total 64.39 · Deposit 19.32 · Balance
  // due 45.07; Beds24 said price 45.07, deposit 0, commission 19.32, and put
  // the whole story in `rateDescription`. Room 732619 was on sale at 8.50
  // for the first night and 10.00 for the rest — a 6% promotion throughout.
  function realPayload(bookingId: string | number, from: string) {
    const nights = [0, 1, 2, 3, 4, 5, 6].map((i) =>
      `${addDays(from, i)}, 1 pax, USD ${i === 0 ? '7.99' : '9.40'} per bed, rate id 2032723`);
    return {
      id: bookingId, propertyId: 355502, roomId: 732619, status: 'new',
      arrival: from, departure: addDays(from, 7), numAdult: 1, numChild: 0,
      firstName: 'Sipsu', lastName: 'Hyttinen', referer: 'Hostelworld.com', channel: 'hostelworld',
      apiSource: 'Hostelworld', apiReference: '336798-580229521', bookingTime: '2026-09-25T13:39:04Z',
      invoiceItems: [{ type: 'charge', description: '[ROOMNAME1] [FIRSTNIGHT] - [LEAVINGDAY]', qty: 1, amount: 45.07, lineTotal: 45.07 }],
      infoItems: [{ code: 'HOTELCOLLECT', text: 'Guest pays 45.07 USD OTA pays 0.00 USD' }],
      price: 45.07, deposit: 0, tax: 0, commission: 19.32,
      rateDescription: 'Paid USD 19.32\nDue USD 45.07\nCancellable until 2026-09-28 23:59:59\n'
        + 'Free Cancellable until 2026-09-28 18:29:59\n' + nights.join('\n'),
    };
  }
  const sellPrices = (b: any) => new Map<string, number>(b.nightly.map((n: any, i: number) => [n.date, i === 0 ? 8.5 : 10]));
  const real = normaliseBooking(realPayload(93684853, addDays(TODAY, 40)));
  check('the booking price is paid + due — what the email calls Total Price', real.totalMajor === 64.39, real.totalMajor);
  check('not Beds24\'s `price`, which is the balance due', real.priceMajor === 45.07 && real.dueMajor === 45.07);
  check('the deposit is what Hostelworld says was paid', real.depositMajor === 19.32, real.depositMajor);
  check('seven nightly prices are read and add up to the total',
    real.nightly.length === 7 && Math.round(real.nightly.reduce((s, n) => s + n.rateMajor, 0) * 100) === 6_439);
  check('the reference, booking time and deadlines come along',
    real.otaBookingRef === '336798-580229521' && real.bookedAt === '2026-09-25T13:39:04Z'
      && real.freeCancellableUntil === '2026-09-28 18:29:59' && real.cancellableUntil === '2026-09-28 23:59:59');
  check('so does who collects what', real.collectNote?.startsWith('HOTELCOLLECT') === true, real.collectNote);
  const noDesc = normaliseBooking({ ...realPayload(1, addDays(TODAY, 40)), rateDescription: '' });
  check('without the description, price + commission reaches the same total',
    noDesc.totalMajor === 64.39 && noDesc.depositMajor === 19.32 && noDesc.dueMajor === 45.07, noDesc);
  const bdc = normaliseBooking({ id: 2, referer: 'Booking.com', price: 45.07, commission: 6.76 });
  check('another channel\'s commission is not added to its price', bdc.totalMajor === 45.07 && bdc.depositMajor === 0);

  const statement = hw.buildHostelworldDetail(real, sellPrices(real));
  check('the statement carries the three email figures',
    statement.totalMinor === 6_439 && statement.paidMinor === 1_932 && statement.dueMinor === 4_507, statement);
  check('the promotion is 6% off every night: on sale 68.50, sold 64.39',
    statement.promotion?.percentBp === 600 && statement.promotion?.listMinor === 6_850
      && statement.promotion?.discountMinor === 411 && statement.promotion?.uniform === true
      && statement.promotion?.nights === 7, statement.promotion);
  check('each night shows what was on sale beside what it sold for',
    statement.nights[0].sellMinor === 850 && statement.nights[0].rateMinor === 799
      && statement.nights[1].sellMinor === 1_000 && statement.nights[1].rateMinor === 940);
  const again = hw.buildHostelworldDetail(real, null, statement);
  check('re-read without the calendar, the sell prices on record are kept',
    hw.sameHostelworldDetail(again, statement) && again.promotion?.percentBp === 600);
  check('a night sold above the sell price is not a negative promotion',
    hw.promotionFrom([{ date: 'x', pax: 1, rateMinor: 1_000, sellMinor: 900, rateId: null }]) === null);
  const partial = hw.buildHostelworldDetail(real, new Map([[real.nightly[0].date, 8.5]]));
  check('with one night priced, the promotion covers only that night',
    partial.promotion?.nights === 1 && partial.promotion?.discountMinor === 51 && partial.promotion?.percentBp === 600,
    partial.promotion);
  const spread = hw.channelNightRates(statement, dateRange(real.arrival, real.departure), 6_439);
  check('the nightly spread is Hostelworld\'s own', spread?.[0] === 799 && spread?.[6] === 940 && spread?.length === 7, spread);
  check('and is refused when it does not reach the total', hw.channelNightRates(statement, dateRange(real.arrival, real.departure), 6_440) === null);

  hw.saveHostelworldPolicy(P, A, { enabled: true, useChannelTotal: true, postCredit: true, collectedMode: 'channel' });
  const realPolicy = hw.hostelworldPolicy(P);
  const imported = book(P, RT, RP, {
    arrival: real.arrival, departure: real.departure,
    source: 'OTA', channelCode: 'BEDS24', otaChannel: real.channel, otaReference: real.externalId,
    origin: 'channel', force: true,
    otaTotalMinor: 6_439, totalOverrideMinor: 6_439, nightRatesMinor: spread,
    otaCollectedMinor: hw.resolveCollected(realPolicy, 6_439, { depositMinor: 1_932, commissionMinor: 1_932 }),
    otaDetail: statement,
  });
  hw.syncCollectedCredit(P, A, imported.id, realPolicy);
  const imp = res.getReservationDetail(P, imported.id);
  check('imported new, the stay total is Hostelworld\'s booking price', imp.totalMinor === 6_439, imp.totalMinor);
  check('the first night is 7.99 and the rest 9.40 — not 9.19 seven times',
    imp.nightRows[0].rateMinor === 799 && imp.nightRows.slice(1).every((n: any) => n.rateMinor === 940),
    imp.nightRows.map((n: any) => n.rateMinor));
  check('collected is the deposit, business price is the balance due', imp.otaCollectedMinor === 1_932 && imp.businessMinor === 4_507);
  check('the statement is on the booking for the screens',
    imp.hostelworldDetail?.promotion?.percentBp === 600 && imp.hostelworldDetail?.ref === '336798-580229521');

  // The deployed case: imported when `price` was taken as the total, so the
  // desk saw 45.07 with the deposit taken off it *again*.
  const wrong = book(P, RT, RP, {
    arrival: addDays(TODAY, 50), departure: addDays(TODAY, 57),
    source: 'OTA', channelCode: 'BEDS24', otaChannel: 'Hostelworld.com', otaReference: 'HW-WRONG',
    origin: 'channel', force: true, otaTotalMinor: 4_507, totalOverrideMinor: 4_507, otaCollectedMinor: 1_932,
  });
  hw.syncCollectedCredit(P, A, wrong.id, realPolicy);
  check('priced at the balance due, with the deposit taken off it again', wrong.totalMinor === 4_507 && wrong.businessMinor === 2_575);
  const fix = normaliseBooking(realPayload('HW-WRONG', addDays(TODAY, 50)));
  const fixStatement = hw.buildHostelworldDetail(fix, sellPrices(fix));
  const didFix = backfillOtaMoney(P, A, get<any>('SELECT * FROM reservations WHERE id = ?', wrong.id), fix, realPolicy, fixStatement);
  const fixed = res.getReservationDetail(P, wrong.id);
  check('Refresh from Beds24 re-prices it to the booking price', didFix.repriced && fixed.totalMinor === 6_439 && fixed.otaTotalMinor === 6_439, fixed.totalMinor);
  check('in Hostelworld\'s own spread', fixed.nightRows[0].rateMinor === 799 && fixed.nightRows[6].rateMinor === 940);
  check('business price becomes the balance due, and the credit stays the deposit',
    fixed.businessMinor === 4_507 && fixed.otaCreditMinor === 1_932, [fixed.businessMinor, fixed.otaCreditMinor]);
  check('and the statement is stored', fixed.hostelworldDetail?.promotion?.discountMinor === 411);
  check('a second read changes nothing',
    backfillOtaMoney(P, A, get<any>('SELECT * FROM reservations WHERE id = ?', wrong.id), fix, realPolicy,
      hw.buildHostelworldDetail(fix, null, fixStatement)).changed === false);
  // An even spread from before the nightly prices were read is re-spread on the next read.
  run('UPDATE reservation_nights SET rate_minor = ? WHERE reservation_id = ?', 919, wrong.id);
  run('UPDATE reservation_nights SET rate_minor = ? WHERE reservation_id = ? AND date = ?', 925, wrong.id, addDays(TODAY, 56));
  const respread = backfillOtaMoney(P, A, get<any>('SELECT * FROM reservations WHERE id = ?', wrong.id), fix, realPolicy, fixStatement);
  check('an even spread of the same total is re-spread the way Hostelworld sold it',
    respread.repriced && res.getReservationDetail(P, wrong.id).nightRows[0].rateMinor === 799);

  process.stdout.write(`\n${checks} checks, ${failures} failure${failures === 1 ? '' : 's'}\n`);
  // Windows keeps the SQLite file open until the process exits, so a failed
  // clean-up is noise rather than a finding.
  try { rmSync(workdir, { recursive: true, force: true }); } catch { /* left for the OS */ }
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  // Windows keeps the SQLite file open until the process exits, so a failed
  // clean-up is noise rather than a finding.
  try { rmSync(workdir, { recursive: true, force: true }); } catch { /* left for the OS */ }
  process.exit(1);
});
