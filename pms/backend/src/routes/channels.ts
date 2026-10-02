// Channel manager endpoints. Distribution runs through Beds24; nothing here
// reports a successful sync that did not happen.
import { router, type Ctx } from '../lib/http.ts';
import { all, get, run, jsonCol, parseJson } from '../db.ts';
import {
  id, nowIso, str, int, slugCode, boolIn, assertDate, addDays, notFound, HttpError,
} from '../lib/util.ts';
import {
  listChannels, getChannel, upsertChannel, connectBeds24, testConnection, syncLog,
  listMappings, upsertMapping, deleteMapping, discoverUnits, buildAri, pushToChannel,
  processQueue, queueStatus, importBookings, listConflicts, resolveConflict,
  detectDrift, channelHealth, refreshOtas, pushRoomQuantity, settingsWithCredentials,
} from '../services/channels.ts';
import { listOtas, otaSummary, declareOta } from '../services/otas.ts';
import {
  inventoryLines, inventoryDrift, setInventory, autoPushEnabled, setAutoPush,
} from '../services/inventory.ts';
import { audit } from '../services/audit.ts';
import type { Beds24Credentials } from '../channels/beds24.ts';
import {
  channelRooms, connectionGuide, diagnose, requireChannel, suggestRoomMappings,
} from '../services/beds24setup.ts';
import { adoptChannelRates } from '../services/adoptrates.ts';

const pid = (ctx: Ctx) => ctx.auth.propertyId;
const businessDate = (ctx: Ctx) =>
  get<{ business_date: string }>('SELECT business_date FROM properties WHERE id = ?', pid(ctx))!.business_date;

/** The channels Beds24 can distribute to — the catalogue an operator picks from. */
// Exported so checks can assert against the codes actually issued, rather
// than against a copy that can drift.
export const CATALOGUE = [
  { code: 'BDC', name: 'Booking.com', kind: 'ota' },
  { code: 'EXP', name: 'Expedia', kind: 'ota' },
  { code: 'AGD', name: 'Agoda', kind: 'ota' },
  { code: 'AIR', name: 'Airbnb', kind: 'ota' },
  { code: 'VRB', name: 'Vrbo', kind: 'ota' },
  { code: 'HW', name: 'Hostelworld', kind: 'hostel' },
  { code: 'HSC', name: 'Hostelsclub', kind: 'hostel' },
  { code: 'TRIP', name: 'Trip.com', kind: 'ota' },
  { code: 'TVL', name: 'Traveloka', kind: 'ota' },
  { code: 'GHA', name: 'Google Hotel Ads', kind: 'metasearch' },
  { code: 'TA', name: 'Tripadvisor', kind: 'metasearch' },
  { code: 'HBD', name: 'Hotelbeds', kind: 'wholesaler' },
  { code: 'HTG', name: 'HomeToGo', kind: 'ota' },
  { code: 'DIRECT', name: 'Direct / booking engine', kind: 'direct' },
];

router.get('/api/channels/catalogue', () => CATALOGUE, { perm: 'channels.read' });

router.get('/api/channels', (ctx: Ctx) => listChannels(pid(ctx)), { perm: 'channels.read' });

router.get('/api/channels/health', (ctx: Ctx) => channelHealth(pid(ctx)), { perm: 'channels.read' });

router.post('/api/channels', (ctx: Ctx) => upsertChannel(pid(ctx), ctx.auth, {
  id: ctx.body.id,
  code: slugCode(ctx.body.code, 'code', 12),
  name: str(ctx.body.name, 'name', { max: 80 }),
  kind: ctx.body.kind,
  active: ctx.body.active === undefined ? undefined : boolIn(ctx.body.active),
  commissionBp: ctx.body.commissionBp === undefined ? undefined
    : int(ctx.body.commissionBp, 'commissionBp', { min: 0, max: 10000 }),
  priceMultiplierBp: ctx.body.priceMultiplierBp === undefined ? undefined
    : int(ctx.body.priceMultiplierBp, 'priceMultiplierBp', { min: 1000, max: 50000 }),
  allotment: ctx.body.allotment === undefined ? undefined : ctx.body.allotment,
  externalPropertyId: ctx.body.externalPropertyId,
  settings: ctx.body.settings,
}), { perm: 'channels.write' });

