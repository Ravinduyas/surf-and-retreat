// ─────────────────────────────────────────────────────────────
// HTTP client for the Helio PMS API.
//
// Every screen reads and writes through here — there is no local sample data
// anywhere in the app. The session token and the selected property travel on
// each request; a rejected session drops the user back to sign-in.
// ─────────────────────────────────────────────────────────────

import {
  cacheRead, cachedRead, offlineRefusal, isQueueable, enqueueWrite,
  markServerReachable, replayQueue, clearOfflineCache,
} from './offline';
import { config } from './config';

/**
 * Where the API lives. Set with `VITE_API_URL`; see `src/config.ts`.
 *
 * This used to fall back to a hardcoded production address, which meant a
 * build that had lost the variable pointed at the live property instead of
 * failing. The deployed address is now a value in `.env.production`.
 */
export const API_BASE: string = config.apiUrl;

const TOKEN_KEY = 'helio.pms.token';
const PROPERTY_KEY = 'helio.pms.property';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else {
      localStorage.removeItem(TOKEN_KEY);
      // A cached arrivals list is guest personal data. Signing out has to take
      // it with them, or the next person at this terminal can read it offline.
      clearOfflineCache();
    }
  } catch { /* private mode */ }
}
export function getPropertyId(): string | null {
  try { return localStorage.getItem(PROPERTY_KEY); } catch { return null; }
}
export function setPropertyId(id: string | null) {
  try {
    if (id) localStorage.setItem(PROPERTY_KEY, id);
    else localStorage.removeItem(PROPERTY_KEY);
  } catch { /* private mode */ }
}

export class ApiError extends Error {
  status: number;
  code: string;
  details: any;
  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
  /** Restriction violations / availability shortfalls, when the API sent them. */
  get violations(): { type: string; date: string; message: string }[] {
    return this.details?.violations ?? [];
  }
  get shortfall(): { date: string; available: number }[] {
    return this.details?.shortfall ?? [];
  }
}

type Listener = (event: 'unauthenticated' | 'setup-required') => void;
const listeners = new Set<Listener>();
export function onAuthEvent(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(event: 'unauthenticated' | 'setup-required') {
  for (const l of listeners) l(event);
}

/**
 * Thrown when a write cannot be done offline and must not be queued.
 *
 * Carries the reason as a sentence rather than a status code, because a
 * receptionist needs to know what to do instead — not that the network failed.
 */
export class OfflineRefusal extends ApiError {
  constructor(reason: string) {
    super(0, reason, 'offline_refused');
    this.name = 'OfflineRefusal';
  }
}

/** Resolved locally because the write is safely queued for later. */
export class QueuedOffline extends Error {
  readonly queued = true;
  constructor(public description: string) {
    super(`${description} — saved, and will sync when you are back online`);
    this.name = 'QueuedOffline';
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const property = getPropertyId();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(property ? { 'x-property-id': property } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    markServerReachable(true);
  } catch {
    markServerReachable(false);

    // ── Offline: decide by operation, never by convenience ────
    if (method === 'GET') {
      const cached = cachedRead<T>(path, property);
      if (cached) {
        // Answering from cache is only acceptable because the caller is told
        // how old it is — see `lastReadAge`, which the screens render.
        lastAge.set(path, cached.ageSeconds);
        return cached.body;
      }
    } else {
      const refusal = offlineRefusal(path);
      if (refusal) throw new OfflineRefusal(refusal);
      if (isQueueable(method, path)) {
        const item = enqueueWrite(method, path, body, property);
        throw new QueuedOffline(item.description);
      }
      // Not explicitly safe, so not queued. Anything new defaults to refusing
      // rather than to guessing that it is harmless.
      throw new OfflineRefusal(
        'This change needs a connection to the server. It has not been saved — '
        + 'try again once you are back online.');
    }

    // A blocked cross-origin request is indistinguishable from a dead server
    // in the browser, so name both possibilities rather than guessing.
    throw new ApiError(0,
      `Cannot reach the Helio API at ${API_BASE}. Check that the server is running and that `
      + `this address (${window.location.origin}) is in its CORS_ORIGIN allowlist.`,
      'network');
  }

  const text = await res.text();
  const payload = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;

  if (!res.ok) {
    const message = typeof payload === 'object' && payload?.error ? payload.error : res.statusText;
    const code = typeof payload === 'object' && payload?.code ? payload.code : 'error';
    if (res.status === 401) { setToken(null); emit('unauthenticated'); }
    if (res.status === 428) emit('setup-required');
    throw new ApiError(res.status, message, code, typeof payload === 'object' ? payload?.details : undefined);
  }

  // A fresh answer replaces any cached one and clears its staleness marker.
  if (method === 'GET') {
    cacheRead(path, property, payload);
    lastAge.delete(path);
  }
  return payload as T;
}

/**
 * How stale the last answer for a path was, in seconds — or 0 if it came live
 * from the server.
 *
 * Kept beside the data rather than inside it so the cached body is byte-for-byte
 * what the server sent. A screen reads this to say "showing data from 14 minutes
 * ago" instead of presenting stale numbers as current, which for occupancy or a
 * folio balance is the difference between useful and misleading.
 */
const lastAge = new Map<string, number>();

export function lastReadAge(path: string): number {
  return lastAge.get(path) ?? 0;
}

/** Send everything the queue is holding. Called when the connection returns. */
export function flushOfflineQueue() {
  return replayQueue(async (item) => {
    await request(item.method, item.path, item.body);
  });
}

export const api = {
  get:    <T = any>(path: string) => request<T>('GET', path),
  post:   <T = any>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put:    <T = any>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch:  <T = any>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  delete: <T = any>(path: string, body?: unknown) => request<T>('DELETE', path, body ?? {}),
};

/** Build a query string, dropping empty values. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// ─── Health / setup ──────────────────────────────────────────
export interface HealthResponse {
  ok: boolean; service: string; setupRequired: boolean; time: string;
}
export async function health(): Promise<HealthResponse> {
  return api.get<HealthResponse>('/health');
}
