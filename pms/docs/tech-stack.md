# Helio PMS — Technology Stack

What this system is built on, and why. Every figure below was read from the
running system on 2 August 2026, not from memory.

---

## 1. At a glance

| Layer | Choice | Version |
|---|---|---|
| Runtime | Node.js | 24.12.0 (requires ≥ 22.6) |
| Language | TypeScript | 5.8, `strict` on both sides |
| Backend | Node stdlib HTTP — no framework | — |
| Database | SQLite via `node:sqlite` | built into Node |
| Frontend | React | 19.0 |
| Build | Vite | 6.4 |
| Styling | Tailwind CSS | 4.1 |
| Server state | TanStack Query | 5.100 |
| Client state | Zustand | 5.0 |
| Charts | Recharts | 2.15 |
| Icons | lucide-react | 0.546 |
| Animation | motion | 12.23 |
| i18n | i18next + react-i18next | 23.16 / 15.7 |
| PWA | vite-plugin-pwa (Workbox) | 1.2 |
| 2FA QR rendering | qrcode | 1.5 |

**Backend runtime dependencies: zero.** The API's `package.json` has no
`dependencies` block at all.

---

## 2. Shape of the system

```
┌────────────────────┐        HTTPS / JSON          ┌──────────────────────┐
│  React 19 SPA      │ ───────────────────────────▶ │  Node HTTP API       │
│  Vite · Tailwind   │ ◀─────────────────────────── │  ~135 endpoints      │
│  TanStack Query    │   Bearer token + property id │  RBAC on every route │
└────────────────────┘                              └──────────┬───────────┘
                                                               │
                                        ┌──────────────────────┴───────────┐
                                        │  SQLite (node:sqlite, WAL)       │
                                        │  55 tables · 26 indexes          │
                                        │  one file = the whole property   │
                                        └──────────────────────┬───────────┘
                                                               │ HTTPS
                                                    ┌──────────┴───────────┐
                                                    │  Beds24 API v2       │
                                                    │  → 80+ OTA channels  │
                                                    └──────────────────────┘
```

Two deployables and one file. There is no message broker, no cache server, no
ORM and no container requirement.

---

## 3. Backend — `apps/pms-api`

**9,540 lines across 27 TypeScript files**, plus a 966-line SQL schema and
1,877 lines of verification scripts.

### Runtime

Node 22.6+ for two built-ins that removed whole dependency categories:

- **`node:sqlite`** — a database with no server to install, no driver to
  compile and no native build step. The entire property is one file you can
  copy.
- **Native TypeScript type-stripping** — `.ts` files run directly. No build
  step, no `tsx`, no `ts-node`, no `dist/` to keep in sync. Code that runs is
  code you can read.

Because type-stripping erases types rather than transforming them, the backend
avoids `enum`, `namespace` and constructor parameter properties. `tsconfig.json`
sets `erasableSyntaxOnly` so the compiler enforces that rather than leaving it
to discipline.

### No framework

Routing is ~90 lines in `src/lib/http.ts`: a pattern matcher over path
segments, JSON body reading with a 4 MB cap, and a per-route `perm` string. A
framework would have added a dependency tree to save less code than it costs to
audit.

### Layering

```
routes/     HTTP shape only — parse, coerce, authorise, delegate
services/   the business rules; no knowledge of HTTP
lib/        ids, dates, money, errors, coercion
db.ts       prepared-statement cache, transactions, migrations
auth.ts     passwords, sessions, roles
mfa.ts      TOTP, recovery codes, resets, sign-in log
channels/   Beds24 API v2 connector
```

Services are callable without a request object, which is why the seed script can
drive a fortnight of trading through the same code the UI uses.

### Data conventions

| Concern | Rule |
|---|---|
| Money | Integer **minor units** (cents). Never a float, anywhere. |
| Percentages | **Basis points** (1% = 100 bp). Never a float. |
| Business dates | `YYYY-MM-DD` strings, UTC arithmetic — a date never shifts with the server's timezone |
| Timestamps | ISO-8601 UTC |
| Booleans | `0`/`1`, normalised at the binding layer |
| Tenancy | `property_id` on every operational row |

Money as integers is the single most consequential choice here. A folio balance
is `SUM(amount_minor)` over non-voided lines — reconstructed from the ledger,
never stored as a mutable total that could drift.

### Transactions