router.patch('/api/channels/:id', (ctx: Ctx) => {
  const c = getChannel(pid(ctx), ctx.params.id);
  return upsertChannel(pid(ctx), ctx.auth, {
    id: c.id, code: c.code, name: ctx.body.name ?? c.name, kind: ctx.body.kind,
    active: ctx.body.active === undefined ? undefined : boolIn(ctx.body.active),
    commissionBp: ctx.body.commissionBp,
    priceMultiplierBp: ctx.body.priceMultiplierBp,
    allotment: ctx.body.allotment,
    externalPropertyId: ctx.body.externalPropertyId,
    settings: ctx.body.settings,
  });
}, { perm: 'channels.write' });

// ─── Connection ──────────────────────────────────────────────
router.post('/api/channels/:id/connect', async (ctx: Ctx) => connectBeds24(pid(ctx), ctx.auth, ctx.params.id, {
  inviteCode: ctx.body.inviteCode,
  refreshToken: ctx.body.refreshToken,
  externalPropertyId: ctx.body.externalPropertyId,
  keepCredential: ctx.body.keepCredential === true,
}), { perm: 'channels.write' });

router.post('/api/channels/:id/test', async (ctx: Ctx) =>
  testConnection(pid(ctx), ctx.auth, ctx.params.id), { perm: 'channels.write' });

router.post('/api/channels/:id/disconnect', (ctx: Ctx) => {
  const c = getChannel(pid(ctx), ctx.params.id);
  const settings = parseJson<Record<string, unknown>>(c.settings, {});
  delete settings.credentials;
  run(`UPDATE channels SET settings = ?, status = 'not-configured', active = 0, last_error = NULL
        WHERE id = ?`, jsonCol(settings), ctx.params.id);
  audit(ctx.auth, {
    action: 'channel.disconnect', entity: 'CHANNEL', entityId: ctx.params.id,
    entityRef: c.code, channel: c.code, elevated: true,
  }, ctx.ip);
  return { ok: true };
}, { perm: 'channels.write' });

// ─── Mappings ────────────────────────────────────────────────
router.get('/api/channel-mappings', (ctx: Ctx) =>
  listMappings(pid(ctx), ctx.query.get('channelId') ?? undefined), { perm: 'channels.read' });

router.post('/api/channel-mappings', (ctx: Ctx) => upsertMapping(pid(ctx), ctx.auth, {
  id: ctx.body.id,
  channelId: str(ctx.body.channelId, 'channelId'),
  roomTypeId: ctx.body.roomTypeId ?? null,
  ratePlanId: ctx.body.ratePlanId ?? null,
  externalRoomId: ctx.body.externalRoomId ?? null,
  externalRateId: ctx.body.externalRateId ?? null,
  externalName: ctx.body.externalName ?? null,
  active: ctx.body.active === undefined ? undefined : boolIn(ctx.body.active),
}), { perm: 'channels.write' });

router.delete('/api/channel-mappings/:id', (ctx: Ctx) =>
  deleteMapping(pid(ctx), ctx.auth, ctx.params.id), { perm: 'channels.write' });

router.get('/api/channels/:id/discover', async (ctx: Ctx) =>
  discoverUnits(pid(ctx), ctx.auth, ctx.params.id), { perm: 'channels.write' });

// ─── Inventory, on both sides ────────────────────────────────
router.get('/api/inventory', (ctx: Ctx) => ({
  lines: inventoryLines(pid(ctx)),
  drift: inventoryDrift(pid(ctx)),
}), { perm: 'channels.read' });

/**
 * Change how many rooms, and beds per room, a room type has.
 *
 * Changes Helio first and reports the result. Sending the new count on to the
 * channel is a separate, explicit call — because the two can fail
 * independently, and a screen that did both behind one button would have to
 * lie about one of them.
 */
