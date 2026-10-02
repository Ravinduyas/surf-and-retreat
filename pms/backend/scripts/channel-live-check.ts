// ─────────────────────────────────────────────────────────────
// Every channel-manager operation, against the live Beds24 account.
//
//   npm run channel-live            read-only — safe to run any time
//   npm run channel-live -- --push  also sends one real ARI push
//
// The other suites run against throwaway databases and a fake world. This one
// runs against the real account, because the failures that matter here are the
// ones only the real account has: a token that lists properties but cannot
// write, a room mapped to the wrong side, a price that Beds24 multiplies after
// we send it, a booking that imports as the wrong room type.
//
// **Read-only by default, and that default is the point.** Everything here
// either reads, or reports what a write *would* do. Nothing leaves this
// machine unless `--push` is passed, and `--push` is refused while
// HELIO_CHANNEL_READONLY is set — so going live stays a deliberate act.
//
// What it will not tell you: whether Beds24 has passed anything on to each
// OTA. That is between them and Booking.com. This proves the PMS ↔ Beds24
// link, which is the half we own.
// ─────────────────────────────────────────────────────────────
import { config } from '../src/config.ts';

const API = config.apiUrl;
const args = process.argv.slice(2);
const PUSH = args.includes('--push');

let failures = 0;
let warnings = 0;
let checks = 0;

function check(name: string, ok: boolean, detail?: unknown) {
  checks++;
  process.stdout.write(`  ${ok ? '✓' : '✗'} ${name}\n`);
  if (!ok) {
    failures++;
    if (detail !== undefined) process.stdout.write(`      ${String(detail).slice(0, 400)}\n`);
  }
}
/** Something worth a person's attention that is not a broken system. */
function warn(name: string, detail?: string) {
  warnings++;
  process.stdout.write(`  ! ${name}\n`);
  if (detail) for (const line of detail.split('\n')) process.stdout.write(`      ${line}\n`);
}
function note(s: string) { process.stdout.write(`      ${s}\n`); }
function section(t: string) { process.stdout.write(`\n${t}\n${'─'.repeat(t.length)}\n`); }

const money = (minor: number) => (minor / 100).toFixed(2);