`tx()` wraps a unit of work; nested calls use savepoints. Any throw rolls the
whole thing back. The night audit is one transaction: no-shows processed, room
charges and taxes posted, statistics frozen, housekeeping rolled, group blocks
released, business date advanced. A failure at step five leaves the property
exactly where it started.

### Migrations

`schema.sql` is `CREATE TABLE IF NOT EXISTS` throughout, which cannot evolve a
table that already exists. `ensureColumn()` reads `PRAGMA table_info` and issues
`ALTER TABLE ADD COLUMN` only when a column is missing. Schema v2 (two-factor
auth) was applied to a live database holding 54 reservations and 550 folio
lines without a rebuild.

---

## 4. Frontend — `apps/pms-frontend`

**16,799 lines across 41 files · 27 screens.**

### React 19 + Vite 6

Vite for near-instant HMR in development and a Rollup production build.
Output: 1.36 MB JS (365 kB gzipped), 46 kB CSS (8 kB gzipped).

### State: two stores, deliberately separated

- **TanStack Query** owns everything the server knows. Each mutation declares
  which query-key prefixes it invalidates, so a check-in refreshes the arrivals
  list, the room board, availability and the dashboard without any manual
  plumbing. Retries are suppressed on 4xx — a rejection the user must act on is
  not a transient failure.
- **Zustand** owns only what the server does not know: sidebar collapsed,
  language, and the session/auth phase.

Nothing lives in both. That boundary is why no screen holds a stale copy of
server data.

### Styling

Tailwind CSS 4 through its Vite plugin, with a small set of component classes
(`.panel`, `.glass-pill`) in `index.css`. One caveat worth knowing: a component
class that sets `background` beats a `bg-*` utility placed alongside it — which
is why dark panels use an explicit `.panel-dark` rather than `panel bg-black`.

### Money at the boundary

The API speaks integer minor units; `format.ts` is the only place that converts
for display, via `Intl.NumberFormat` with the property's currency. `MoneyInput`
edits decimals and reports minor units. A browser test asserts no raw minor-unit
figure ever reaches the screen.

### Offline

`vite-plugin-pwa` (Workbox) precaches the shell and offers an update prompt. The
app is installable. It does **not** queue writes offline: a reservation, a
posting or a check-in must be validated against live inventory and the ledger,
so the app says it is offline rather than accepting work it cannot honour.

---

## 5. Authentication

| Concern | Implementation |
|---|---|
| Passwords | scrypt (`node:crypto`), per-user 16-byte salt, 64-byte key |
| Sessions | Opaque random token; only its SHA-256 hash is stored |
| Session life | 12 hours, or 14 days with "keep me signed in" |
| Two-factor | TOTP — RFC 6238, HMAC-SHA1, 6 digits, 30s, ±1 window |
| Recovery codes | 10 single-use, stored as SHA-256 hashes |
| Reset links | Single-use, 1-hour expiry, hash-stored |
| Lockout | 8 failures → 15 minutes |
| Comparison | `timingSafeEqual` on codes and password hashes |

TOTP is ~90 lines on `node:crypto` — base32, HMAC-SHA1, dynamic truncation.
It works with Google Authenticator, 1Password, Authy and Microsoft
Authenticator. The QR is rendered **in the browser** from the `otpauth://` URI,
so the shared secret is never sent anywhere to be turned into an image.

Roles: `admin · manager · front_office · reservations · housekeeping ·
accounts · revenue · readonly`. Permissions are enforced server-side on every
route. The UI hides what a role cannot do, but the server is the authority —
`auth-check.ts` proves a housekeeper cannot change rates even by calling the
API directly.

---

## 6. Integration — Beds24

Distribution runs through Beds24 API v2 (`src/channels/beds24.ts`):
invite-code exchange for a refresh token, automatic access-token renewal,
calendar read/write, booking import.

Two details that matter in production:

- **Rate-limit awareness.** Beds24 publishes a five-minute credit budget and
  returns the remaining allowance on every response. The push queue reads those
  headers and pauses when the budget runs low rather than getting throttled.
- **Range compression.** Consecutive dates with identical values collapse into
  one range, so a flat month is one API call, not thirty.

With no credentials stored a channel sits at `not-configured` and refuses to
push. It never reports a sync that did not happen.

---

## 7. Verification

Four suites, all against a running server, all in the same TypeScript:

