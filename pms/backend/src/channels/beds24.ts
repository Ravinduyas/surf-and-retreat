// ─────────────────────────────────────────────────────────────
// Beds24 API v2 connector.
//
// Beds24 is the distribution backbone: Helio resolves availability, rates and
// restrictions, pushes them here, and Beds24 fans them out to the OTAs and
// returns bookings.
//
// This connector makes real HTTP calls. With no credentials stored it reports
// `not-configured` and refuses to run — it never invents a successful sync.
//
// Rate limiting: Beds24 publishes a five-minute credit budget and returns the
// remaining allowance on every response. We read those headers and pause when
// the budget runs low rather than getting throttled.
// ─────────────────────────────────────────────────────────────

import { config } from '../config.ts';

const BASE = config.beds24Api;

/**
 * What to call the hub in anything a user might read.
 *
 * These strings reach the screen: a connector error becomes the `last_error` on
 * a channel row and the reason beside a failed push. Naming the supplier there
 * tells every property using this system who the channel manager is, which is a
 * commercial relationship rather than something they need to operate the PMS.
 *
 * One constant, matching `frontend/src/branding.ts`. Set `HELIO_CHANNEL_HUB_NAME`
 * to put the real name back on an internal build.
 */
export const HUB = config.channelHubName;

export interface Beds24Credentials {
  refreshToken?: string;
  inviteCode?: string;
  accessToken?: string;
  accessTokenExpiresAt?: string;
  propertyId?: string;
}

export class ChannelNotConfigured extends Error {
  code = 'not_configured';
  constructor(message = `${HUB} credentials are not configured`) {
    super(message);
  }
}

/**
 * The credential is there but cannot be read — a changed `HELIO_SECRET_KEY`, or
 * a database file restored beside a different one.
 *
 * A subclass of `ChannelNotConfigured` on purpose. Every caller that asks "is
 * there a usable credential here?" already tests for that type, and the answer
 * is no: a token nobody can decrypt buys exactly as much as a token that was
 * never entered. Inheriting the type means such a channel reports
 * `not-configured` in the UI and is skipped by the booking poll — which is the
 * correct behaviour, because unlike a network blip this cannot come right on
 * its own. Only re-entering the credential fixes it.
 *
 * Distinguishable by its own `code` so the difference is still legible where it
 * matters, and the message is the one from `decryptSecret`, which says what to
 * do about it.
 */
export class ChannelCredentialUnreadable extends ChannelNotConfigured {
  override code = 'credential_unreadable';
}

export class ChannelApiError extends Error {
  code = 'channel_api_error';
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`${HUB} responded ${status}: ${body.slice(0, 300)}`);
    this.status = status;
    this.body = body;
  }
}

export interface RateLimitState {
  fiveMinLimit: number | null;
  fiveMinRemaining: number | null;
  requestCost: number | null;
  resetsInSeconds: number | null;
}

export interface Beds24Response<T> {
  data: T;
  rateLimit: RateLimitState;
  durationMs: number;
  bytes: number;
  /** How many pages were walked. List endpoints only; 1 for a single call. */
  pagesFetched?: number;
  /**
   * The walk stopped before the channel ran out of pages — there is more on
   * Beds24's side than `data` contains. Never silently true: every caller that
   * can act on a short read is expected to report it.
   */
  truncated?: boolean;
}

/**
 * Read the credit budget Beds24 returns on every response.
 *
 * These header names were wrong for the entire life of this connector, and
 * nothing ever failed because of it. `headers.get` answers null for a name that
 * is not there, so all four fields read null, `remainingCredits` was permanently
 * "unknown", and the throttle guard in `processQueue` could never fire. A rate
 * limiter that is silently switched off is indistinguishable from one that is
 * working right up until the channel starts refusing calls.
 *
 * Beds24's published documentation is also wrong: it names these
 * `X-FiveMinCreditLimit-Remaining` and `X-RequestCost`. What the live API
 * actually sends — verified against the account on 2026-08-18 — is hyphenated
 * between every word:
 *
 *     X-Request-Cost: 1
 *     X-Five-Min-Limit-Remaining: 98.5
 *     X-Five-Min-Limit-Resets-In: 298
 *
 * Both spellings are read below, the live one first, so this survives Beds24
 * settling on either. Note there is no header for the *limit* itself on an
 * ordinary response — only what is left of it — so `fiveMinLimit` stays null
 * until one appears.
 */
