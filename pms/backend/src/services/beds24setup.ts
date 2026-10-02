// ─────────────────────────────────────────────────────────────
// Connecting a Beds24 account, as a guided sequence rather than a text box.
//
// Connecting a channel manager is the highest-consequence thing a small
// property ever does in a PMS — it is the moment their inventory stops being
// private — and the old screen for it was one field labelled "invite code" and
// a Connect button. Everything that actually goes wrong went wrong silently:
//
//   · The invite code is made in Beds24 with a tick-list of permissions, and a
//     token missing `write:inventory` connects perfectly and then never pushes
//     a rate. Nothing said so; the queue just grew.
//   · The account holds several properties and the connection binds to the
//     wrong one, so rates for the hostel go to the apartment next door.
//   · The rooms on each side are named differently, nothing is mapped, and the
//     push has nowhere to send anything.
//
// This module answers each of those before it can bite: it exchanges the code,
// asks the token what it is allowed to do, compares that against what this PMS
// actually calls, lists the properties, and matches the rooms up. Each step
// returns what it found and what is still missing, so the screen can say "you
// are two ticks away" instead of "error".
//
// It writes nothing except through `connectBeds24`. Everything else here reads.
// ─────────────────────────────────────────────────────────────
import { all, get } from '../db.ts';
import { HttpError } from '../lib/util.ts';
import { Beds24Client, HUB, type Beds24Credentials } from '../channels/beds24.ts';

/**
 * The hub's name at the start of a sentence.
 *
 * `HUB` defaults to the lower-case "the channel manager", which reads correctly
 * mid-sentence and produced "Sign in to your The channel manager account" at
 * the start of one. Only the default carries an article, so only the default
 * needs fixing — a real name like "Beds24" is already title-case.
 */
const HUB_TITLE = HUB === 'the channel manager' ? 'The channel manager' : HUB;

/* ------------------------------------------------------------- scopes ---- */

/**
 * What this PMS actually calls, and therefore what the token has to permit.
 *
 * Derived from the connector rather than from Beds24's documentation, so it
 * stays honest: every entry below names the calls that need it. If a feature
 * is added that calls something new, its scope belongs here or the setup
 * screen will keep saying a connection is complete when it is not.
 */
export interface ScopeNeed {
  /** The Beds24 scope string, as it appears on their permissions list. */
  scope: string;
  /** Plain English, for somebody who has never seen an OAuth scope. */
  label: string;
  /** What stops working without it. */
  needed: string;
  /**
   * Whether the connection is unusable without it, or merely reduced.
   * A property that only wants to import bookings does not need write access.
   */
  required: boolean;
}

export const REQUIRED_SCOPES: ScopeNeed[] = [
  {
    scope: 'read:properties',
    label: 'Read properties and rooms',
    needed: 'Finding your property and its rooms, so they can be matched to this PMS.',
    required: true,
  },
  {
    scope: 'read:bookings',
    label: 'Read bookings',
    needed: 'Importing OTA bookings, and reading guest messages.',
    required: true,
  },
  {
    scope: 'write:bookings',
    label: 'Write bookings',
    needed: 'Replying to guest messages, and reporting cancellations and no-shows back.',
    required: false,
  },
  {
    scope: 'read:inventory',
    label: 'Read rates and availability',
    needed: 'Comparing what the channel holds against what this PMS holds, to catch drift.',
    required: true,
  },
  {
    scope: 'write:inventory',
    label: 'Write rates and availability',
    needed: 'Pushing prices, availability and stay rules out to the OTAs. '
      + 'Without this the queue fills and nothing ever leaves.',
    required: true,
  },
];

/**
 * Whether a granted scope list satisfies one need.
 *
 * Beds24 grants `all:inventory` as a superset of `read:` and `write:`, so a
 * literal string match would report a perfectly good token as missing two
 * permissions and send somebody back to re-issue a code they did not need to.
 */
function granted(scopes: string[], need: string): boolean {
  if (scopes.includes(need)) return true;
  const [, resource] = need.split(':');
  return !!resource && scopes.includes(`all:${resource}`);
}