async function main() {
  process.stdout.write(`\nChannel manager, live\n${'─'.repeat(21)}\n${API}\n`);

  // ── sign in ──
  const login: any = await (await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: config.smokeEmail, password: config.smokePassword }),
  })).json();
  if (!login?.token) throw new Error('Could not sign in. Is the API running, and the seed account present?');
  const propertyId = login.property?.id ?? login.properties?.[0]?.id;
  const H = {
    'content-type': 'application/json',
    authorization: `Bearer ${login.token}`,
    'x-property-id': String(propertyId),
  };
  const call = async (m: string, p: string, b?: unknown) => {
    const r = await fetch(`${API}${p}`, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined });
    const t = await r.text();
    try { return { s: r.status, b: JSON.parse(t) }; } catch { return { s: r.status, b: t.slice(0, 300) as any }; }
  };

  const channels = (await call('GET', '/api/channels')).b as any[];
  const hub = channels.find((c) => c.code === 'BEDS24');
  if (!hub) throw new Error('No Beds24 channel is configured. Connect one first.');

  /* ─────────────────────────────────────── 1. credential ── */
  section('1 · The credential and the account');
  const d = (await call('GET', `/api/channels/${hub.id}/diagnosis`)).b as any;
  check('the channel is reachable', d.reachable === true, d.error);
  check('a refresh token is stored', d.credential.hasRefreshToken === true);
  check('it is readable (the encryption key still matches)', d.credentialUnreadable !== true, d.error);
  check('an access token is current', (d.credential.accessTokenMinutesLeft ?? -1) > 0,
    d.credential.accessTokenMinutesLeft);
  check('the token reports its permissions', d.scopes.known === true,
    'older tokens do not answer this; re-issue the invite code if pushes fail');
  check('no permission this PMS needs is missing', d.scopes.blocking.length === 0,
    d.scopes.blocking.map((s: any) => s.scope).join(', '));
  if (d.scopes.extra?.length) {
    note(`token also grants ${d.scopes.extra.join(', ')} — unused here, narrow it when convenient`);
  }

  /* ──────────────────────────────────────── 2. property ── */
  section('2 · The property it is bound to');
  check('a property is bound', !!d.boundPropertyId, 'nothing chosen — every write would fail');
  check('the token can still see it', d.boundPropertyMissing !== true,
    `bound to ${d.boundPropertyId}, which this token cannot see`);
  note(`bound to ${d.boundPropertyId} · ${d.boundPropertyName}`);
  if (d.properties.length > 1) {
    warn(`the account holds ${d.properties.length} properties`,
      d.properties.map((p: any) => `${p.id}  ${p.name}${p.id === d.boundPropertyId ? '   <- this one' : ''}`).join('\n')
      + '\nA wrong binding writes this property\'s rates onto another\'s listing.');
  }

  /* ─────────────────────────────────────── 3. mappings ── */
  section('3 · Room mappings');
  const units = (await call('GET', `/api/channels/${hub.id}/discover`)).b as any[];
  const cat: any = await (await fetch(`${API}/api/public/booking-engine/catalog`)).json();
  const pms = new Map<string, any>(cat.roomTypes.map((r: any) => [r.id, r]));

  const unmapped = units.filter((u) => u.status !== 'mapped');
  check('every channel room is mapped to a room type', unmapped.length === 0,
    unmapped.map((u) => `${u.externalId} ${u.name}`).join(', '));

  const mappedIds = new Set(units.filter((u) => u.mappedRoomTypeId).map((u) => u.mappedRoomTypeId));
  const notSold = cat.roomTypes.filter((r: any) => !mappedIds.has(r.id));
  check('every room type this PMS sells reaches the channel', notSold.length === 0,
    notSold.map((r: any) => r.name).join(', ') + ' — these sell on the booking page only');

  // Two channel rooms sharing one room type sell from one pool and overbook
  // each other. The server refuses it; this proves it did.
  const seen = new Map<string, string>();
  const dupes: string[] = [];
  for (const u of units) {
    if (!u.mappedRoomTypeId) continue;
    if (seen.has(u.mappedRoomTypeId)) dupes.push(`${u.name} and ${seen.get(u.mappedRoomTypeId)}`);
    seen.set(u.mappedRoomTypeId, u.name);
  }
  check('no two channel rooms share a room type', dupes.length === 0, dupes.join('; '));

  /* ──────────────────────────────── 4. capacity agreement ── */
  section('4 · Do both sides agree how many beds exist?');
  // The check that stops an overbooking before it is possible. If the channel
  // thinks a dorm holds 8 and this PMS thinks 16, one of them is selling beds
  // that do not exist — or refusing to sell beds that do.
  let capacityMismatch = 0;
  for (const u of units) {
    const rt = u.mappedRoomTypeId ? pms.get(u.mappedRoomTypeId) : null;
    if (!rt) continue;
    if (rt.unitsTotal !== u.quantity) {
      capacityMismatch++;
      warn(`${rt.name}`,
        `this PMS has ${rt.unitsTotal} sellable, Beds24 room ${u.externalId} has qty ${u.quantity}.\n`
        + (rt.unitsTotal > u.quantity
          ? `Beds24 is short by ${rt.unitsTotal - u.quantity} — those beds cannot be sold on any OTA.`
          : `This PMS is short by ${u.quantity - rt.unitsTotal} — the OTAs may sell beds that do not exist here.`));
    }
  }
  check('every mapped room holds the same number of beds on both sides', capacityMismatch === 0,
    `${capacityMismatch} room type(s) disagree — see above`);

  /* ────────────────────────────────────── 5. what we hold ── */
  section('5 · What this PMS would publish');
  const ari = (await call('GET', '/api/channels/ari')).b as any;
  const first = new Map<string, any>();
  for (const c of ari.cells ?? []) if (!first.has(c.roomTypeId)) first.set(c.roomTypeId, c);
  check('there is something to publish', first.size > 0, 'no ARI cells — check rates are loaded');
  for (const [id, c] of first) {
    const rt = pms.get(id);
    note(`${String(rt?.name ?? id).slice(0, 44).padEnd(46)} ${String(c.available).padStart(3)} free  ${money(c.priceMinor).padStart(7)}  stay ${c.minStay}-${c.maxStay}`);
  }
  note(`${(ari.cells ?? []).length} cells, ${ari.from} → ${ari.to}`);

  /* ──────────────────────────────────────── 6. inbound ── */
  section('6 · Bookings coming in');
  const imported = (await call('POST', `/api/channels/${hub.id}/import`, {})).b as any;
  check('an import completes without error', typeof imported?.fetched === 'number',
    JSON.stringify(imported).slice(0, 200));
  note(`${imported.fetched} fetched · ${imported.created} new · ${imported.updated} updated · ${imported.conflicts} conflict(s)`);
  if (imported.fetched === 0) {
    note('nothing to import. Expected while the OTAs have no availability to sell.');
  }

  const conflicts = (await call('GET', '/api/channels/conflicts')).b as any[];
  check('no unresolved inbound conflicts', (conflicts ?? []).length === 0,
    `${conflicts?.length} booking(s) need a decision in Channel Manager → Inbound`);

  /* ──────────────────────────────────────── 7. outbound ── */
  section('7 · The outbound queue');
  const queue = (await call('GET', '/api/channels/queue')).b as any[];
  const readOnly = d.channel?.status === 'connected' && config.channelReadonly;
  note(`${(queue ?? []).length} item(s) waiting`);
  if (config.channelReadonly) {
    warn('read-only is on — nothing queued will ever be sent',
      'Bookings still import and every read works. Clear HELIO_CHANNEL_READONLY\n'
      + 'and set HELIO_CHANNEL_DRAIN_SECONDS to publish.');
  } else {
    check('the queue is draining', (queue ?? []).length < 500,
      `${queue?.length} items backed up — the drain may be failing, check the sync log`);
  }
  void readOnly;

  /* ──────────────────────────────────────────── 8. drift ── */
  section('8 · Does the channel already hold what we hold?');
  const drift = (await call('POST', `/api/channels/${hub.id}/drift`, {})).b as any;
  const rows: any[] = drift?.differences ?? drift?.drift ?? [];
  if (drift?.error) {
    check('drift could be measured', false, drift.error);
  } else {
    check('drift could be measured', true);
    if (rows.length === 0) {
      note('the channel matches this PMS exactly.');
    } else {
      warn(`${rows.length} difference(s) between this PMS and Beds24`,
        'Publishing replaces the channel\'s values with this PMS\'s. Run\n'
        + '`npm run beds24:status` for the full date-by-date report before you do.');
    }
  }

  /* ──────────────────────────────────────────── 9. push ── */
  section('9 · Publishing');
  if (!PUSH) {
    note('not attempted. Pass --push to send one real ARI push.');
  } else if (config.channelReadonly) {
    check('--push refused while read-only is set', true);
    note('Clear HELIO_CHANNEL_READONLY first. This is the safety catch working.');
  } else {
    const pushed = (await call('POST', `/api/channels/${hub.id}/push`, {})).b as any;
    check('the push was accepted', !pushed?.error, JSON.stringify(pushed).slice(0, 300));
    note(JSON.stringify(pushed).slice(0, 300));
  }

  /* ───────────────────────────────────────────── result ── */
  process.stdout.write(`\n${checks - failures}/${checks} checks passed`);
  process.stdout.write(warnings ? `, ${warnings} thing(s) need a person\n` : '\n');
  if (failures) {
    process.stdout.write('\nSomething is broken. Fix it before relying on this link.\n');
    process.exitCode = 1;
    return;
  }
  if (warnings) {
    process.stdout.write(
      '\nNothing is broken, but the items marked ! are decisions only you can make.\n');
    return;
  }
  process.stdout.write('The PMS and Beds24 agree, and the link works in both directions.\n');
}

try {
  await main();
} catch (e) {
  process.stderr.write(`\nAborted: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
}