function readRateLimit(res: Response): RateLimitState {
  const num = (...names: string[]) => {
    for (const name of names) {
      const v = res.headers.get(name);
      if (v === null || v === '') continue;
      // Remaining credits come back fractional (98.5), so this is not an int.
      const parsed = Number(v);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };
  return {
    fiveMinLimit: num('x-five-min-limit', 'x-fivemincreditlimit'),
    fiveMinRemaining: num('x-five-min-limit-remaining', 'x-fivemincreditlimit-remaining'),
    requestCost: num('x-request-cost', 'x-requestcost'),
    resetsInSeconds: num('x-five-min-limit-resets-in', 'x-fivemincreditlimit-resetsin'),
  };
}

/** Query values Beds24 accepts. Arrays repeat the key: `?status=new&status=cancelled`. */
type Query = Record<string, string | number | Array<string | number> | undefined>;

/**
 * How far a paged read will walk before giving up and saying so.
 *
 * A cap is needed — a bug in the `nextPageExists` handling would otherwise loop
 * until the credit budget is gone — but a cap that truncates *quietly* is worse
 * than no cap, so hitting it sets `truncated` and callers surface it.
 */
const MAX_PAGES = 25;

/** Stop walking pages with less than this left in the five-minute budget. */
const PAGE_WALK_CREDIT_FLOOR = 10;

/**
 * Every status Beds24 will report on a booking.
 *
 * Spelled out because the API's default is not "all of them": omitting `status`
 * gets confirmed, request, new, black and inquiry — everything except the
 * cancellations. See `getBookings`.
 */
export const ALL_BOOKING_STATUSES = [
  'confirmed', 'request', 'new', 'cancelled', 'black', 'inquiry',
] as const;

export class Beds24Client {
  private creds: Beds24Credentials;
  private onCredentialUpdate?: (c: Beds24Credentials) => void;
  lastRateLimit: RateLimitState = {
    fiveMinLimit: null, fiveMinRemaining: null, requestCost: null, resetsInSeconds: null,
  };

  constructor(creds: Beds24Credentials, onCredentialUpdate?: (c: Beds24Credentials) => void) {
    this.creds = creds ?? {};
    this.onCredentialUpdate = onCredentialUpdate;
  }

  get configured(): boolean {
    return Boolean(this.creds.refreshToken || this.creds.inviteCode || this.creds.accessToken);
  }

  /**
   * Exchange a one-time invite code for a long-lived refresh token.
   * Run once, from the Channel Manager → Connection screen.
   */
  async setup(inviteCode: string, deviceName = 'Helio PMS'): Promise<Beds24Credentials> {
    const res = await withTimeout(
      (signal) => fetch(`${BASE}/authentication/setup`, {
        signal, headers: { code: inviteCode, deviceName },
      }),
      'the setup exchange',
    );
    const text = await res.text();
    if (!res.ok) throw new ChannelApiError(res.status, text);
    const body = JSON.parse(text) as { token: string; expiresIn: number; refreshToken: string };
    this.creds = {
      ...this.creds,
      refreshToken: body.refreshToken,
      accessToken: body.token,
      accessTokenExpiresAt: new Date(Date.now() + (body.expiresIn - 60) * 1000).toISOString(),
    };
    this.onCredentialUpdate?.(this.creds);
    return this.creds;
  }

  private async accessToken(): Promise<string> {
    if (!this.configured) throw new ChannelNotConfigured();
    if (this.creds.accessToken && this.creds.accessTokenExpiresAt
        && this.creds.accessTokenExpiresAt > new Date().toISOString()) {
      return this.creds.accessToken;
    }
    const refreshToken = this.creds.refreshToken;
    if (!refreshToken) {
      throw new ChannelNotConfigured('No refresh token — run the connection setup with an invite code');
    }
    const res = await withTimeout(
      (signal) => fetch(`${BASE}/authentication/token`, {
        signal, headers: { refreshToken },
      }),
      'a token refresh',
    );
    const text = await res.text();
    if (!res.ok) throw new ChannelApiError(res.status, text);
    const body = JSON.parse(text) as { token: string; expiresIn: number };
    this.creds = {
      ...this.creds,
      accessToken: body.token,
      accessTokenExpiresAt: new Date(Date.now() + (body.expiresIn - 60) * 1000).toISOString(),
    };
    this.onCredentialUpdate?.(this.creds);
    return body.token;
  }

  private async request<T>(
    path: string, init: RequestInit = {}, query?: Query,
  ): Promise<Beds24Response<T>> {
    const token = await this.accessToken();
    const url = new URL(`${BASE}${path}`);
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v === undefined) continue;
      // Beds24's array parameters — `status`, `roomId`, `propertyId` — are
      // repeated keys, not a comma-joined string. `set` would keep only the
      // last value and silently narrow the query to one element.
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(k, String(item));
      } else {
        url.searchParams.set(k, String(v));
      }
    }
    const started = Date.now();
    const res = await withTimeout(
      (signal) => fetch(url, {
        ...init,
        signal,
        headers: {
          token,
          'content-type': 'application/json',
          accept: 'application/json',
          ...(init.headers ?? {}),
        },
      }),
      `${init.method ?? 'GET'} ${path}`,
    );
    const text = await res.text();
    this.lastRateLimit = readRateLimit(res);
    if (!res.ok) throw new ChannelApiError(res.status, text);
    return {
      data: (text ? JSON.parse(text) : null) as T,
      rateLimit: this.lastRateLimit,
      durationMs: Date.now() - started,
      bytes: Buffer.byteLength(text),
    };
  }

  /**
   * Read a list endpoint to the end, rather than to the end of page one.
   *
   * **Every** Beds24 list response is paginated and says so in its envelope:
   *
   *     {success, type, count, pages: {nextPageExists, nextPageLink}, data: [...]}
   *
   * Nothing here read `pages` until now, so every list call — bookings, rooms,
   * calendars, messages — returned the first page and stopped. That is invisible
   * on a quiet property and stays invisible: a short read looks exactly like a
   * complete one, and the bookings it drops are simply never imported. It only
   * starts hurting once the property is busy enough for a poll to exceed one
   * page, which is precisely when nobody has spare attention for it.
   *
   * `nextPageLink` is returned as a bare example string rather than a usable
   * URL, so this walks by incrementing `page` instead of following it.
   *
   * The walk stops early — flagging `truncated` — on the page cap or when the
   * five-minute credit budget runs low. Reporting a short read as short is the
   * whole point; being throttled mid-walk is otherwise indistinguishable from
   * reaching the last page.
   */
  private async requestAllPages<T>(
    path: string, query?: Query,
  ): Promise<Beds24Response<{ success: boolean; data: T[] }>> {
    const rows: T[] = [];
    let durationMs = 0;
    let bytes = 0;
    let pagesFetched = 0;
    let truncated = false;
    let rateLimit = this.lastRateLimit;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await this.request<any>(
        path, {}, { ...query, ...(page > 1 ? { page } : {}) },
      );
      pagesFetched++;
      durationMs += res.durationMs;
      bytes += res.bytes;
      rateLimit = res.rateLimit;

      const body = res.data ?? {};
      if (Array.isArray(body.data)) rows.push(...body.data);

      // Absent `pages` means an endpoint that does not paginate — one page is
      // the whole answer, and treating that as "more to come" would loop.
      if (body.pages?.nextPageExists !== true) break;

      if (page === MAX_PAGES) { truncated = true; break; }

      const left = rateLimit.fiveMinRemaining;
      if (left !== null && left < PAGE_WALK_CREDIT_FLOOR) { truncated = true; break; }
    }

    return {
      data: { success: true, data: rows },
      rateLimit,
      durationMs,
      bytes,
      pagesFetched,
      truncated,
    };
  }

  /** Remaining five-minute credit budget, or null when unknown. */
  get remainingCredits(): number | null {
    return this.lastRateLimit.fiveMinRemaining;
  }

  listProperties() {
    return this.requestAllPages<any>('/properties');
  }

  /**
   * What this token is actually allowed to do.
   *
   * The single most useful call in the whole connector, and the one nothing
   * used to make.
   *
   * A Beds24 invite code is created with a tick-list of scopes, and getting
   * that list wrong does not fail loudly. A token with `read:inventory` but not
   * `write:inventory` connects perfectly, lists the properties, imports
   * bookings — and then silently cannot push a single rate. The property sees a
   * green "connected", watches the queue fill, and finds out weeks later that
   * the OTAs have been selling last month's prices.
   *
   * Asking the token what it can do turns that into a sentence on the setup
   * screen, before anything has been queued.
   *
   * Written defensively because the shape here is thinly documented and has
   * moved: anything unrecognised comes back as `null`, which the caller reads
   * as "could not determine" rather than as "no permission".
   */
  async authDetails(): Promise<{
    validToken: boolean | null;
    scopes: string[] | null;
    expiresInSeconds: number | null;
    ownerId: string | null;
    raw: unknown;
  }> {
    const token = await this.accessToken();
    const res = await withTimeout(
      (signal) => fetch(`${BASE}/authentication/details`, { signal, headers: { token } }),
      'the token details lookup',
    );
    const text = await res.text();
    if (!res.ok) throw new ChannelApiError(res.status, text);

    let body: any;
    try { body = JSON.parse(text); } catch { body = {}; }
    // Beds24 has returned this both bare and wrapped in `data`.
    const d = body?.data && typeof body.data === 'object' && !Array.isArray(body.data)
      ? body.data : body;

    /*
     * The interesting fields live one level down, under `token`.
     *
     * The live response is
     *
     *   { token: { ownerId, expiresIn, scopes: [...] }, validToken: true,
     *     diagnostics: { requestIp } }
     *
     * — so reading `scopes` and `ownerId` off the top level, which is what
     * this did first, returned null for both against a perfectly good token.
     * The setup screen then said "permissions could not be determined" about a
     * token with every permission granted, which is the one thing that screen
     * exists to get right.
     *
     * Both levels are searched rather than only the nested one: `validToken`
     * genuinely is at the top, and an undocumented shape that moves again
     * should degrade to "unknown" rather than to a wrong answer.
     */
    const nested = d?.token && typeof d.token === 'object' ? d.token : {};
    const pick = (key: string) => (nested as any)?.[key] ?? d?.[key];

    const rawScopes = pick('scopes');
    const scopes = Array.isArray(rawScopes)
      ? rawScopes.filter((s: unknown): s is string => typeof s === 'string')
      // Occasionally a single space-separated string.
      : typeof rawScopes === 'string'
        ? rawScopes.split(/[\s,]+/).filter(Boolean)
        : null;

    const expires = [pick('expiresIn'), pick('expires_in')]
      .find((v) => typeof v === 'number' && Number.isFinite(v));

    const ownerId = pick('ownerId');

    return {
      validToken: typeof d?.validToken === 'boolean' ? d.validToken
        : typeof d?.valid === 'boolean' ? d.valid : null,
      scopes,
      expiresInSeconds: typeof expires === 'number' ? expires : null,
      ownerId: ownerId != null ? String(ownerId) : null,
      raw: d,
    };
  }

  /**
   * Rooms with the rate rules attached, which is where `priceFor` lives.
   *
   * `priceFor` decides how many times a pushed price is charged. A rule set to
   * `upToPerson: 2` on a room that sleeps four bills **two** units of it, so a
   * suite pushed at 74 is advertised at 148 — the price is transmitted
   * perfectly and still comes out wrong at the far end.
   *
   * Nothing in the push path can see this, because the multiplication happens
   * inside Beds24 after the write. Reading it back is the only way to know, so
   * `beds24:status` compares it against the room's own occupancy.
   */
  async listRoomsWithRules(propertyId?: string) {
    const res = await this.requestAllPages<any>(
      '/properties',
      {
        includeAllRooms: 'true', includePriceRules: 'true',
        ...(propertyId ? { id: propertyId } : {}),
      },
    );
    const properties = (res.data as any)?.data ?? [];
    return properties.flatMap((p: any) => (p.roomTypes ?? []).map((rt: any) => ({
      id: String(rt.id),
      name: String(rt.name ?? ''),
      maxPeople: Number(rt.maxPeople ?? 0),
      // Only named rules are real; Beds24 pads the list out to sixteen empty
      // slots and those carry no `priceFor` at all.
      rules: (rt.priceRules ?? [])
        .filter((r: any) => r?.name)
        .map((r: any) => ({
          name: String(r.name),
          priceForType: r.priceFor?.type ?? null,
          upToPersonValue: r.priceFor?.upToPersonValue ?? null,
        })),
    })));
  }

  /**
   * The rooms Beds24 holds, flattened out of the property record.
   *
   * `/properties/rooms` is the obvious endpoint and it returns a bare 500 on at
   * least some live accounts — no body, no explanation, with or without a
   * `propertyId`. `/properties?includeAllRooms=true` returns the same rooms
   * nested under each property and works, so that is what is used.
   *
   * Normalised to a flat list here rather than at the call site, so the shape
   * the rest of the system sees does not depend on which endpoint answered.
   */
  async listRooms(propertyId?: string) {
    const res = await this.requestAllPages<any>(
      '/properties',
      { includeAllRooms: 'true', ...(propertyId ? { id: propertyId } : {}) },
    );
    const properties = (res.data as any)?.data ?? [];
    const rooms = properties.flatMap((p: any) =>
      (p.roomTypes ?? p.rooms ?? []).map((r: any) => ({
        ...r,
        propertyId: String(p.id),
        propertyName: p.name,
      })));
    return { ...res, data: { success: true, data: rooms } as any };
  }

  /**
   * The OTAs Beds24 knows for this property, and any rate codes it holds.
   *
   * **There is no endpoint for this.** Probed on a live account with the
   * `all:channels` scope granted: `/channels`, `/channels/booking`,
   * `/channels/airbnb` all answer HTTP 200 with a body of literally `null`, and
   * `/properties/channels` returns 500. So it is not a permissions problem and
   * there is nothing to fix by asking differently.
   *
   * The one place Beds24 does enumerate its channels is inside each room type's
   * price rules, where every supported channel appears as `{enable, rateCode}`.
   * That yields the catalogue — 38 channels on this property — which is what
   * makes the picker track Beds24 instead of a hardcoded list going stale.
   *
   * A **rate code** is the only per-channel signal in there worth anything: it
   * means a rate mapping exists on the Beds24 side. It is evidence a channel is
   * linked, not proof it is live — it outlives the connection that created it —
   * and callers report it as evidence, never as fact.
   *
   * `enable` is deliberately ignored: it is true for all 38 on an untouched
   * property, so it separates nothing.
   */
  async listChannelCatalogue(propertyId?: string) {
    const res = await this.requestAllPages<any>(
      '/properties',
      {
        includeAllRooms: 'true', includePriceRules: 'true',
        ...(propertyId ? { id: propertyId } : {}),
      },
    );
    const properties = (res.data as any)?.data ?? [];
    const codes = new Set<string>();
    const rateCodes: Record<string, string> = {};
    for (const p of properties) {
      for (const rt of p.roomTypes ?? []) {
        for (const rule of rt.priceRules ?? []) {
          for (const [code, cfg] of Object.entries<any>(rule.channels ?? {})) {
            codes.add(code);
            if (cfg?.rateCode) rateCodes[code] = String(cfg.rateCode);
          }
        }
      }
    }
    return { ...res, data: { codes: [...codes].sort(), rateCodes } };
  }

  /**
   * Change how many units of a room Beds24 sells.
   *
   * `POST /properties` takes the property with its room types nested, and only
   * the fields being changed. Verified against the live API with a property id
   * belonging to nobody:
   *
   *   POST /properties  [{id: 999999999, roomTypes: [{id: 888888888, qty: 8}]}]
   *   → 201  [{success: false, errors: [{action: "modify property",
   *                                      message: "access denied"}]}]
   *
   * **Note the 201.** Beds24 reports a refused write with a success-shaped HTTP
   * status and puts the refusal in the body, which is why the result goes back
   * through `readWriteResult` like every other write here. An inventory change
   * reported as applied when it was rejected is how the two sides drift.
   */
  setRoomQuantity(propertyId: string, rooms: Array<{ roomId: string; qty: number }>) {
    return this.request<any>('/properties', {
      method: 'POST',
      body: JSON.stringify([{
        id: Number(propertyId),
        roomTypes: rooms.map((r) => ({ id: Number(r.roomId), qty: r.qty })),
      }]),
    });
  }

  getCalendar(roomId: string, startDate: string, endDate: string) {
    return this.requestAllPages<any>('/inventory/rooms/calendar', {
      roomId, startDate, endDate, includeNumAvail: 'true', includePrices: 'true',
      includeMinStay: 'true', includeMaxStay: 'true', includeMultiplier: 'true',
    });
  }

  /**
   * Write availability, prices and restrictions.
   * Beds24 accepts an array of room calendars per call — batching by room
   * keeps a 30-day push inside a single request.
   */
  setCalendar(entries: Beds24CalendarEntry[]) {
    return this.request<{ success: boolean; data?: any[]; errors?: any[] }>(
      '/inventory/rooms/calendar',
      { method: 'POST', body: JSON.stringify(entries) },
    );
  }

  /**
   * Bookings that changed — **including the cancelled ones**.
   *
   * `status` is not optional in practice. Left off, Beds24 defaults it to
   * confirmed, request, new, black and inquiry: every booking except the ones
   * that stopped existing. So the poll was told about arrivals and amendments
   * and never once about a cancellation.
   *
   * The consequence was not a missing row, it was a room that stays sold. A
   * guest cancels on Booking.com, Beds24 records it, and Helio keeps the nights
   * blocked for ever — the front desk turns away a walk-in for a bed nobody is
   * sleeping in, and nothing anywhere reports a fault.
   *
   * `importBookings` has always known what to do with a cancellation: flip the
   * reservation and release its unposted nights. That code was simply never
   * reachable. Asking for the statuses explicitly is what switches it on.
   */
  getBookings(params: {
    modifiedFrom?: string; arrivalFrom?: string; propertyId?: string;
    includeInvoiceItems?: string; includeInfoItems?: string; status?: readonly string[];
  }) {
    const { status, ...rest } = params;
    return this.requestAllPages<any>('/bookings', {
      ...rest,
      status: [...(status ?? ALL_BOOKING_STATUSES)],
    });
  }

  getBookingMessages(bookingId: string) {
    return this.requestAllPages<any>('/bookings/messages', { bookingId });
  }

  /**
   * Messages across many bookings in one call — the bulk alternative to asking
   * per booking.
   *
   * This used to take `modifiedFrom`, which is not a parameter of this endpoint.
   * Beds24 ignores query parameters it does not recognise rather than refusing
   * them — `/bookings?thisParamDoesNotExist=xyz` answers 200 — so the filter was
   * dropped on the floor and the call returned the property's entire message
   * history every time it ran. `maxAge`, in days, is the documented bound.
   *
   * Nothing calls this yet: the inbox poll in `services/messaging.ts` asks per
   * booking instead, which is correct but costs one request per reservation.
   */
  getMessagesSince(params: { maxAgeDays?: number; propertyId?: string; unreadOnly?: boolean }) {
    return this.requestAllPages<any>('/bookings/messages', {
      maxAge: params.maxAgeDays,
      propertyId: params.propertyId,
      ...(params.unreadOnly ? { filter: 'unread' } : {}),
    });
  }

  /**
   * Send a message to the guest through the channel the booking came from.
   *
   * 🔌 Not confirmed against a live account. Beds24 relays guest messages for
   * the OTAs that support it — Booking.com and Airbnb among them — and silently
   * accepts them for those that do not, which is the failure mode that matters:
   * the write succeeds and the guest never hears anything. Nothing here reports
   * a message as *delivered*; the strongest claim made is that the channel
   * accepted it.
   */
  sendBookingMessage(bookingId: string, message: string) {
    return this.request<Beds24WriteResponse>(
      '/bookings/messages',
      { method: 'POST', body: JSON.stringify([{ bookingId, message }]) },
    );
  }

  /**
   * Change a booking's status at the channel — this is how a no-show is
   * reported back to Booking.com.
   *
   * 🔌 The shape below is written from the documented `POST /bookings`
   * behaviour and has **not** been confirmed against a funded Beds24 account
   * connected to a live Booking.com property. Two things need checking before
   * it is trusted: whether Booking.com no-shows are reported as a cancellation
   * with a sub-status or through a dedicated field, and how long after arrival
   * the channel still accepts the report.
   *
   * Everything around this call is built so an unconfirmed guess cannot become
   * a false claim — the raw request and response are stored, and a reservation
   * is only marked reported when the API says the write actually succeeded.
   */
  setBookingStatus(bookingId: string, patch: Beds24BookingPatch) {
    return this.request<Beds24WriteResponse>(
      '/bookings', { method: 'POST', body: JSON.stringify([{ id: bookingId, ...patch }]) },
    );
  }
}