export interface ScopeReport {
  /** Null when the token could not be asked — not the same as "none granted". */
  known: boolean;
  granted: string[];
  missing: ScopeNeed[];
  /** Missing scopes that actually stop the connection working. */
  blocking: ScopeNeed[];
  /** Scopes the account granted that this PMS never uses. */
  extra: string[];
}

export function reviewScopes(scopes: string[] | null): ScopeReport {
  if (!scopes) {
    return { known: false, granted: [], missing: [], blocking: [], extra: [] };
  }
  const missing = REQUIRED_SCOPES.filter((s) => !granted(scopes, s.scope));
  const wanted = new Set(REQUIRED_SCOPES.flatMap((s) => {
    const [, resource] = s.scope.split(':');
    return [s.scope, `all:${resource}`];
  }));
  return {
    known: true,
    granted: scopes,
    missing,
    blocking: missing.filter((s) => s.required),
    // Worth showing rather than hiding: a token with more power than the job
    // needs is a thing a cautious owner may want to narrow.
    extra: scopes.filter((s) => !wanted.has(s)),
  };
}

/* -------------------------------------------------------- instructions --- */

/**
 * Where to click in Beds24, in the order somebody actually clicks.
 *
 * Kept on the server rather than in the React screen so the wording, the scope
 * list and the code that checks the scopes cannot drift apart — the list below
 * is generated from `REQUIRED_SCOPES`, so adding a scope updates the
 * instructions automatically.
 */
export function connectionGuide() {
  return {
    hub: HUB,
    steps: [
      {
        title: `Sign in to your ${HUB_TITLE === 'The channel manager' ? 'channel manager' : HUB} account`,
        detail: 'Use the owner login. An account with limited access cannot create '
          + 'an invite code.',
      },
      {
        title: 'Open Settings → Apps & Integrations → API',
        detail: 'This is where invite codes are made. It is not the same page as the '
          + 'older API key settings.',
      },
      {
        title: 'Create an invite code',
        detail: 'Tick the permissions listed below — all of them. A code created with '
          + 'fewer connects successfully and then fails at the first push, which is '
          + 'much harder to diagnose than a refusal now.',
      },
      {
        title: 'Restrict it to this property',
        detail: 'If the account holds more than one property, choose the one this PMS '
          + 'manages. It keeps a mistake here from writing one property\'s rates onto '
          + 'another.',
      },
      {
        title: 'Paste the code here, within 24 hours',
        detail: 'An invite code is single-use and short-lived. This PMS exchanges it '
          + 'once for a long-lived token and stores only that — the code itself is '
          + 'never kept.',
      },
    ],
    scopes: REQUIRED_SCOPES,
    /**
     * The two tokens, explained — because the words appear in the Beds24 UI and
     * in every support thread about it, and nobody says which is which.
     */
    tokens: [
      {
        name: 'Refresh token',
        lifetime: 'Long-lived — until you revoke it',
        role: `What this PMS stores, encrypted. It is the connection: revoke it in ${HUB} `
          + 'and the connection stops, everywhere, immediately.',
      },
      {
        name: 'Access token',
        lifetime: '24 hours',
        role: 'Minted from the refresh token as needed and kept in memory. Every actual '
          + 'API call carries this one. You never see it, and never need to.',
      },
    ],
  };
}

/* ------------------------------------------------------------ diagnose --- */

export interface ConnectionDiagnosis {
  reachable: boolean;
  error: string | null;
  /** Which of the two tokens the stored credential actually has. */
  credential: {
    hasRefreshToken: boolean;
    hasAccessToken: boolean;
    accessTokenExpiresAt: string | null;
    accessTokenMinutesLeft: number | null;
  };
  scopes: ScopeReport;
  ownerId: string | null;
  properties: { id: string; name: string }[];
  /** The property this channel is bound to, if any, and whether it still exists. */
  boundPropertyId: string | null;
  boundPropertyName: string | null;
  boundPropertyMissing: boolean;
  credits: { remaining: number | null; limit: number | null; resetsInSeconds: number | null };
}

/**
 * Everything the setup screen needs to tell somebody where they stand, in one
 * round trip.
 *
 * Deliberately returns a diagnosis rather than throwing. "Not connected" is a
 * normal state for this screen — it is the state everybody arrives in — and an
 * exception would leave the page with nothing to show but a stack trace.
 */