router.put('/api/inventory/:roomTypeId', async (ctx: Ctx) => {
  const line = setInventory(
    pid(ctx), ctx.auth, ctx.params.roomTypeId,
    {
      rooms: int(ctx.body.rooms, 'rooms', { min: 0, max: 500 }),
      bedsPerRoom: ctx.body.bedsPerRoom === undefined ? undefined
        : int(ctx.body.bedsPerRoom, 'bedsPerRoom', { min: 1, max: 64 }),
    },
  );

  // Auto-push, when the property has asked for it.
  //
  // The Helio change is already committed and stays committed whatever the
  // channel says. A refusal out there is not a reason to silently undo a
  // deliberate change in here — but it *is* something the caller has to be told
  // about plainly, so the outcome of each half is reported separately rather
  // than folded into one "saved".
  const auto = autoPushEnabled(pid(ctx));
  if (!auto || line.externalRoomId === null) {
    return { line, push: { attempted: false, reason: auto ? 'not mapped to a channel' : 'auto-push is off' } };
  }

  const channel = all<{ id: string }>(
    `SELECT id FROM channels WHERE property_id = ? AND status = 'connected' ORDER BY name LIMIT 1`,
    pid(ctx))[0];
  if (!channel) {
    return { line, push: { attempted: false, reason: 'no connected channel' } };
  }

  try {
    const res = await pushRoomQuantity(
      pid(ctx), ctx.auth, channel.id, ctx.params.roomTypeId, line.sellable);
    return { line: inventoryLines(pid(ctx)).find((l) => l.roomTypeId === ctx.params.roomTypeId) ?? line,
      push: { attempted: true, ok: true, qty: res.qty } };
  } catch (e) {
    return {
      line,
      push: {
        attempted: true, ok: false,
        error: e instanceof HttpError ? e.message : String(e),
        code: e instanceof HttpError ? e.code : undefined,
      },
    };
  }
}, { perm: 'config.write' });

/** Is a count change sent to the channel automatically? */
router.get('/api/inventory/auto-push', (ctx: Ctx) =>
  ({ on: autoPushEnabled(pid(ctx)) }), { perm: 'channels.read' });

router.put('/api/inventory/auto-push', (ctx: Ctx) => {
  const on = boolIn(ctx.body.on);
  if (on === undefined) throw new HttpError(400, '`on` must be true or false');
  return { on: setAutoPush(pid(ctx), ctx.auth, on) };
}, { perm: 'channels.write' });

/** Send a room type's unit count to the channel. */
router.post('/api/channels/:id/quantity', async (ctx: Ctx) => pushRoomQuantity(
  pid(ctx), ctx.auth, ctx.params.id,
  str(ctx.body.roomTypeId, 'roomTypeId'),
  int(ctx.body.qty, 'qty', { min: 0, max: 5000 }),
), { perm: 'channels.write' });

// ─── The OTAs behind the hub ─────────────────────────────────
// Beds24 is one connection and many shopfronts. These endpoints are about the
// shopfronts, because that is the level every real question is asked at.
router.get('/api/otas', (ctx: Ctx) => ({
  summary: otaSummary(pid(ctx)),
  otas: listOtas(pid(ctx)),
}), { perm: 'channels.read' });

/** Re-read the catalogue from Beds24 and recount bookings. */
router.post('/api/channels/:id/otas/refresh', async (ctx: Ctx) => {
  const otas = await refreshOtas(pid(ctx), ctx.params.id);
  return { summary: otaSummary(pid(ctx)), otas };
}, { perm: 'channels.write' });

/**
 * Mark an OTA live, or not.
 *
 * The escape hatch for what the API cannot see. It never overrides a booking:
 * an OTA that has sent business stays confirmed whatever is ticked here.
 */
router.patch('/api/otas/:code', (ctx: Ctx) => {
  const live = boolIn(ctx.body.live);
  if (live === undefined) throw new HttpError(400, '`live` must be true or false');
  return declareOta(pid(ctx), ctx.auth, ctx.params.code, live);
}, { perm: 'channels.write' });