export interface Beds24BookingPatch {
  status?: 'new' | 'request' | 'confirmed' | 'cancelled' | 'black';
  subStatus?: string;
  /** Beds24 passes this to the channel on the OTAs that accept a reason. */
  cancelReason?: string;
  notes?: string;
}

/**
 * Beds24 answers a write with a per-item result rather than an HTTP error, so a
 * 200 does not mean the booking changed. `success` on the envelope *and* on the
 * item both have to be true before anything may be called reported.
 */
export interface Beds24WriteResponse {
  success?: boolean;
  errors?: Array<{ error?: string; field?: string }>;
  data?: Array<{
    success?: boolean;
    id?: string | number;
    errors?: Array<{ error?: string; field?: string }>;
    warnings?: string[];
  }>;
}

/** How long any single Beds24 call may take before it is abandoned. */
export const REQUEST_TIMEOUT_MS = config.beds24TimeoutMs;

/** Thrown when a call was abandoned rather than refused. */
export class ChannelTimeout extends Error {
  constructor(what: string, ms: number) {
    super(`${HUB} did not answer ${what} within ${Math.round(ms / 1000)}s`);
    this.name = 'ChannelTimeout';
  }
}

/**
 * Thrown when the request never became an HTTP response at all.
 *
 * Node reports every one of these as `TypeError: fetch failed` and keeps the
 * actual fault one level down in `cause`. Rethrown as-is, the log reads
 *
 *   booking poll failed for prp_8acd…: fetch failed
 *
 * for a DNS outage, a refused connection, a reset socket, a laptop that has
 * just woken up and a proxy intercepting TLS alike. Those have nothing in
 * common and are fixed in five different places, so that line is worse than
 * useless — it occupies the space where the answer should be and looks like
 * information. This unwraps the chain and says which of them it was.
 */
