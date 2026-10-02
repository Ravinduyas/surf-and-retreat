// ─────────────────────────────────────────────────────────────
// Drives the guest booking page in a real browser.
//
//   node --experimental-strip-types scripts/bookingpage-ui.ts
//
// Chrome must be running with --remote-debugging-port=9222, and the API must
// be up. Nothing else: the page is served by the API itself, so there is no
// front end to build or start first.
//
// The page is the one part of this system a guest touches without a login,
// and it is plain hand-written JavaScript rather than a framework, so the
// things that break it are the things a type-checker cannot see — an element
// that was renamed, a total that adds up differently from the API's, a button
// that stays disabled. All of that only shows up in a browser.
//
// It books a real stay at the end, then says which reservation to delete.
// ─────────────────────────────────────────────────────────────
import { Cdp, CDP_URL, API, sleep } from './lib/cdp.ts';
import { config } from '../src/config.ts';

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

const BOOK = `${API}/book`;

/**
 * Cancel every reservation in the party this check just booked.
 *
 * Signs in as the verification account, which is the same account the other
 * `*-ui` checks use. The party is found by its lead confirmation: a dorm
 * booking is one reservation per bed, linked by `parentId`, and all of them
 * have to go or the beds stay held.
 */
async function cancelParty(confirmation: string): Promise<number> {
  const login: any = await (await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: config.smokeEmail, password: config.smokePassword }),
  })).json();
  if (!login?.token) throw new Error('Could not sign in to clean up the test booking');
  const propertyId = login.property?.id ?? login.properties?.[0]?.id;
  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${login.token}`,
    'x-property-id': String(propertyId),
  };

  const list: any = await (await fetch(
    `${API}/api/reservations?search=${encodeURIComponent(confirmation)}&limit=50`,
    { headers })).json();
  const rows: any[] = Array.isArray(list) ? list : (list?.rows ?? list?.data ?? []);
  const lead = rows.find((r) => r.confirmation === confirmation);
  if (!lead) throw new Error(`Could not find ${confirmation} to clean up`);

  /*
   * Ask the server for the whole party rather than filtering the search.
   *
   * A dorm booking is one reservation per bed linked by `parent_id`, and the
   * reservation list does not return that link — so filtering the search
   * found only the lead, cancelled one bed of three, and left the other two
   * holding inventory into the next run. `/confirmation` returns `members`,
   * which is the same helper the confirm dialog uses and is the one place that
   * knows what a party is.
   */
  const group: any = await (await fetch(
    `${API}/api/reservations/${lead.id}/confirmation`, { headers })).json();
  const party: any[] = Array.isArray(group?.members) && group.members.length
    ? group.members : [lead];

  let cancelled = 0;
  for (const r of party) {
    const res = await fetch(`${API}/api/reservations/${r.id}/cancel`, {
      method: 'POST', headers,
      body: JSON.stringify({ reason: 'Automated booking-page check', chargeMinor: 0 }),
    });
    if (res.ok) cancelled += 1;
  }
  return cancelled;
}

async function main() {
  process.stdout.write(`\nBooking page, in a browser\n${'─'.repeat(26)}\n${BOOK}\n`);

  // Its own tab, opened straight on the booking page. No sign-in: the whole
  // point of this page is that a guest reaches it without one.
  const target: any = await (await fetch(
    `${CDP_URL}/json/new?${encodeURIComponent(BOOK)}`, { method: 'PUT' })).json();
  const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // Anything the page logs as an error is a failure in its own right: the
    // page has no error boundary and a thrown exception simply stops it.
    const consoleErrors: string[] = [];
    cdp.ws.addEventListener('message', (ev: any) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.method === 'Runtime.exceptionThrown') {
        consoleErrors.push(msg.params?.exceptionDetails?.exception?.description
          ?? msg.params?.exceptionDetails?.text ?? 'exception');
      }
    });

    // The page fetches the catalog and then searches on its default dates
    // before it has anything to show, so there are two round trips to wait on.
    await cdp.send('Page.reload');
    await sleep(2500);

    section('1 · The page loads and knows whose it is');
    const head = await cdp.evaluate(`(() => ({
      title: document.title,
      name: document.getElementById('name')?.textContent,
      tagline: document.querySelector('.tagline')?.textContent,
      rooms: document.querySelectorAll('.room').length,
      skeletons: document.querySelectorAll('.skeleton').length,
    }))()`);
    check('the title names the property', /Fun Bunk/.test(head.title), head.title);
    check('so does the heading', /Fun Bunk/.test(head.name ?? ''), head.name);
    check('there is a tagline', (head.tagline ?? '').length > 0, head.tagline);
    check('the room list has rendered', head.rooms === 6, head.rooms);
    check('and the loading placeholders are gone', head.skeletons === 0, head.skeletons);

    section('2 · It searched on its own, before being asked');
    const searched = await cdp.evaluate(`(() => ({
      heading: document.getElementById('roomsHeading')?.textContent,
      checkIn: document.getElementById('checkIn')?.value,
      checkOut: document.getElementById('checkOut')?.value,
      steppers: document.querySelectorAll('.stepper:not([hidden])').length,
      prices: [...document.querySelectorAll('.room .amount')].map((e) => e.textContent),
      units: [...document.querySelectorAll('.room .unit')].map((e) => e.textContent),
    }))()`);
    check('the heading shows the dates it priced',
      /→/.test(searched.heading ?? '') && /night/.test(searched.heading ?? ''), searched.heading);
    check('check-out is after check-in', searched.checkOut > searched.checkIn,
      [searched.checkIn, searched.checkOut]);
    check('every room can be added to a booking', searched.steppers === 6, searched.steppers);
    check('prices are money, in the property\'s currency',
      searched.prices.every((p: string) => /\$\d/.test(p)), searched.prices);
    check('and they are real prices, not "from" estimates',
      searched.units.every((u: string) => /per night$/.test(u)), searched.units);

    section('3 · Choosing a bed adds up');
    // One bed in the first dorm. Its price is the one the API quoted, so the
    // total on screen has to match the API's own answer for the same stay.
    await cdp.evaluate(`(() => {
      const dorm = [...document.querySelectorAll('.room')]
        .find((r) => /Dorm/.test(r.querySelector('h3').textContent));
      dorm.querySelector('.stepper button[data-step="1"]').click();
    })()`);
    await sleep(400);

    const one = await cdp.evaluate(`(() => ({
      visible: !document.getElementById('summary').hidden,
      grand: document.getElementById('grand')?.textContent,
      lines: [...document.querySelectorAll('#lines .line')].map((l) => l.textContent),
      canContinue: !document.getElementById('toCheckout').disabled,
    }))()`);
    check('the summary appears', one.visible === true);
    check('it shows a total', /\$\d/.test(one.grand ?? ''), one.grand);
    // One guest is the page's default, and one bed seats them, so Continue
    // must be live. A disabled button here is the "still needs a bed" branch
    // firing when nobody is unseated.
    check('and the booking can go on', one.canContinue === true, one.lines);

    section('4 · A party bigger than the beds chosen is refused');
    await cdp.evaluate(`(() => {
      const g = document.getElementById('guests');
      g.value = '3';
      g.dispatchEvent(new Event('change'));
    })()`);
    await sleep(2000);  // the guest change re-searches

    const three = await cdp.evaluate(`(() => {
      const dorm = [...document.querySelectorAll('.room')]
        .find((r) => /Dorm/.test(r.querySelector('h3').textContent));
      dorm.querySelector('.stepper button[data-step="1"]').click();
      return null;
    })()`);
    void three;
    await sleep(300);
    const short = await cdp.evaluate(`(() => ({
      canContinue: !document.getElementById('toCheckout').disabled,
      warns: document.getElementById('lines').textContent,
    }))()`);
    check('one bed for three guests cannot continue', short.canContinue === false);
    check('and the page says who is still without a bed',
      /still needs a bed/.test(short.warns ?? ''), short.warns?.slice(0, 120));

    // Two more beds, and the party is seated.
    await cdp.evaluate(`(() => {
      const dorm = [...document.querySelectorAll('.room')]
        .find((r) => /Dorm/.test(r.querySelector('h3').textContent));
      const plus = dorm.querySelector('.stepper button[data-step="1"]');
      plus.click(); plus.click();
    })()`);
    await sleep(400);
    const seated = await cdp.evaluate(`(() => ({
      canContinue: !document.getElementById('toCheckout').disabled,
      grand: document.getElementById('grand')?.textContent,
      count: document.querySelector('.stepper:not([hidden]) span')?.textContent,
    }))()`);
    check('three beds seats three guests', seated.canContinue === true, seated);

    section('5 · The total is the API\'s own, not the browser\'s arithmetic');
    const dates = await cdp.evaluate(`(() => ({
      checkIn: document.getElementById('checkIn').value,
      checkOut: document.getElementById('checkOut').value,
      grandText: document.getElementById('grand').textContent,
      roomTypeName: [...document.querySelectorAll('.room')]
        .find((r) => /Dorm/.test(r.querySelector('h3').textContent))
        .querySelector('h3').textContent,
    }))()`);
    const quote = await fetch(
      `${API}/api/public/booking-engine/availability`
      + `?checkIn=${dates.checkIn}&checkOut=${dates.checkOut}&adults=3`,
    ).then((r) => r.json()) as any;
    const catalog = await fetch(
      `${API}/api/public/booking-engine/catalog`).then((r) => r.json()) as any;
    const rt = catalog.roomTypes.find((r: any) => r.name === dates.roomTypeName);
    const option = quote.options.find((o: any) => o.roomTypeId === rt.id);
    // Three dorm beds, one head each — which is what the page seated.
    const expected = (option.occupancyPrices[0].grandTotalMinor * 3) / 100;
    const shown = Number((dates.grandText ?? '').replace(/[^0-9.]/g, ''));
    check(`the page shows what the API quotes (${expected.toFixed(2)})`,
      Math.abs(shown - expected) < 0.005, { shown, expected });

    section('6 · A booking goes through');
    await cdp.evaluate(`document.getElementById('toCheckout').click()`);
    await sleep(400);
    await cdp.evaluate(`(() => {
      document.getElementById('gName').value = 'Browser Check';
      document.getElementById('gEmail').value = 'browser-check@funbunk.test';
      document.getElementById('gNotes').value = 'Created by bookingpage-ui.ts';
      document.getElementById('guestForm')
        .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()`);
    await sleep(2500);

    const done = await cdp.evaluate(`(() => ({
      shown: !document.getElementById('done').hidden,
      ref: document.getElementById('ref')?.textContent,
      detail: document.getElementById('doneDetail')?.textContent,
      next: document.getElementById('doneNext')?.textContent,
      error: document.getElementById('bookError')?.hidden === false
        ? document.getElementById('bookError').textContent : null,
    }))()`);
    check('the confirmation screen is shown', done.shown === true, done.error);
    check('with a reference the desk can find', /^FUNBUNK-\d{4}-\d{5}$/.test(done.ref ?? ''), done.ref);
    check('it says what was booked', /Dorm/.test(done.detail ?? ''), done.detail);
    /*
     * The two things this sentence must never do.
     *
     * It must not tell the guest the booking is confirmed — the property has
     * not accepted it yet. And it must not promise an email, because this
     * system has no mail transport of any kind: the wording used to say "you
     * will get an email as soon as it is confirmed", which nothing could keep.
     * Asserted on meaning rather than on an exact phrase, so the copy can be
     * reworded without this needing to be.
     */
    const next = String(done.next ?? '');
    check('it does not claim the booking is confirmed',
      !/(is|now) confirmed/i.test(next) && !/^confirmed/i.test(next), next);
    check('it says a person will follow up',
      /(in touch|contact|confirm)/i.test(next), next);
    check('and it promises no email this system cannot send',
      !/(we will |you will )?(get|receive|send you) an email/i.test(next), next);
    check('nothing was charged, and it says so', /nothing has been charged/i.test(next), next);

    section('7 · Nothing threw along the way');
    check('no uncaught exceptions', consoleErrors.length === 0, consoleErrors);

    /*
     * Put the beds back.
     *
     * This check books a real stay, and a website booking now *holds* its beds
     * — so leaving it behind changed the availability the next run saw. The
     * next run then picked a different dorm, priced a different total, and
     * failed on assertions that were perfectly correct. A check that is not
     * repeatable is not a check.
     */
    if (done.ref) {
      const cleaned = await cancelParty(String(done.ref));
      process.stdout.write(
        `
  Booked and cancelled ${done.ref} (${cleaned} reservation(s), `
        + `${dates.checkIn} → ${dates.checkOut}). The beds are back.
`);
      check('the beds it took were given back', cleaned > 0, cleaned);
    }
  } finally {
    cdp.close();
  }

  process.stdout.write(`\n${checks - failures}/${checks} booking-page checks passed\n`);
  if (failures) { process.exitCode = 1; return; }
  process.stdout.write('A guest can find the rooms, price a stay and book it.\n');
}

try {
  await main();
} catch (e) {
  process.stderr.write(`\nAborted: ${e instanceof Error ? e.stack : String(e)}\n`);
  process.stderr.write(
    '\nThis needs Chrome on --remote-debugging-port=9222 and the API running.\n');
  process.exitCode = 1;
}