// ─── ARI ─────────────────────────────────────────────────────
router.get('/api/channels/ari', (ctx: Ctx) => {
  const from = ctx.query.get('from') ?? businessDate(ctx);
  const to = ctx.query.get('to') ?? addDays(from, 30);
  assertDate(from, 'from');
  assertDate(to, 'to');
  return {
    from, to,
    cells: buildAri(pid(ctx), {
      roomTypeId: ctx.query.get('roomTypeId') ?? undefined,
      ratePlanId: ctx.query.get('ratePlanId') ?? undefined,
      from, to,
      channelCode: ctx.query.get('channelCode'),
    }),
  };
}, { perm: 'channels.read' });

router.post('/api/channels/:id/push', async (ctx: Ctx) => {
  const from = ctx.body.from ?? businessDate(ctx);
  const to = ctx.body.to ?? addDays(from, 30);
  assertDate(from, 'from');
  assertDate(to, 'to');
  return pushToChannel(pid(ctx), ctx.auth, ctx.params.id, {
    roomTypeId: ctx.body.roomTypeId, from, to, scope: ctx.body.scope,
  });
}, { perm: 'channels.write' });

router.get('/api/channels/queue', (ctx: Ctx) => queueStatus(pid(ctx)), { perm: 'channels.read' });

router.post('/api/channels/queue/process', async (ctx: Ctx) =>
  processQueue(pid(ctx), ctx.auth, int(ctx.body.maxBatches ?? 10, 'maxBatches', { min: 1, max: 50 })),
{ perm: 'channels.write' });

// ─── Reservations in / conflicts ─────────────────────────────
router.post('/api/channels/:id/import', async (ctx: Ctx) =>
  importBookings(pid(ctx), ctx.auth, ctx.params.id, { since: ctx.body.since }),
{ perm: 'channels.write' });

router.get('/api/channels/conflicts', (ctx: Ctx) =>
  listConflicts(pid(ctx), ctx.query.get('status') ?? 'open'), { perm: 'channels.read' });

router.post('/api/channels/conflicts/:id/resolve', (ctx: Ctx) =>
  resolveConflict(pid(ctx), ctx.auth, ctx.params.id, {
    roomTypeId: str(ctx.body.roomTypeId, 'roomTypeId'),
    ratePlanId: str(ctx.body.ratePlanId, 'ratePlanId'),
    createMapping: boolIn(ctx.body.createMapping, true),
  }), { perm: 'channels.write' });

router.post('/api/channels/conflicts/:id/ignore', (ctx: Ctx) => {
  run(`UPDATE channel_conflicts SET status = 'ignored', resolved_at = ?, resolved_by = ?
        WHERE id = ? AND property_id = ?`, nowIso(), ctx.auth.userName, ctx.params.id, pid(ctx));
  return { ok: true };
}, { perm: 'channels.write' });

// ─── Monitoring ──────────────────────────────────────────────
router.get('/api/channels/sync-log', (ctx: Ctx) => syncLog(
  pid(ctx),
  int(ctx.query.get('limit') ?? 100, 'limit', { min: 1, max: 500 }),
  ctx.query.get('channelId') ?? undefined,
), { perm: 'channels.read' });

router.post('/api/channels/:id/drift', async (ctx: Ctx) => {
  const from = ctx.body.from ?? businessDate(ctx);
  const to = ctx.body.to ?? addDays(from, 14);
  return detectDrift(pid(ctx), ctx.auth, ctx.params.id, { from, to });
}, { perm: 'channels.write' });

// ─── Per-channel content ─────────────────────────────────────
router.get('/api/channels/:id/content', (ctx: Ctx) => {
  const rows = all<any>('SELECT * FROM channel_content WHERE channel_id = ?', ctx.params.id);
  return rows.map((c) => ({
    id: c.id, language: c.language, shortName: c.short_name, description: c.description,
    amenities: parseJson<string[]>(c.amenities, []), photoCount: c.photo_count,
    cancellationPolicy: c.cancellation_policy, maxOccupancy: c.max_occupancy,
    minStay: c.min_stay, maxStay: c.max_stay, depositPctBp: c.deposit_pct_bp,
    updatedAt: c.updated_at,
    // Completeness is measured, not guessed: each element the OTAs require.
    contentScore: [
      c.short_name, c.description && c.description.length > 120,
      parseJson<string[]>(c.amenities, []).length >= 5,
      c.photo_count >= 20, c.cancellation_policy, c.max_occupancy,
    ].filter(Boolean).length * 100 / 6 | 0,
  }));
}, { perm: 'channels.read' });