export class ChannelUnreachable extends Error {
  code = 'channel_unreachable';
  constructor(what: string, cause: unknown) {
    // "for", because `what` is a noun phrase — "a token refresh", "a calendar
    // write". Without it the sentence reads "could not reach the channel
    // manager a token refresh", which was true in the original too.
    super(`Could not reach ${HUB} for ${what} — ${describeNetworkError(cause)}`, { cause });
    this.name = 'ChannelUnreachable';
  }
}

// Only the causes worth translating. Anything else keeps its own words rather
// than being flattened into a vague one, because an unrecognised fault is
// exactly the one where the raw text matters most.
const NETWORK_CAUSES: Record<string, string> = {
  ENOTFOUND: 'DNS could not resolve the host; the machine is probably offline',
  EAI_AGAIN: 'the DNS lookup timed out, which usually means a network still coming up or a VPN mid-connect',
  ECONNREFUSED: 'the host actively refused the connection',
  ECONNRESET: 'the connection was reset while the request was in flight',
  EPIPE: 'the connection closed while the request was being written',
  ETIMEDOUT: 'the connection timed out',
  EHOSTUNREACH: 'there is no route to the host',
  ENETUNREACH: 'the network is unreachable',
  ENETDOWN: 'the local network is down',
  UND_ERR_CONNECT_TIMEOUT: 'the connection could not be established in time',
  UND_ERR_SOCKET: 'the socket closed unexpectedly',
  CERT_HAS_EXPIRED: "the server's TLS certificate has expired",
  DEPTH_ZERO_SELF_SIGNED_CERT: 'the TLS certificate is self-signed; something is intercepting HTTPS',
  SELF_SIGNED_CERT_IN_CHAIN: 'a self-signed certificate is in the chain; a corporate proxy will do this',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'the TLS certificate could not be verified; a proxy intercepting HTTPS will do this',
};

