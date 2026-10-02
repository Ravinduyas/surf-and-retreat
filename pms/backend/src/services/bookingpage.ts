// ─────────────────────────────────────────────────────────────
// The booking page.
//
// A property that has set up its rooms has a working booking page, at
// http://<this api>/book, with no second step. There is nothing to build, no
// bundle to deploy, no site to brand and no separate service to keep running:
// the page is one HTML document served by this API, and everything on it —
// the property's name, its rooms, its prices, its currency, what is free
// tonight — is read at request time from the same tables the front desk works
// from. Change a rate in the PMS and the next guest to open the page is quoted
// the new one.
//
// This replaces a whole separate React site that shipped its own hardcoded
// room list and price table, had to be built and deployed on its own, and drifted
// out of step with the PMS the moment anybody edited a rate.
//
// Only the settings that describe the page are injected server-side. The rooms
// and prices are fetched by the browser from the public endpoints in
// `publicbooking.ts`, which is what makes the page correct for whichever dates
// the guest actually picks rather than for the moment it was served.
// ─────────────────────────────────────────────────────────────
import { get } from '../db.ts';
import { publicProperty } from './publicbooking.ts';

/** Page copy, editable in the PMS under Configuration → Booking page. */
export interface BookingPageSettings {
  enabled: boolean;
  tagline: string;
  intro: string;
}

const DEFAULTS: BookingPageSettings = {
  enabled: true,
  tagline: 'Beds and private rooms, booked direct.',
  intro: 'Book straight with us — the same rooms the big sites list, without their commission.',
};

function setting<T>(propertyId: string, key: string, fallback: T): T {
  const row = get<{ value: string }>(
    'SELECT value FROM settings WHERE property_id = ? AND key = ?', propertyId, key);
  if (!row) return fallback;
  try {
    const parsed = JSON.parse(row.value);
    return (parsed === null || parsed === undefined) ? fallback : parsed as T;
  } catch {
    return fallback;
  }
}

export function bookingPageSettings(propertyId: string): BookingPageSettings {
  return {
    enabled: setting(propertyId, 'booking_engine.enabled', DEFAULTS.enabled),
    tagline: setting(propertyId, 'booking_engine.tagline', DEFAULTS.tagline),
    intro: setting(propertyId, 'booking_engine.intro', DEFAULTS.intro),
  };
}

/**
 * Text going into HTML.
 *
 * The property's own name and copy pass through here on the way into the page.
 * They are typed by a person in the PMS, so they are not hostile — but they
 * are also not HTML, and a hostel called "Ben & Jerry's" should not break its
 * own page.
 */
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** The same, for a value being embedded in the page's inline script. */
function json(v: unknown): string {
  return JSON.stringify(v).replace(/</g, '\\u003c');
}

/**
 * The page a guest sees when the property has not switched its booking page on.
 * Deliberately a plain, quiet page rather than an error: the link may already
 * be printed on a card somewhere.
 */