router.put('/api/channels/:id/content', (ctx: Ctx) => {
  const b = ctx.body;
  const language = b.language ?? 'en';
  const existing = get<any>('SELECT id FROM channel_content WHERE channel_id = ? AND language = ?',
    ctx.params.id, language);
  const cId = existing?.id ?? id('cnt');
  run(
    `INSERT INTO channel_content(id, property_id, channel_id, short_name, description, amenities,
                                 photo_count, cancellation_policy, max_occupancy, min_stay, max_stay,
                                 deposit_pct_bp, language, updated_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(channel_id, language) DO UPDATE SET
       short_name = excluded.short_name, description = excluded.description,
       amenities = excluded.amenities, photo_count = excluded.photo_count,
       cancellation_policy = excluded.cancellation_policy, max_occupancy = excluded.max_occupancy,
       min_stay = excluded.min_stay, max_stay = excluded.max_stay,
       deposit_pct_bp = excluded.deposit_pct_bp, updated_at = excluded.updated_at`,
    cId, pid(ctx), ctx.params.id, b.shortName ?? null, b.description ?? null,
    jsonCol(b.amenities ?? []), int(b.photoCount ?? 0, 'photoCount', { min: 0 }),
    b.cancellationPolicy ?? null, b.maxOccupancy ?? null, b.minStay ?? null, b.maxStay ?? null,
    int(b.depositPctBp ?? 0, 'depositPctBp', { min: 0, max: 10000 }), language, nowIso(),
  );
  audit(ctx.auth, {
    action: 'content.update', entity: 'CONTENT', entityId: ctx.params.id, after: { language },
  }, ctx.ip);
  return { id: cId };
}, { perm: 'channels.write' });

// ─── Inbound webhook (Beds24 booking notification) ───────────
/**
 * Beds24 can push booking notifications here. The payload is stored and the
 * importer runs against the channel, so a webhook and a manual pull converge
 * on the same code path.
 */
router.post('/api/webhooks/beds24/:propertyCode', async (ctx: Ctx) => {
  const property = get<any>('SELECT * FROM properties WHERE code = ?', ctx.params.propertyCode);
  if (!property) notFound('Property');
  const channel = get<any>(
    `SELECT * FROM channels WHERE property_id = ? AND code = 'BEDS24' AND active = 1`, property.id)
    ?? get<any>(`SELECT * FROM channels WHERE property_id = ? AND active = 1 LIMIT 1`, property.id);
  if (!channel) throw new HttpError(409, 'No active channel configured for this property');

  const systemActor = { userId: '', userName: 'beds24.webhook', propertyId: property.id };
  const result = await importBookings(property.id, systemActor, channel.id, {});
  return { ok: true, ...result };
}, { perm: null, allowNoProperty: true });

// ─── Guided connection ───────────────────────────────────────
//
// The setup wizard's read surface. Connecting itself still goes through
// `POST /api/channels/:id/connect`; everything here tells somebody where they
// stand before and after they do it.

/**
 * How to create an invite code, which permissions to tick, and what the two
 * tokens are.
 *
 * Served rather than written into the React screen so the instructions and the
 * scope check can never disagree — both read `REQUIRED_SCOPES`.
 */
router.get('/api/channels/connection-guide', () => connectionGuide(),
  { perm: 'channels.read' });

/**
 * Where this channel actually stands: is the credential readable, what is the
 * token allowed to do, which properties can it see, is the one we are bound to
 * still among them, and how much of the API budget is left.
 *
 * One call, because these are one question — "is this working?" — and asking it
 * in four places is how a screen ends up showing three green ticks and one
 * silent failure.
 */