/**
 * The first fault in the chain that actually names itself.
 *
 * Breadth-first over both `cause` and `errors`, because the reason is not
 * always one link down. A host that resolves to several addresses fails once
 * per address, and Node reports that as an `AggregateError` holding the real
 * errors in `errors` while carrying no code itself — which is exactly the shape
 * a plain `cause` walk falls straight through, ending back at "fetch failed".
 */
function describeNetworkError(e: unknown): string {
  const seen = new Set<unknown>();
  const queue: unknown[] = [e];
  // Not every transport failure carries a code — undici rejects a request to a
  // blocked port with a bare "bad port", for one. The deepest message in the
  // chain is still worth far more than the outermost, which is always the same
  // "fetch failed" that sent us looking in the first place.
  let deepest = '';
  while (queue.length) {
    const cur = queue.shift();
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);   // chains can loop; this one does not have to prove it
    // `hostname` is set by DNS failures and is the single most useful word in
    // the message; neither it nor `errors` is on the built-in type.
    const err = cur as NodeJS.ErrnoException & { hostname?: string; errors?: unknown[] };
    if (err.code) {
      const known = NETWORK_CAUSES[err.code];
      const where = err.hostname ? ` (${err.hostname})` : '';
      return known ? `${known} [${err.code}]${where}` : `${err.message} [${err.code}]${where}`;
    }
    if (err.message) deepest = err.message;
    if (Array.isArray(err.errors)) queue.push(...err.errors);
    if (err.cause) queue.push(err.cause);
  }
  return deepest || (e instanceof Error ? e.message : String(e));
}