function offPage(name: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100dvh; display:grid; place-items:center;
         font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
         background:#faf9f7; color:#1c1917; padding:24px; }
  @media (prefers-color-scheme: dark) { body { background:#12110f; color:#f5f5f4; } }
  main { max-width:32rem; text-align:center; }
  h1 { font-size:1.5rem; margin:0 0 .5rem; }
  p { margin:0; opacity:.7; }
</style></head>
<body><main>
  <h1>${esc(name)}</h1>
  <p>Online booking is closed at the moment. Please get in touch with us directly.</p>
</main></body></html>`;
}

export function bookingPageHtml(propertyId: string): string {
  const property = publicProperty(propertyId);
  const settings = bookingPageSettings(propertyId);
  if (!settings.enabled) return offPage(property.name);

  const boot = {
    propertyCode: property.code,
    name: property.name,
    tagline: settings.tagline,
    intro: settings.intro,
    checkInTime: property.check_in_time,
    checkOutTime: property.check_out_time,
    email: property.email,
    phone: property.phone,
    city: property.city,
    country: property.country,
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Book — ${esc(property.name)}</title>
<meta name="description" content="${esc(settings.tagline)}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%9B%8F%EF%B8%8F%3C/text%3E%3C/svg%3E">
<style>
  :root {
    color-scheme: light dark;
    --bg: #faf9f7;
    --surface: #ffffff;
    --surface-2: #f4f2ef;
    --line: #e3dfd9;
    --text: #1c1917;
    --muted: #6f6a63;
    --accent: #b4491f;
    --accent-text: #ffffff;
    --good: #2f6f4e;
    --bad: #a3341f;
    --radius: 14px;
    --shadow: 0 1px 2px rgba(28,25,23,.06), 0 8px 24px rgba(28,25,23,.05);
  }
  :root:not([data-theme="light"]) {
    @media (prefers-color-scheme: dark) {
      --bg: #12110f; --surface: #1c1a17; --surface-2: #24211d; --line: #34302b;
      --text: #f5f3f0; --muted: #a8a29a; --accent: #e8703f; --accent-text: #1c1209;
      --good: #6fd19a; --bad: #f08a70;
      --shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.3);
    }
  }
  :root[data-theme="dark"] {
    --bg: #12110f; --surface: #1c1a17; --surface-2: #24211d; --line: #34302b;
    --text: #f5f3f0; --muted: #a8a29a; --accent: #e8703f; --accent-text: #1c1209;
    --good: #6fd19a; --bad: #f08a70;
    --shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.3);
  }

  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 62rem; margin: 0 auto; padding: 0 16px 96px; }

  header { padding: 40px 0 24px; }
  h1 { font-size: clamp(1.6rem, 4vw, 2.3rem); margin: 0 0 6px; letter-spacing: -.02em; }
  .tagline { color: var(--muted); margin: 0 0 4px; font-size: 1.05rem; }
  .intro { color: var(--muted); margin: 0; max-width: 42rem; font-size: .94rem; }
  .where { font-size: .8rem; text-transform: uppercase; letter-spacing: .08em;
           color: var(--muted); margin: 0 0 10px; }

  .card { background: var(--surface); border: 1px solid var(--line);
          border-radius: var(--radius); box-shadow: var(--shadow); }

  /* ── search ── */
  form.search { padding: 16px; display: grid; gap: 12px;
                grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); align-items: end; }
  label { display: block; font-size: .78rem; font-weight: 600; letter-spacing: .03em;
          text-transform: uppercase; color: var(--muted); margin-bottom: 5px; }
  input, select, textarea {
    width: 100%; padding: 10px 12px; font: inherit; font-size: .95rem;
    color: var(--text); background: var(--surface-2);
    border: 1px solid var(--line); border-radius: 9px;
  }
  input:focus-visible, select:focus-visible, textarea:focus-visible, button:focus-visible {
    outline: 2px solid var(--accent); outline-offset: 2px;
  }
  button {
    font: inherit; font-weight: 600; cursor: pointer; border-radius: 9px;
    border: 1px solid transparent; padding: 10px 18px;
    background: var(--accent); color: var(--accent-text);
  }
  button:disabled { opacity: .45; cursor: not-allowed; }
  button.ghost { background: var(--surface-2); color: var(--text); border-color: var(--line); }

  .nights { grid-column: 1 / -1; font-size: .85rem; color: var(--muted); margin: -4px 0 0; }

  /* ── rooms ── */
  h2 { font-size: 1.05rem; margin: 36px 0 12px; letter-spacing: -.01em; }
  .rooms { display: grid; gap: 12px; }
  .room { padding: 16px; display: grid; gap: 12px;
          grid-template-columns: 1fr auto; align-items: start; }
  .room h3 { margin: 0 0 4px; font-size: 1.02rem; letter-spacing: -.01em; }
  .room p { margin: 0 0 8px; color: var(--muted); font-size: .9rem; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag { font-size: .72rem; padding: 2px 8px; border-radius: 999px;
         background: var(--surface-2); border: 1px solid var(--line); color: var(--muted); }
  .tag.female { color: var(--accent); border-color: currentColor; }
  .price { text-align: right; white-space: nowrap; }
  .price .amount { font-size: 1.3rem; font-weight: 700; letter-spacing: -.02em; display: block; }
  .price .unit { font-size: .76rem; color: var(--muted); }
  .left { font-size: .8rem; margin-top: 6px; }
  .left.few { color: var(--accent); font-weight: 600; }
  .left.none { color: var(--muted); }
  .why { font-size: .82rem; color: var(--bad); margin-top: 6px; }

  .stepper { display: inline-flex; align-items: center; gap: 2px; margin-top: 10px;
             border: 1px solid var(--line); border-radius: 9px; background: var(--surface-2); }
  .stepper button { background: none; color: var(--text); border: 0; padding: 6px 13px;
                    font-size: 1.1rem; line-height: 1; }
  .stepper span { min-width: 2ch; text-align: center; font-variant-numeric: tabular-nums;
                  font-weight: 600; }

  /* ── summary ── */
  .summary { position: sticky; bottom: 0; margin-top: 24px; padding: 16px;
             background: var(--surface); }
  .line { display: flex; justify-content: space-between; gap: 16px; font-size: .9rem;
          padding: 3px 0; }
  .line .muted { color: var(--muted); }
  .total { display: flex; justify-content: space-between; align-items: baseline; gap: 16px;
           border-top: 1px solid var(--line); margin-top: 10px; padding-top: 10px;
           font-size: 1.15rem; font-weight: 700; }
  .total small { font-weight: 400; font-size: .78rem; color: var(--muted); }

  /* ── checkout ── */
  .fields { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
  .fields .full { grid-column: 1 / -1; }
  textarea { min-height: 80px; resize: vertical; }

  .note { font-size: .84rem; color: var(--muted); }
  .error { color: var(--bad); font-size: .9rem; margin: 10px 0 0; }
  .ok { color: var(--good); }

  .done { padding: 32px 24px; text-align: center; }
  .done .ref { font-size: 1.6rem; font-weight: 700; letter-spacing: .04em;
               font-family: ui-monospace, "SF Mono", Menlo, monospace; margin: 12px 0; }
  .skeleton { height: 92px; border-radius: var(--radius); background: var(--surface-2);
              animation: pulse 1.4s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: .5; } }

  footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid var(--line);
           color: var(--muted); font-size: .85rem; display: flex; flex-wrap: wrap;
           gap: 6px 20px; }
  footer a { color: inherit; }

  [hidden] { display: none !important; }

  @media (max-width: 560px) {
    .room { grid-template-columns: 1fr; }
    .price { text-align: left; }
  }
</style>
</head>
<body>
<div class="wrap">

  <header>
    <p class="where" id="where"></p>
    <h1 id="name">${esc(property.name)}</h1>
    <p class="tagline">${esc(settings.tagline)}</p>
    <p class="intro">${esc(settings.intro)}</p>
  </header>

  <section class="card" aria-label="Choose your dates">
    <form class="search" id="search">
      <div>
        <label for="checkIn">Check in</label>
        <input type="date" id="checkIn" required>
      </div>
      <div>
        <label for="checkOut">Check out</label>
        <input type="date" id="checkOut" required>
      </div>
      <div>
        <label for="guests">Guests</label>
        <select id="guests"></select>
      </div>
      <div><button type="submit" id="searchBtn">Search</button></div>
      <p class="nights" id="nights"></p>
    </form>
  </section>

  <section id="roomsSection">
    <h2 id="roomsHeading">Rooms &amp; beds</h2>
    <div class="rooms" id="rooms">
      <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
    </div>
  </section>

  <section class="card summary" id="summary" hidden aria-label="Your selection">
    <div id="lines"></div>
    <div class="total">
      <span>Total</span>
      <span><span id="grand"></span> <small id="taxNote"></small></span>
    </div>
    <div id="deposit" hidden style="border-top:1px solid var(--line);margin-top:10px;padding-top:10px"></div>
    <p style="margin:12px 0 0"><button type="button" id="toCheckout">Continue</button></p>
  </section>

  <section class="card" id="checkout" hidden style="margin-top:24px;padding:16px"
           aria-label="Your details">
    <h2 style="margin:0 0 12px">Your details</h2>
    <form id="guestForm" class="fields">
      <div><label for="gName">Full name</label><input id="gName" required autocomplete="name"></div>
      <div><label for="gEmail">Email</label><input id="gEmail" type="email" required autocomplete="email"></div>
      <div><label for="gPhone">Phone <span style="text-transform:none;font-weight:400">(optional)</span></label>
           <input id="gPhone" type="tel" autocomplete="tel"></div>
      <div class="full"><label for="gNotes">Anything we should know?</label>
           <textarea id="gNotes" placeholder="Arrival time, bottom bunk, travelling together…"></textarea></div>
      <div class="full">
        <p class="note" id="policy"></p>
        <p style="margin:12px 0 0"><button type="submit" id="bookBtn">Request booking</button>
        <button type="button" class="ghost" id="backBtn">Back</button></p>
        <p class="error" id="bookError" hidden></p>
      </div>
    </form>
  </section>

  <section class="card done" id="done" hidden aria-live="polite">
    <h2 style="margin:0">Thank you — we have your request</h2>
    <p class="ref" id="ref"></p>
    <p id="doneDetail" class="note"></p>
    <p class="note" id="doneNext"></p>
    <p><button type="button" class="ghost" id="again">Book another stay</button></p>
  </section>

  <footer id="footer"></footer>
</div>

<script>
(function () {
  'use strict';

  var BOOT = ${json(boot)};
  var API = '';                      // same origin as this page, always

  var catalog = null;                // what the property sells
  var offer = null;                  // prices for the dates in the form
  var picked = {};                   // roomTypeId -> units chosen

  var $ = function (id) { return document.getElementById(id); };
  var money = function (minor) {
    var c = (catalog && catalog.currency) || 'USD';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(minor / 100);
    } catch (e) { return c + ' ' + (minor / 100).toFixed(2); }
  };
  var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };

  function addDays(iso, n) {
    var d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function nightsBetween(a, b) {
    return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
  }

  async function api(path) {
    var res = await fetch(API + path, { headers: { accept: 'application/json' } });
    var body = await res.json().catch(function () { return null; });
    if (!res.ok) throw new Error((body && body.error) || ('Request failed (' + res.status + ')'));
    return body;
  }

  // ── Header, footer, guest options ───────────────────────────
  function chrome() {
    var where = [BOOT.city, BOOT.country].filter(Boolean).join(', ');
    $('where').textContent = where;
    var bits = [];
    if (BOOT.email) bits.push('<a href="mailto:' + BOOT.email + '">' + BOOT.email + '</a>');
    if (BOOT.phone) bits.push('<a href="tel:' + BOOT.phone.replace(/\\s/g, '') + '">' + BOOT.phone + '</a>');
    bits.push('Check-in from ' + BOOT.checkInTime + ' · check-out by ' + BOOT.checkOutTime);
    $('footer').innerHTML = bits.join('<span aria-hidden="true">·</span>');

    var sel = $('guests');
    for (var i = 1; i <= 12; i++) {
      var o = document.createElement('option');
      o.value = String(i);
      o.textContent = plural(i, 'guest', 'guests');
      sel.appendChild(o);
    }
  }

  // ── Dates ───────────────────────────────────────────────────
  //
  // Seeded from the property's own business date, not the browser's clock: a
  // guest in another timezone must not be offered a night the property has
  // already closed, and the API refuses a stay that has already started.
  function seedDates() {
    var first = catalog.property.businessDate;
    var ci = $('checkIn'), co = $('checkOut');
    ci.min = first; co.min = addDays(first, 1);
    if (!ci.value) ci.value = addDays(first, 1);
    if (!co.value) co.value = addDays(ci.value, 2);
    ci.addEventListener('change', function () {
      co.min = addDays(ci.value, 1);
      if (co.value <= ci.value) co.value = addDays(ci.value, 1);
      showNights();
    });
    co.addEventListener('change', showNights);
    showNights();
  }
  function showNights() {
    var n = nightsBetween($('checkIn').value, $('checkOut').value);
    $('nights').textContent = n > 0 ? plural(n, 'night', 'nights') : '';
  }

  // ── Rooms ───────────────────────────────────────────────────
  function bedSummary(rt) {
    if (rt.kind === 'dorm') return plural(rt.unitsTotal, 'bed', 'beds') + ' in total';
    return 'Sleeps ' + rt.maxOccupancy;
  }

  /**
   * How many heads sit in each chosen unit.
   *
   * The same rule the API applies when it writes the reservation: every unit
   * takes one guest first, then the rest fill up to occupancy in order. Doing
   * it identically here is what makes the total on screen the total that gets
   * booked — otherwise two doubles for two guests would be priced as one full
   * room and one empty one.
   */
  function distribute() {
    var units = [];
    (catalog.roomTypes || []).forEach(function (rt) {
      for (var i = 0; i < (picked[rt.id] || 0); i++) units.push({ rt: rt, heads: 0 });
    });
    var left = Number($('guests').value);
    units.forEach(function (u) { if (left > 0) { u.heads = 1; left -= 1; } });
    units.forEach(function (u) {
      if (left <= 0) return;
      var cap = u.rt.kind === 'dorm' ? 1 : Math.max(1, u.rt.maxOccupancy);
      var add = Math.min(cap - u.heads, left);
      u.heads += add; left -= add;
    });
    return { units: units, unseated: left };
  }

  /**
   * The deposit split, worked out the same way the server does it.
   *
   * Deliberately recomputed here rather than fetched: the amount depends on
   * what the guest has selected right now, and a round trip per stepper click
   * would make the summary lag behind the choice that caused it. The server
   * recomputes it from its own totals when the booking is written, so this is
   * a display of the rule rather than the source of the number.
   */
  function depositFor(totalMinor, nights) {
    var rule = (offer && offer.deposit) || (catalog && catalog.deposit);
    if (!rule || rule.mode === 'none' || !totalMinor) return null;
    var due = 0, label = '';
    if (rule.mode === 'percent') {
      due = Math.round((totalMinor * (rule.percentBp || 0)) / 10000);
      label = (rule.percentBp / 100).toFixed(rule.percentBp % 100 ? 1 : 0) + '% deposit';
    } else if (rule.mode === 'first_night') {
      due = Math.round(totalMinor / Math.max(1, nights || 1));
      label = 'First night';
    } else if (rule.mode === 'full') {
      due = totalMinor;
      label = 'Full amount';
    }
    due = Math.min(totalMinor, Math.max(0, due));
    return {
      dueNowMinor: due,
      dueOnArrivalMinor: totalMinor - due,
      label: label,
      message: rule.message || ''
    };
  }

  function priceOf(roomTypeId, heads) {
    if (!offer) return null;
    var o = (offer.options || []).find(function (x) { return x.roomTypeId === roomTypeId; });
    if (!o) return null;
    var row = (o.occupancyPrices || []).find(function (p) { return p.occupancy === heads; });
    return row || null;
  }

  function offerFor(id) {
    return offer ? (offer.options || []).find(function (o) { return o.roomTypeId === id; }) : null;
  }

  function renderRooms() {
    var host = $('rooms');
    host.innerHTML = '';
    var types = catalog.roomTypes || [];
    if (!types.length) {
      host.innerHTML = '<p class="note">No rooms are on sale yet.</p>';
      return;
    }

    types.forEach(function (rt) {
      var o = offerFor(rt.id);
      var el = document.createElement('article');
      el.className = 'card room';

      // The gender badge is drawn from the room type's own policy, so an
      // amenity that says the same thing is dropped rather than printed
      // beside it — a female dorm listed "Female only" twice, once in the
      // accent colour and once in grey, which reads as a mistake.
      var tags = [];
      var seen = [];
      if (rt.genderPolicy === 'female') {
        tags.push('<span class="tag female">Female only</span>');
        seen.push('female only');
      }
      (rt.amenities || []).forEach(function (a) {
        var key = String(a).trim().toLowerCase();
        if (tags.length >= 5 || seen.indexOf(key) !== -1) return;
        seen.push(key);
        tags.push('<span class="tag">' + a + '</span>');
      });

      var left = '';
      if (o) {
        var word = rt.kind === 'dorm' ? 'bed' : 'room';
        if (o.available <= 0) left = '<p class="left none">Sold out for these dates</p>';
        else if (o.available <= 3) left = '<p class="left few">Only ' + plural(o.available, word, word + 's') + ' left</p>';
        else left = '<p class="left">' + plural(o.available, word, word + 's') + ' available</p>';
      }

      var why = '';
      if (o && !o.sellable && o.available > 0 && (o.violations || []).length) {
        why = '<p class="why">' + o.violations[0].message + '</p>';
      }

      // Before a search, the catalog's "from" price. After one, the real
      // price for one unit over the chosen dates.
      var amount, unit;
      if (o && o.occupancyPrices && o.occupancyPrices.length) {
        amount = money(o.occupancyPrices[0].averageNightlyMinor);
        unit = 'per ' + (rt.kind === 'dorm' ? 'bed' : 'room') + ', per night';
      } else {
        amount = money(rt.fromNightlyMinor);
        unit = 'from, per ' + (rt.kind === 'dorm' ? 'bed' : 'room') + ' a night';
      }

      el.innerHTML =
        '<div>' +
          '<h3>' + rt.name + '</h3>' +
          '<p>' + (rt.description || bedSummary(rt)) + '</p>' +
          '<div class="tags">' + tags.join('') + '</div>' +
          why +
        '</div>' +
        '<div class="price">' +
          '<span class="amount">' + amount + '</span>' +
          '<span class="unit">' + unit + '</span>' +
          left +
          '<div class="stepper" data-for="' + rt.id + '" hidden>' +
            '<button type="button" data-step="-1" aria-label="One fewer">\\u2212</button>' +
            '<span>0</span>' +
            '<button type="button" data-step="1" aria-label="One more">+</button>' +
          '</div>' +
        '</div>';

      var stepper = el.querySelector('.stepper');
      if (o && o.sellable) {
        stepper.hidden = false;
        stepper.querySelector('span').textContent = String(picked[rt.id] || 0);
        stepper.addEventListener('click', function (ev) {
          var btn = ev.target.closest('button[data-step]');
          if (!btn) return;
          var next = (picked[rt.id] || 0) + Number(btn.dataset.step);
          var ceiling = Math.min(o.available, Number($('guests').value));
          picked[rt.id] = Math.max(0, Math.min(ceiling, next));
          stepper.querySelector('span').textContent = String(picked[rt.id]);
          renderSummary();
        });
      }
      host.appendChild(el);
    });
  }

  // ── Summary ─────────────────────────────────────────────────
  function renderSummary() {
    var plan = distribute();
    var box = $('summary');
    if (!plan.units.length) { box.hidden = true; $('checkout').hidden = true; return; }
    box.hidden = false;

    // One line per room type, with how the party was seated in it.
    var byType = {};
    plan.units.forEach(function (u) {
      var k = u.rt.id;
      byType[k] = byType[k] || { rt: u.rt, units: 0, totalMinor: 0, priced: true };
      var p = priceOf(u.rt.id, u.heads);
      byType[k].units += 1;
      if (p) byType[k].totalMinor += p.grandTotalMinor;
      else byType[k].priced = false;
    });

    var html = '', grand = 0, priced = true;
    Object.keys(byType).forEach(function (k) {
      var row = byType[k];
      grand += row.totalMinor;
      if (!row.priced) priced = false;
      var word = row.rt.kind === 'dorm' ? 'bed' : 'room';
      html += '<div class="line"><span>' + row.rt.name +
              ' <span class="muted">\\u00d7 ' + plural(row.units, word, word + 's') + '</span></span>' +
              '<span>' + (row.priced ? money(row.totalMinor) : '\\u2014') + '</span></div>';
    });

    var nights = offer ? offer.nights : nightsBetween($('checkIn').value, $('checkOut').value);
    html += '<div class="line"><span class="muted">' +
            $('checkIn').value + ' \\u2192 ' + $('checkOut').value +
            ', ' + plural(nights, 'night', 'nights') + '</span><span class="muted">' +
            plural(Number($('guests').value), 'guest', 'guests') + '</span></div>';

    if (plan.unseated > 0) {
      html += '<div class="line"><span class="why">' +
              plural(plan.unseated, 'guest', 'guests') +
              ' still needs a bed. Add another room or bed.</span><span></span></div>';
    }

    $('lines').innerHTML = html;
    $('grand').textContent = priced ? money(grand) : '\\u2014';
    $('taxNote').textContent = (catalog.taxes && catalog.taxes.length) ? 'incl. tax' : '';
    $('toCheckout').disabled = plan.unseated > 0 || !priced;

    // What is actually due before arrival. Shown on the summary rather than
    // saved for the last step: a deposit discovered on the confirmation screen
    // is a deposit the guest never agreed to.
    var split = depositFor(grand, nights);
    var depositBox = $('deposit');
    if (priced && split && split.dueNowMinor > 0) {
      depositBox.hidden = false;
      depositBox.innerHTML =
        '<div class="line"><span><strong>' + split.label + '</strong> to confirm</span>' +
          '<span><strong>' + money(split.dueNowMinor) + '</strong></span></div>' +
        '<div class="line"><span class="muted">Then on arrival</span>' +
          '<span class="muted">' + money(split.dueOnArrivalMinor) + '</span></div>' +
        (split.message ? '<p class="note" style="margin:6px 0 0">' + split.message + '</p>' : '');
    } else {
      depositBox.hidden = true;
    }
  }

  // ── Search ──────────────────────────────────────────────────
  async function search(ev) {
    if (ev) ev.preventDefault();
    var ci = $('checkIn').value, co = $('checkOut').value;
    if (!ci || !co || nightsBetween(ci, co) < 1) return;

    $('searchBtn').disabled = true;
    $('searchBtn').textContent = 'Searching…';
    picked = {};
    $('checkout').hidden = true;
    $('done').hidden = true;
    $('roomsSection').hidden = false;

    try {
      offer = await api('/api/public/booking-engine/availability'
        + '?checkIn=' + ci + '&checkOut=' + co
        + '&adults=' + encodeURIComponent($('guests').value)
        + '&propertyCode=' + encodeURIComponent(BOOT.propertyCode));
      $('roomsHeading').textContent =
        'Available ' + ci + ' \\u2192 ' + co + ', ' + plural(offer.nights, 'night', 'nights');
    } catch (e) {
      offer = null;
      $('roomsHeading').textContent = 'Rooms & beds';
      $('rooms').innerHTML = '<p class="error">' + e.message + '</p>';
      return;
    } finally {
      $('searchBtn').disabled = false;
      $('searchBtn').textContent = 'Search';
    }
    renderRooms();
    renderSummary();
  }

  // ── Booking ─────────────────────────────────────────────────
  async function book(ev) {
    ev.preventDefault();
    var plan = distribute();
    if (!plan.units.length || plan.unseated > 0) return;

    var allocation = [];
    plan.units.forEach(function (u) {
      var found = allocation.find(function (a) { return a.roomTypeId === u.rt.id; });
      if (found) found.qty += 1; else allocation.push({ roomTypeId: u.rt.id, qty: 1 });
    });
    // The booking's headline kind, for an API that needs one. The allocation
    // above is what actually decides the rooms.
    var lead = plan.units[0].rt;

    $('bookBtn').disabled = true;
    $('bookBtn').textContent = 'Sending…';
    $('bookError').hidden = true;

    try {
      var res = await fetch(API + '/api/public/booking-engine/reservations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          propertyCode: BOOT.propertyCode,
          checkIn: $('checkIn').value,
          checkOut: $('checkOut').value,
          model: 'rooms',
          room: {
            people: Number($('guests').value),
            kind: lead.bookingKind,
            roomTypeId: lead.id,
            allocation: allocation
          },
          contact: {
            name: $('gName').value.trim(),
            email: $('gEmail').value.trim(),
            phone: $('gPhone').value.trim() || undefined,
            notes: $('gNotes').value.trim() || undefined
          }
        })
      });
      var body = await res.json().catch(function () { return null; });
      if (!res.ok) throw new Error((body && body.error) || 'We could not take that booking.');
      done(body, plan.units);
    } catch (e) {
      $('bookError').textContent = e.message;
      $('bookError').hidden = false;
    } finally {
      $('bookBtn').disabled = false;
      $('bookBtn').textContent = 'Request booking';
    }
  }

  function done(booking, chosen) {
    $('search').parentElement.hidden = true;
    $('roomsSection').hidden = true;
    $('summary').hidden = true;
    $('checkout').hidden = true;
    $('done').hidden = false;
    $('ref').textContent = booking.confirmation || '';

    /*
     * What was booked, by name.
     *
     * The API itemises this for us only when the party spans more than one
     * room type. A booking of three beds in the same dorm therefore came back
     * with no breakdown at all and the page said "3 rooms and beds" — the
     * vaguest possible wording for the single most common booking a hostel
     * takes, on the one screen the guest is most likely to screenshot. The
     * page already knows what they picked, so it falls back to its own
     * selection rather than to a bare number.
     */
    var what;
    if (booking.bookings && booking.bookings.length) {
      what = booking.bookings.map(function (b) {
        return b.units + ' \\u00d7 ' + b.roomType;
      }).join(', ');
    } else if (chosen && chosen.length) {
      var tally = [];
      chosen.forEach(function (u) {
        var row = tally.find(function (t) { return t.name === u.rt.name; });
        if (row) row.units += 1; else tally.push({ name: u.rt.name, units: 1 });
      });
      what = tally.map(function (t) { return t.units + ' \\u00d7 ' + t.name; }).join(', ');
    } else {
      what = plural(booking.units || 1, 'room or bed', 'rooms and beds');
    }

    $('doneDetail').textContent =
      what + ', ' + $('checkIn').value + ' to ' + $('checkOut').value + '.';
    /*
     * Deliberately not "confirmed": the property has to accept it first, and
     * telling a guest their bed is held when it is not is the one thing a
     * booking page must never do.
     *
     * And deliberately not "you will get an email" either. This system sends
     * no email at all — there is no mail transport in it — so that sentence
     * was a promise nothing could keep, on the one screen a guest screenshots.
     * It says what is actually true: the property has the request and the
     * contact details, and a person will be in touch.
     */
    $('doneNext').textContent =
      BOOT.name + ' has your request and will be in touch at '
      + $('gEmail').value.trim() + ' to confirm. Nothing has been charged. '
      + 'Quote ' + (booking.confirmation || 'your reference') + ' if you contact us.';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Boot ────────────────────────────────────────────────────
  async function start() {
    chrome();
    try {
      catalog = await api('/api/public/booking-engine/catalog?propertyCode='
        + encodeURIComponent(BOOT.propertyCode));
    } catch (e) {
      $('rooms').innerHTML = '<p class="error">' + e.message + '</p>';
      return;
    }
    $('name').textContent = catalog.property.name || BOOT.name;
    document.title = 'Book — ' + (catalog.property.name || BOOT.name);

    var plan = catalog.ratePlan || {};
    // Only promise "nothing is charged" when nothing is in fact asked for.
    // A page that says that and then shows a deposit on the summary is a page
    // the guest stops believing.
    var rule = catalog.deposit || { mode: 'none' };
    $('policy').textContent = [
      plan.refundable ? 'Free cancellation, as per our policy.' : 'This rate is non-refundable.',
      rule.mode === 'none'
        ? 'Nothing is charged now — we will confirm your booking by email first.'
        : (rule.message || 'We will confirm your booking by email and tell you how to pay.'),
      rule.methods && rule.methods.length ? 'We accept: ' + rule.methods.join(', ') + '.' : ''
    ].filter(Boolean).join(' ');

    seedDates();
    renderRooms();
    // Straight into a search on the default dates, so the first thing a guest
    // sees is real prices rather than a form to fill in before anything happens.
    await search();
  }

  $('search').addEventListener('submit', search);
  $('guests').addEventListener('change', function () { picked = {}; search(); });
  $('toCheckout').addEventListener('click', function () {
    $('checkout').hidden = false;
    $('checkout').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('gName').focus();
  });
  $('backBtn').addEventListener('click', function () {
    $('checkout').hidden = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('guestForm').addEventListener('submit', book);
  $('again').addEventListener('click', function () { window.location.reload(); });

  start();
})();
</script>
</body>
</html>`;
}