| Suite | Checks | What it proves |
|---|---|---|
| `smoke.ts` | 83 | A complete business day: configure, quote, book, gate on availability and restrictions, check in, post, void, night audit, check out, invoice, report |
| `screens.ts` | 64 | Every endpoint the UI depends on returns usable data; folio totals reconcile with both their own lines and their stored balance |
| `auth-check.ts` | 52 | Wrong passwords, lockout, 2FA enrolment and challenge, recovery-code replay, password rules, reset links, session revocation |
| `ui-check.ts` | 23 | The built app in headless Chrome via the DevTools Protocol — every screen renders inside the authenticated shell, no console errors |

`ui-check.ts` drives Chrome over CDP using Node's built-in `WebSocket`, so
browser testing needs no Playwright or Puppeteer install.

These suites are not decoration. They found and forced fixes for: a void that
double-counted, dorm beds treated as private rooms, a shared dorm marked vacant
while still occupied, a rate-limit guard reading a client that had never made a
request, a CORS allowlist missing Vite's preview port, and failed sign-ins
logged without a user id.

---

## 8. What was deliberately not used

| Not used | Why |
|---|---|
| Express / Fastify / Nest | ~90 lines of routing does the job; fewer dependencies to audit |
| Prisma / Drizzle / TypeORM | The queries are the interesting part — availability, pricing and the audit are hand-written SQL that an ORM would obscure |
| Postgres / MySQL | A single property fits comfortably in SQLite. One file to back up, nothing to operate |
| Redis | No cache to invalidate; SQLite reads are microseconds away |
| Docker (required) | `npm start` is the whole deployment. It containerises fine if you want |
| Auth0 / Clerk / Firebase | Sessions and TOTP are ~250 lines of `node:crypto`, and the hotel's staff list stays in the hotel's database |
| Redux | Query owns server state; Zustand covers the small remainder |
| A component library | The design language predates this work; matching it mattered more than adopting someone else's |

Dependency count is not a virtue in itself. Each of these was declined because
the thing it replaces is small, well-understood and central enough to be worth
owning.

---

## 9. Operations

**Run**
```bash
cd apps/pms-api      && npm start     # :5000
cd apps/pms-frontend && npm run dev   # :3000
```

**Configuration**

| Variable | Where | Default |
|---|---|---|
| `HELIO_DB` | api | `apps/pms-api/data/helio.db` |
| `PORT` | api | `5000` |
| `CORS_ORIGIN` | api | localhost 3000 / 4173 / 5173 |
| `BEDS24_API` | api | `https://api.beds24.com/v2` |
| `HELIO_BACKUP_ENABLED` | api | `true` |
| `HELIO_BACKUP_INTERVAL_HOURS` | api | `6` |
| `HELIO_BACKUP_DIR` | api | `apps/pms-api/backups` |
| `VITE_API_URL` | frontend build | `https://api.funbunkpms.grobern.com` |

**Backups.** `services/backup.ts` snapshots the database with `VACUUM INTO`
every six hours and after every night audit, verifies each snapshot by
reopening it (`integrity_check`, `foreign_key_check`, row counts), prunes on a
4/7/4/6 schedule, and surfaces status in Administration → Backups. Restore is
CLI-only (`npm run restore`) because the file has to be swapped with the API
stopped. `npm run verify:backup` exercises all of it — snapshot, tamper
detection, retention, restore round-trip — against a throwaway database.
Current demo database: 1.5 MB.

**Scaling.** SQLite in WAL mode handles a single property's concurrency
comfortably — the write path is one process and reads do not block it. A
portfolio large enough to need Postgres would change `db.ts` and the SQL
dialect; the service layer above it is unaffected because no ORM assumptions
are baked in.

---

## 10. Known limits

Stated plainly, because a stack document that only lists strengths is not useful:

- **Beds24 is unverified against a live account.** The connector makes real API
  v2 calls with real endpoints and error handling, but it has not been exercised
  against a funded Beds24 account. Everything else here has been tested.
- **No email or SMS provider.** Password resets are handed over by an
  administrator and guest messages stay as drafts. The app says so rather than
  claiming to have sent something.
- **No payment gateway.** Payments are recorded on the folio; nothing is
  captured from a card. Tokenised capture would be an adapter alongside the
  channel connector.
- **The JS bundle is 1.36 MB** (365 kB gzipped) in one chunk. Route-level code
  splitting would cut first load materially and has not been done.
- **`packages/channel-engine`** is the earlier standalone prototype. Its logic
  now lives in `src/services/channels.ts` and nothing imports it. It is dead
  weight you can delete.