/**
 * Run a request with a deadline.
 *
 * Node's `fetch` has no default timeout, so a socket that opens and then goes
 * quiet waits for ever. That is worse than an error: the background drain and
 * message poll each guard against overlapping runs, and although those guards
 * are released in a `finally`, a promise that never settles never reaches it.
 * One dead connection therefore stopped every future push and poll for the life
 * of the process — silently, because nothing had failed.
 *
 * A deadline turns that into an ordinary error the existing retry and
 * sync-logging paths already know how to record.
 */
async function withTimeout(
  run: (signal: AbortSignal) => Promise<Response>, what: string,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } catch (e) {
    // Distinguish "we gave up" from "the network refused" — the operator needs
    // to know which, and they call for different fixes.
    if (controller.signal.aborted) throw new ChannelTimeout(what, REQUEST_TIMEOUT_MS);
    // A transport failure, which arrives as an opaque `TypeError: fetch failed`.
    // Anything else — a bug in the caller, say — is left exactly as it is.
    if (e instanceof TypeError) throw new ChannelUnreachable(what, e);
    throw e;
  } finally {
    // Always cleared: a pending timer keeps the process alive on shutdown.
    clearTimeout(timer);
  }
}

/**
 * Did a Beds24 write actually do anything?
 *
 * A 200 does not mean it did. Beds24 accepts the request at the HTTP level and
 * then reports per-item outcomes inside the body, so a push whose rooms were
 * every one rejected still arrives as a clean 200 with `success: true` on the
 * envelope. Reading only the envelope is how a channel gets marked healthy while
 * it carries on selling a room the property has closed.
 *
 * Both levels must agree, and a missing item is a failure rather than a silence
 * to be read as consent. Every write path shares this one function so a fourth
 * cannot quietly disagree with the other three.
 */
export function readWriteResult(raw: { data?: any }): {
  ok: boolean; errors: unknown[]; items: number; failedItems: number;
} {
  const envelopeOk = raw.data?.success !== false;
  const items: any[] = Array.isArray(raw.data?.data) ? raw.data.data : [];
  const envelopeErrors: unknown[] = Array.isArray(raw.data?.errors) ? raw.data.errors : [];

  const itemErrors = items.flatMap((it) => {
    const failed = it?.success === false;
    const errs: unknown[] = Array.isArray(it?.errors) ? it.errors : [];
    if (failed && !errs.length) return [{ error: 'The channel rejected this item without saying why' }];
    return failed || errs.length ? errs : [];
  });

  const failedItems = items.filter((it) => it?.success === false || (it?.errors?.length ?? 0) > 0).length;
  const errors = [...envelopeErrors, ...itemErrors];

  return {
    ok: envelopeOk && !errors.length && failedItems === 0,
    errors,
    items: items.length,
    failedItems,
  };
}

export interface Beds24CalendarEntry {
  roomId: string;
  calendar: {
    from: string;
    to: string;
    numAvail?: number;
    price1?: number;          // Beds24 prices are decimal major units
    minStay?: number;
    maxStay?: number;
    /** 1 = closed to arrival */
    closedArrival?: number;
    closedDeparture?: number;
    /** 0 blocks the date entirely */
    override?: number;
  }[];
}

/**
 * Group consecutive dates that share identical values into ranges — Beds24
 * charges per request, and a flat month is one range rather than thirty.
 */
export function compressCalendar(
  cells: { date: string; numAvail: number; priceMajor: number; minStay?: number; maxStay?: number;
           cta?: boolean; ctd?: boolean; stopSell?: boolean }[],
): Beds24CalendarEntry['calendar'] {
  const out: Beds24CalendarEntry['calendar'] = [];
  const signature = (c: (typeof cells)[number]) =>
    `${c.numAvail}|${c.priceMajor}|${c.minStay ?? ''}|${c.maxStay ?? ''}|${c.cta ? 1 : 0}|${c.ctd ? 1 : 0}|${c.stopSell ? 1 : 0}`;

  let runStart: (typeof cells)[number] | null = null;
  let runEnd = '';
  let runSig = '';

  const flush = () => {
    if (!runStart) return;
    out.push({
      from: runStart.date,
      to: runEnd,
      numAvail: runStart.stopSell ? 0 : runStart.numAvail,
      price1: runStart.priceMajor,
      minStay: runStart.minStay,
      maxStay: runStart.maxStay,
      closedArrival: runStart.cta ? 1 : 0,
      closedDeparture: runStart.ctd ? 1 : 0,
    });
  };

  for (const c of cells.slice().sort((a, b) => a.date.localeCompare(b.date))) {
    const sig = signature(c);
    if (runStart && sig === runSig) { runEnd = c.date; continue; }
    flush();
    runStart = c;
    runEnd = c.date;
    runSig = sig;
  }
  flush();
  return out;
}