router.get('/api/channels/:id/diagnosis', async (ctx: Ctx) => {
  const channel = requireChannel(pid(ctx), ctx.params.id);
  let credentials: Beds24Credentials = {};
  let unreadable: string | null = null;
  try {
    ({ credentials } = settingsWithCredentials(channel));
  } catch (e) {
    // A credential encrypted under a key that has since changed. Reported as a
    // diagnosis rather than thrown: this screen is exactly where somebody comes
    // to find that out, and a 500 here tells them nothing.
    unreadable = e instanceof Error ? e.message : String(e);
  }
  const result = await diagnose(credentials, channel.external_property_id ?? null);
  return {
    channel: { id: channel.id, code: channel.code, name: channel.name, status: channel.status },
    ...result,
    error: unreadable ?? result.error,
    credentialUnreadable: !!unreadable,
  };
}, { perm: 'channels.write' });

/**
 * The channel's rooms, matched against this property's room types.
 *
 * Suggestions only — nothing is written. A wrong mapping quietly sends one
 * room's availability to another, so the last word stays with a person looking
 * at both names.
 */
router.get('/api/channels/:id/room-suggestions', async (ctx: Ctx) => {
  const channel = requireChannel(pid(ctx), ctx.params.id);
  const { credentials } = settingsWithCredentials(channel);
  const rooms = await channelRooms(credentials, channel.external_property_id ?? undefined);
  return {
    rooms: suggestRoomMappings(pid(ctx), channel.id, rooms),
    roomTypes: all<any>(
      `SELECT id, name, code, kind FROM room_types
        WHERE property_id = ? AND active = 1 ORDER BY sort_order, name`, pid(ctx)),
  };
}, { perm: 'channels.write' });

/**
 * Accept a set of suggested mappings in one go.
 *
 * The alternative is twelve trips through a dialog, which is where somebody
 * stops halfway and leaves half their rooms unmapped — a state that looks
 * connected and pushes nothing for the rooms that were missed.
 */
router.post('/api/channels/:id/room-suggestions/apply', (ctx: Ctx) => {
  const channel = requireChannel(pid(ctx), ctx.params.id);
  const wanted = Array.isArray(ctx.body?.mappings) ? ctx.body.mappings : [];
  const applied: string[] = [];
  const skipped: { channelRoomId: string; reason: string }[] = [];

  for (const m of wanted) {
    const channelRoomId = typeof m?.channelRoomId === 'string' ? m.channelRoomId : null;
    const roomTypeId = typeof m?.roomTypeId === 'string' ? m.roomTypeId : null;
    if (!channelRoomId || !roomTypeId) {
      skipped.push({ channelRoomId: String(channelRoomId ?? '?'), reason: 'Nothing chosen' });
      continue;
    }
    try {
      upsertMapping(pid(ctx), ctx.auth, {
        channelId: channel.id,
        roomTypeId,
        ratePlanId: typeof m.ratePlanId === 'string' ? m.ratePlanId : undefined,
        externalRoomId: channelRoomId,
        externalName: typeof m.channelRoomName === 'string' ? m.channelRoomName : undefined,
      });
      applied.push(channelRoomId);
    } catch (e) {
      // One bad row must not lose the eleven good ones.
      skipped.push({ channelRoomId, reason: e instanceof Error ? e.message : String(e) });
    }
  }
  return { applied: applied.length, skipped };
}, { perm: 'channels.write' });

/**
 * Adopt the channel's prices into this PMS.
 *
 * The one operation that runs the other way. Used once, when connecting a
 * property that is already selling: the channel's prices become the PMS's, so
 * the first push changes nothing rather than replacing months of live rates
 * with whatever was typed in during setup.
 *
 * A dry run by default — `apply: true` is what writes.
 */
router.post('/api/channels/:id/adopt-rates', async (ctx: Ctx) => adoptChannelRates(
  pid(ctx), ctx.auth, ctx.params.id,
  {
    from: typeof ctx.body?.from === 'string' ? ctx.body.from : undefined,
    days: ctx.body?.days === undefined ? undefined : int(ctx.body.days, 'days', { min: 1, max: 730 }),
    dryRun: ctx.body?.apply !== true,
  },
), { perm: 'rates.write' });
