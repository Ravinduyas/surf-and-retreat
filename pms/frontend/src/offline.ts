// ─────────────────────────────────────────────────────────────
// The offline front desk.
//
// Hostel wifi drops. A receptionist with a guest in front of them needs to see
// tonight's arrivals whether or not the connection is up — but a PMS cannot
// simply "work offline" the way a note-taking app can.
//
// Helio prevents overbooking because every booking passes through one
// serialised writer: twelve simultaneous requests for the last room produce
// exactly one booking. A client that queued bookings offline would destroy that
// — two devices each take "the last room", both replay, and the property is
// oversold with a clean sync log. The same reasoning rules out offline
// payments, rate changes and the night audit.
//
// So the rule here is deliberately asymmetric:
//
//   **Reads: cached generously. Writes: only where the operation is idempotent
//   and cannot conflict. Everything else refuses, and says why.**
//
// A queued booking that "will sync later" is precisely the green tick for
// something that did not happen that the rest of this system refuses to show.
// ─────────────────────────────────────────────────────────────

const CACHE_KEY = 'helio.pms.offline.v1';
const QUEUE_KEY = 'helio.pms.queue.v1';

// Reads worth keeping. Everything a person needs to run the desk for the next
// few hours, and nothing else — a cached report is not worth the storage or the
// staleness confusion.
const CACHEABLE = [
  '/api/front-desk',
  '/api/reservations',
  '/api/rooms',
  '/api/room-types',
  '/api/housekeeping',
  '/api/property',
  '/api/dashboard',
  '/api/profiles',
  '/api/auth/me',
];

/**
 * Writes that may be queued.
 *
 * Both are idempotent, single-actor and conflict-tolerant: setting a room's
 * status is the same operation however many times it runs, one attendant works
 * one room, and last-write-wins is genuinely the right answer. They are also
 * exactly the work done in corridors where the signal is worst.
 */
const QUEUEABLE: Array<{ method: string; pattern: RegExp; describe: (body: any) => string }> = [
  {
    method: 'PATCH',
    pattern: /^\/api\/rooms\/[^/]+$/,
    describe: (b) => `Room status → ${b?.status ?? 'updated'}`,
  },
  {
    method: 'POST',
    pattern: /^\/api\/housekeeping\/tasks\/[^/]+\/(start|complete|inspect)$/,
    describe: () => 'Housekeeping task update',
  },
];

/**
 * Why a write cannot be queued. Written as sentences a person can act on,
 * because "network error" tells a receptionist nothing about what to do next.
 */
const REFUSALS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /^\/api\/reservations(\/|$)/,
    reason: 'A booking cannot be taken offline — two devices could sell the same '
      + 'room. Write the details down and enter it when the connection is back.',
  },
  {
    pattern: /^\/api\/folios?\//,
    reason: 'A payment cannot be recorded offline. Take it on the card terminal '
      + 'and post it here once you are back online, so the folio is never wrong.',
  },
  {
    pattern: /^\/api\/(check-in|check-out)/,
    reason: 'Check-in and check-out move inventory and post charges, so they need '
      + 'the server. The guest list below is still readable.',
  },
  {
    pattern: /^\/api\/(rates|closeouts|inventory)/,
    reason: 'Rate and availability changes go out to the OTAs. Sending them late '
      + 'is worse than not sending them, so they wait for a connection.',
  },
  {
    pattern: /^\/api\/night-audit/,
    reason: 'The night audit is one all-or-nothing transaction across the whole '
      + 'property. It cannot be started without the server.',
  },
];

export function offlineRefusal(path: string): string | null {
  return REFUSALS.find((r) => r.pattern.test(path))?.reason ?? null;
}

export function isQueueable(method: string, path: string): boolean {
  return QUEUEABLE.some((q) => q.method === method.toUpperCase() && q.pattern.test(path));
}

function describeWrite(method: string, path: string, body: any): string {
  return QUEUEABLE.find((q) => q.method === method.toUpperCase() && q.pattern.test(path))
    ?.describe(body) ?? `${method} ${path}`;
}

// ─── Cached reads ────────────────────────────────────────────

interface CacheEntry {
  body: unknown;
  at: number;
  propertyId: string | null;
}

type CacheMap = Record<string, CacheEntry>;

function readCache(): CacheMap {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}'); } catch { return {}; }
}

function writeCache(map: CacheMap) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {
    // Storage full. Drop the oldest half rather than losing everything — the
    // most recent reads are the ones somebody is about to need.
    const entries = Object.entries(map).sort((a, b) => b[1].at - a[1].at);
    const kept = Object.fromEntries(entries.slice(0, Math.floor(entries.length / 2)));
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(kept)); } catch { /* give up */ }
  }
}