/** Normalise a Beds24 booking into the shape the PMS importer expects. */
export interface NormalisedBooking {
  externalId: string;
  channelRef: string;
  channel: string;
  status: string;
  guestName: string;
  email: string;
  phone: string;
  arrival: string;
  departure: string;
  adults: number;
  children: number;
  externalRoomId: string;
  externalRateId: string;
  /**
   * The booking price: what the guest agreed to pay in total.
   *
   * For most channels this is Beds24's `price`. For Hostelworld it is **not**:
   * Beds24 records a Hostelworld booking with `price` = the balance the guest
   * pays on arrival and `commission` = the deposit Hostelworld already took,
   * so the booking price is the two added together. The `rateDescription`
   * says as much in Hostelworld's own words ("Paid USD 19.32 / Due USD
   * 45.07"), and its nightly lines add up to the same figure — the one the
   * confirmation email calls "Total Price". See `hostelworldTotal`.
   */
  totalMajor: number;
  /** Beds24's `price` field as sent, before any of that reading. */
  priceMajor: number;
  commissionMajor: number;
  /**
   * What the OTA collected from the guest at booking time, when Beds24 says.
   *
   * Hostelworld takes a deposit on its site and keeps it as commission; the
   * guest pays the rest at the desk. Beds24 carries that as `deposit` on the
   * booking, as "Paid" in the `rateDescription`, and, when invoice items are
   * requested, as a payment line naming Hostelworld. Zero means Beds24 said
   * nothing — not that nothing was taken.
   */
  depositMajor: number;
  /** "Balance Due - On Arrival" as the channel stated it, or null when it did not. */
  dueMajor: number | null;
  /** The per-night prices the channel sold at, when it listed them. */
  nightly: ChannelNight[];
  /** The OTA's own booking reference — Hostelworld's "336798-580229521". */
  otaBookingRef: string;
  /** When the guest booked, as the channel reported it. */
  bookedAt: string | null;
  /** Hostelworld's cancellation deadlines, from the rate description. */
  cancellableUntil: string | null;
  freeCancellableUntil: string | null;
  /** Who collects what: Beds24's HOTELCOLLECT / CHANNELCOLLECT info line, when requested. */
  collectNote: string | null;
  currency: string;
  notes: string;
  raw: unknown;
}

/** One night as the channel sold it. */
export interface ChannelNight {
  date: string;
  pax: number;
  /** Per bed (or per room), in major units. */
  rateMajor: number;
  rateId: string | null;
}

/** What Beds24's `rateDescription` says about a Hostelworld booking. */
export interface RateDescription {
  paidMajor: number | null;
  dueMajor: number | null;
  cancellableUntil: string | null;
  freeCancellableUntil: string | null;
  nights: ChannelNight[];
}

/**
 * Read Beds24's free-text `rateDescription`.
 *
 * For a Hostelworld booking it is the most complete money statement Beds24
 * carries, and the only one that agrees line for line with the confirmation
 * email Hostelworld sends the property:
 *
 *     Paid USD 19.32
 *     Due USD 45.07
 *     Cancellable until 2026-09-28 23:59:59
 *     Free Cancellable until 2026-09-28 18:29:59
 *     2026-09-30, 1 pax, USD 7.99 per bed, rate id 2032723
 *     2026-10-01, 1 pax, USD 9.40 per bed, rate id 2032723
 *
 * Anything that does not match is ignored: another channel's description is
 * a different shape, and a missing line simply reads as null.
 */
export function parseRateDescription(text: unknown): RateDescription {
  const out: RateDescription = {
    paidMajor: null, dueMajor: null, cancellableUntil: null, freeCancellableUntil: null, nights: [],
  };
  if (typeof text !== 'string' || !text.trim()) return out;
  const amount = (s: string) => {
    const n = Number(s.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^paid\s+[A-Z]{3}\s+([\d.,]+)/i))) { out.paidMajor = amount(m[1]); continue; }
    if ((m = line.match(/^due\s+[A-Z]{3}\s+([\d.,]+)/i))) { out.dueMajor = amount(m[1]); continue; }
    if ((m = line.match(/^free\s+cancellable\s+until\s+(.+)$/i))) { out.freeCancellableUntil = m[1].trim(); continue; }
    if ((m = line.match(/^cancellable\s+until\s+(.+)$/i))) { out.cancellableUntil = m[1].trim(); continue; }
    if ((m = line.match(/^(\d{4}-\d{2}-\d{2}),\s*(\d+)\s*pax,\s*[A-Z]{3}\s+([\d.,]+)\s+per\s+\w+(?:,\s*rate\s+id\s+(\S+))?/i))) {
      const rate = amount(m[3]);
      if (rate !== null) {
        out.nights.push({ date: m[1], pax: Number(m[2]) || 1, rateMajor: rate, rateId: m[4] ?? null });
      }
    }
  }
  return out;
}

/**
 * The booking price of a Hostelworld booking, from what Beds24 sent.
 *
 * Three readings, most trustworthy first, each cross-checked against the
 * next where both are present:
 *
 *   1. "Paid" + "Due" from the rate description — Hostelworld's own words.
 *   2. The nightly lines added up (per-bed price × pax).
 *   3. `price` + `commission`, Beds24's convention for Hostelworld: the price
 *      is what the property collects, the commission is the deposit
 *      Hostelworld kept, and the guest agreed to both.
 *
 * When Beds24 carries an explicit `deposit` instead, `price` is already the
 * whole booking and is returned untouched — that is the shape every other
 * channel uses, and the one the rest of the importer always expected.
 */