export async function diagnose(
  credentials: Beds24Credentials,
  boundPropertyId: string | null,
): Promise<ConnectionDiagnosis> {
  const expiresAt = credentials.accessTokenExpiresAt ?? null;
  const base: ConnectionDiagnosis = {
    reachable: false,
    error: null,
    credential: {
      hasRefreshToken: !!credentials.refreshToken,
      hasAccessToken: !!credentials.accessToken,
      accessTokenExpiresAt: expiresAt,
      accessTokenMinutesLeft: expiresAt
        ? Math.round((Date.parse(expiresAt) - Date.now()) / 60_000) : null,
    },
    scopes: { known: false, granted: [], missing: [], blocking: [], extra: [] },
    ownerId: null,
    properties: [],
    boundPropertyId,
    boundPropertyName: null,
    boundPropertyMissing: false,
    credits: { remaining: null, limit: null, resetsInSeconds: null },
  };

  if (!credentials.refreshToken && !credentials.accessToken) {
    return { ...base, error: 'No credential is stored yet.' };
  }

  const client = new Beds24Client(credentials, () => {});

  // Scopes first. It is the cheapest call, it is the one that most often
  // explains everything else, and a token that cannot even answer this is not
  // going to list properties either.
  let scopes: ScopeReport = base.scopes;
  let ownerId: string | null = null;
  try {
    const details = await client.authDetails();
    scopes = reviewScopes(details.scopes);
    ownerId = details.ownerId;
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : String(e) };
  }

  let properties: { id: string; name: string }[] = [];
  try {
    const res = await client.listProperties();
    properties = ((res.data as any)?.data ?? []).map((p: any) => ({
      id: String(p.id), name: String(p.name ?? p.propertyName ?? p.id),
    }));
  } catch (e) {
    return {
      ...base, scopes, ownerId,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const bound = boundPropertyId ? properties.find((p) => p.id === boundPropertyId) : undefined;
  const rl = client.lastRateLimit;

  return {
    ...base,
    reachable: true,
    scopes,
    ownerId,
    properties,
    boundPropertyName: bound?.name ?? null,
    // A channel bound to a property id the token can no longer see is the
    // failure behind "why did the push stop working" after somebody
    // reorganised their Beds24 account. Named here rather than left to a 404
    // on the next write.
    boundPropertyMissing: !!boundPropertyId && !bound,
    credits: {
      remaining: rl.fiveMinRemaining,
      limit: rl.fiveMinLimit,
      resetsInSeconds: rl.resetsInSeconds,
    },
  };
}

/* ------------------------------------------------------- room matching --- */

export interface RoomSuggestion {
  channelRoomId: string;
  channelRoomName: string;
  channelQty: number | null;
  /** The PMS room type this looks like, and why we think so. */
  roomTypeId: string | null;
  roomTypeName: string | null;
  confidence: 'exact' | 'close' | 'none';
  reason: string;
  /** True when a mapping for this channel room already exists. */
  alreadyMapped: boolean;
}

/** Lower-case, letters and digits only — so "6-Bed Female" meets "6 bed female". */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * A number followed by "bed", which is the one token that actually
 * distinguishes hostel room types from each other.
 *
 * "Deluxe 6 Bed Female Dorm" and "Deluxe 4 Bed Mixed Dorm" share almost every
 * word; matching on words alone pairs them happily and silently sends the
 * four-bed dorm's availability to the six-bed one.
 */
function bedCount(s: string): number | null {
  const m = /(\d+)\s*(?:bed|bunk|pax|person)/i.exec(s);
  return m ? Number(m[1]) : null;
}

function femaleOnly(s: string): boolean { return /\bfemale\b|\bwomen\b|\bladies\b/i.test(s); }
function maleOnly(s: string): boolean { return /\bmale\b(?!\s*\/)|\bmen\b/i.test(s) && !femaleOnly(s); }

/**
 * Match the channel's rooms against this property's room types.
 *
 * Suggestions only — nothing is written. A wrong mapping sends one room's
 * availability to another and is close to invisible afterwards, so the last
 * word belongs to a person looking at both names side by side. What this does
 * is make the obvious ones obvious and refuse to guess at the rest.
 */
export function suggestRoomMappings(
  propertyId: string,
  channelId: string,
  channelRooms: { id: string; name: string; qty?: number | null }[],
): RoomSuggestion[] {
  const roomTypes = all<{ id: string; name: string; code: string; kind: string; max_occupancy: number }>(
    `SELECT id, name, code, kind, max_occupancy FROM room_types
      WHERE property_id = ? AND active = 1 ORDER BY sort_order, name`,
    propertyId,
  );
  // How many berths each dorm type has, which is what a channel room name
  // almost always states.
  const capacity = new Map<string, number>(
    all<{ id: string; beds: number }>(
      `SELECT rt.id,
              CASE WHEN rt.kind = 'dorm'
                   THEN coalesce((SELECT count(*) FROM beds b
                                    JOIN rooms r ON r.id = b.room_id
                                   WHERE r.room_type_id = rt.id AND b.active = 1
                                     AND r.active = 1), 0)
                   ELSE rt.max_occupancy END AS beds
         FROM room_types rt
        WHERE rt.property_id = ? AND rt.active = 1`, propertyId,
    ).map((r) => [r.id, r.beds]),
  );

  const mapped = new Set(
    all<{ external_room_id: string }>(
      'SELECT external_room_id FROM channel_mappings WHERE property_id = ? AND channel_id = ?',
      propertyId, channelId,
    ).map((m) => m.external_room_id),
  );

  const taken = new Set<string>();

  return channelRooms.map((cr): RoomSuggestion => {
    const base = {
      channelRoomId: String(cr.id),
      channelRoomName: cr.name,
      channelQty: cr.qty ?? null,
      alreadyMapped: mapped.has(String(cr.id)),
    };

    const free = roomTypes.filter((rt) => !taken.has(rt.id));

    // 1. The names are the same once punctuation is ignored.
    const exact = free.find((rt) => norm(rt.name) === norm(cr.name));
    if (exact) {
      taken.add(exact.id);
      return {
        ...base, roomTypeId: exact.id, roomTypeName: exact.name,
        confidence: 'exact', reason: 'The names match.',
      };
    }

    // 2. The bed count and the gender policy both agree. For a hostel this is
    //    a stronger signal than any amount of word overlap.
    const beds = bedCount(cr.name);
    if (beds !== null) {
      const sameSize = free.filter((rt) => capacity.get(rt.id) === beds);
      const gendered = sameSize.filter((rt) =>
        femaleOnly(rt.name) === femaleOnly(cr.name) && maleOnly(rt.name) === maleOnly(cr.name));
      if (gendered.length === 1) {
        taken.add(gendered[0].id);
        return {
          ...base, roomTypeId: gendered[0].id, roomTypeName: gendered[0].name,
          confidence: 'close',
          reason: `Both hold ${beds} beds${femaleOnly(cr.name) ? ' and are female-only' : ''}.`,
        };
      }
      if (gendered.length > 1) {
        return {
          ...base, roomTypeId: null, roomTypeName: null, confidence: 'none',
          reason: `${gendered.length} room types hold ${beds} beds. Pick the right one.`,
        };
      }
    }

    // 3. Give up out loud. A guess at this point is worse than a blank.
    return {
      ...base, roomTypeId: null, roomTypeName: null, confidence: 'none',
      reason: 'No clear match — choose the room type this is.',
    };
  });
}

/** The channel's rooms, for the mapping step. */
export async function channelRooms(credentials: Beds24Credentials, externalPropertyId?: string) {
  const client = new Beds24Client(credentials, () => {});
  const res = await client.listRooms(externalPropertyId);
  const rows = (res.data as any)?.data ?? [];
  return rows.map((r: any) => ({
    id: String(r.id),
    name: String(r.name ?? r.roomName ?? r.id),
    qty: typeof r.qty === 'number' ? r.qty : null,
  }));
}

/** Guards a route that needs a channel row to exist. */
export function requireChannel(propertyId: string, channelId: string) {
  const row = get<any>('SELECT * FROM channels WHERE id = ? AND property_id = ?',
    channelId, propertyId);
  if (!row) throw new HttpError(404, 'Channel not found');
  return row;
}