export function isCacheable(path: string): boolean {
  return CACHEABLE.some((p) => path.startsWith(p));
}

export function cacheRead(path: string, propertyId: string | null, body: unknown) {
  if (!isCacheable(path)) return;
  const map = readCache();
  map[path] = { body, at: Date.now(), propertyId };
  writeCache(map);
}

export interface CachedAnswer<T> {
  body: T;
  /** How long ago it was fetched, in seconds. */
  ageSeconds: number;
}

/**
 * The cached answer for a path, if there is one for *this* property.
 *
 * The property check is not incidental: showing one hotel's arrivals list to
 * another is the same failure as the cross-property header bug, arriving by a
 * different route.
 */
export function cachedRead<T>(path: string, propertyId: string | null): CachedAnswer<T> | null {
  const entry = readCache()[path];
  if (!entry) return null;
  if ((entry.propertyId ?? null) !== (propertyId ?? null)) return null;
  return { body: entry.body as T, ageSeconds: Math.round((Date.now() - entry.at) / 1000) };
}

/** Signing out must take the guest data with it. */
export function clearOfflineCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(QUEUE_KEY);
  } catch { /* private mode */ }
}

// ─── The queue ───────────────────────────────────────────────

export interface QueuedWrite {
  id: string;
  method: string;
  path: string;
  body: unknown;
  propertyId: string | null;
  queuedAt: number;
  attempts: number;
  /** Set when the server refused it. Needs a person, not another retry. */
  error?: string;
  description: string;
}

export function readQueue(): QueuedWrite[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]'); } catch { return []; }
}

function writeQueue(items: QueuedWrite[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(items)); } catch { /* private mode */ }
  notify();
}

export function enqueueWrite(
  method: string, path: string, body: unknown, propertyId: string | null,
): QueuedWrite {
  const item: QueuedWrite = {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    method, path, body, propertyId,
    queuedAt: Date.now(),
    attempts: 0,
    description: describeWrite(method, path, body),
  };
  writeQueue([...readQueue(), item]);
  return item;
}

export function removeQueued(id: string) {
  writeQueue(readQueue().filter((q) => q.id !== id));
}

function updateQueued(id: string, patch: Partial<QueuedWrite>) {
  writeQueue(readQueue().map((q) => (q.id === id ? { ...q, ...patch } : q)));
}

// ─── Subscribers ─────────────────────────────────────────────
// The shell shows the pending count, so it has to hear about changes.

type Listener = () => void;
const listeners = new Set<Listener>();

export function onOfflineChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function notify() {
  for (const fn of listeners) fn();
}

// ─── Replay ──────────────────────────────────────────────────

/**
 * Send everything waiting, oldest first.
 *
 * Order matters: two status changes to the same room must land in the order
 * they were made, or the room ends up in the state it was in first.
 *
 * A **rejected** write is not retried. The server said no — the room was
 * reassigned, the task was cancelled — and hammering it will not change that.
 * It stays in the queue carrying its reason so a person can resolve it, because
 * silently dropping somebody's work is the one outcome worse than failing.
 */
export async function replayQueue(
  send: (item: QueuedWrite) => Promise<void>,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const item of readQueue()) {
    if (item.error) { failed++; continue; }      // already needs a human
    try {
      await send(item);
      removeQueued(item.id);
      sent++;
    } catch (e: any) {
      const status = e?.status ?? 0;
      if (status >= 400 && status < 500) {
        // A refusal, not a connection problem.
        updateQueued(item.id, {
          error: e?.message ?? 'The server would not accept this change',
          attempts: item.attempts + 1,
        });
        failed++;
      } else {
        // Still offline, or the server is down. Leave it untouched and stop —
        // continuing would just burn through the rest for the same reason.
        updateQueued(item.id, { attempts: item.attempts + 1 });
        break;
      }
    }
  }
  return { sent, failed };
}

// ─── Connectivity ────────────────────────────────────────────

/**
 * `navigator.onLine` answers "is there a network interface", which on hostel
 * wifi is often yes while nothing actually reaches the server. The API client
 * reports what really happened, and that is what the app trusts.
 */
let serverReachable = true;

export function markServerReachable(reachable: boolean) {
  if (serverReachable === reachable) return;
  serverReachable = reachable;
  notify();
}

export function isOffline(): boolean {
  return !serverReachable || (typeof navigator !== 'undefined' && navigator.onLine === false);
}

export function offlineState() {
  const queue = readQueue();
  return {
    offline: isOffline(),
    pending: queue.filter((q) => !q.error).length,
    failed: queue.filter((q) => q.error).length,
    queue,
  };
}