export function hostelworldTotal(b: {
  priceMajor: number; commissionMajor: number; depositMajor: number;
  rate: RateDescription;
}): { totalMajor: number; depositMajor: number; dueMajor: number | null } {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const { rate } = b;
  const nightsSum = rate.nights.length
    ? r2(rate.nights.reduce((s, n) => s + n.rateMajor * Math.max(1, n.pax), 0)) : null;

  if (rate.paidMajor !== null && rate.dueMajor !== null) {
    return {
      totalMajor: r2(rate.paidMajor + rate.dueMajor),
      depositMajor: rate.paidMajor,
      dueMajor: rate.dueMajor,
    };
  }
  if (b.depositMajor > 0) {
    // An explicit deposit: `price` is the whole booking, as on every channel.
    return { totalMajor: b.priceMajor, depositMajor: b.depositMajor, dueMajor: r2(b.priceMajor - b.depositMajor) };
  }
  if (b.commissionMajor > 0) {
    const total = r2(b.priceMajor + b.commissionMajor);
    // The nightly lines are the tie-break when they exist: if they add up to
    // the price alone, the commission was on top and not part of the price.
    if (nightsSum !== null && Math.abs(nightsSum - b.priceMajor) < 0.011) {
      return { totalMajor: b.priceMajor, depositMajor: b.commissionMajor, dueMajor: r2(b.priceMajor - b.commissionMajor) };
    }
    return { totalMajor: total, depositMajor: b.commissionMajor, dueMajor: b.priceMajor };
  }
  return { totalMajor: nightsSum ?? b.priceMajor, depositMajor: 0, dueMajor: null };
}

/** The same test the OTA table applies, without importing it here. */
function looksHostelworld(b: any): boolean {
  const names = [b.referer, b.apiSource, b.channel].map((v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, ''));
  return names.some((n) => n.startsWith('hostelworld'));
}

const BEDS24_STATUS: Record<string, string> = {
  '0': 'Cancelled', '1': 'Confirmed', '2': 'Confirmed', '3': 'Checked-in', '4': 'Checked-out',
  cancelled: 'Cancelled', confirmed: 'Confirmed', new: 'Confirmed', request: 'Tentative',
  black: 'Cancelled',
};

export function normaliseBooking(b: any): NormalisedBooking {
  const first = b.firstName ?? b.guestFirstName ?? '';
  const last = b.lastName ?? b.guestName ?? '';
  const priceMajor = Number(b.price ?? b.total ?? 0) || 0;
  const commissionMajor = Number(b.commission ?? 0) || 0;
  const rate = parseRateDescription(b.rateDescription);
  const money = looksHostelworld(b)
    ? hostelworldTotal({ priceMajor, commissionMajor, depositMajor: depositOf(b), rate })
    : { totalMajor: priceMajor, depositMajor: depositOf(b), dueMajor: null };
  // "HOTELCOLLECT · Guest pays 45.07 USD OTA pays 0.00 USD" — who collects
  // what, in Beds24's words, when the call asked for info items.
  const collect = (Array.isArray(b.infoItems) ? b.infoItems : [])
    .find((it: any) => /collect/i.test(String(it?.code ?? '')));
  return {
    externalId: String(b.id ?? b.bookId ?? ''),
    channelRef: String(b.apiReference ?? b.referer ?? b.bookingId ?? b.id ?? ''),
    channel: String(b.referer ?? b.apiSource ?? b.channel ?? 'Beds24'),
    status: BEDS24_STATUS[String(b.status).toLowerCase()] ?? 'Confirmed',
    guestName: `${first} ${last}`.trim() || String(b.guestName ?? 'Guest'),
    email: String(b.email ?? b.guestEmail ?? ''),
    phone: String(b.phone ?? b.mobile ?? ''),
    arrival: String(b.arrival ?? '').slice(0, 10),
    departure: String(b.departure ?? '').slice(0, 10),
    adults: Number(b.numAdult ?? b.adults ?? 1) || 1,
    children: Number(b.numChild ?? b.children ?? 0) || 0,
    externalRoomId: String(b.roomId ?? ''),
    externalRateId: String(b.rateId ?? b.roomRateId ?? ''),
    totalMajor: money.totalMajor,
    priceMajor,
    commissionMajor,
    depositMajor: money.depositMajor,
    dueMajor: money.dueMajor,
    nightly: rate.nights,
    otaBookingRef: String(b.apiReference ?? ''),
    bookedAt: b.bookingTime ? String(b.bookingTime) : null,
    cancellableUntil: rate.cancellableUntil,
    freeCancellableUntil: rate.freeCancellableUntil,
    collectNote: collect ? `${String(collect.code ?? '')}${collect.text ? ` · ${String(collect.text)}` : ''}` : null,
    currency: String(b.currency ?? ''),
    notes: String(b.comments ?? b.notes ?? b.message ?? ''),
    raw: b,
  };
}

/**
 * The deposit the OTA took, read two ways.
 *
 * The `deposit` field is preferred. Failing that, the invoice items — present
 * only when the bookings call asked for them — are searched for a payment
 * that names the OTA or calls itself a deposit or commission. A plain payment
 * line is left alone: it may be money the property itself recorded in Beds24,
 * which is not the OTA's to have taken.
 */
function depositOf(b: any): number {
  const direct = Number(b.deposit ?? 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const items: any[] = Array.isArray(b.invoiceItems) ? b.invoiceItems : [];
  let sum = 0;
  for (const it of items) {
    if (String(it?.type ?? '').toLowerCase() !== 'payment') continue;
    const text = String(it?.description ?? '').toLowerCase();
    if (!/hostelworld|deposit|commission/.test(text)) continue;
    const amount = Number(it.lineTotal ?? (Number(it.amount ?? 0) * Number(it.qty ?? 1)));
    if (Number.isFinite(amount)) sum += Math.abs(amount);
  }
  return sum;
}
