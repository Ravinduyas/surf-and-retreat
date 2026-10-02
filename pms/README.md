# The Fun Bunk — PMS

A hostel **Property Management System** you can actually run the property on:
reservations, front desk, housekeeping, cashiering, the night audit, CRM,
reporting — and a **guest booking page the system builds for you** from the
rooms you set up.

> **This installation runs entirely on this machine.** There is no cloud
> database, no deployed API and no channel-manager account. The API on `:5000`,
> the staff app on `:3000` and one file at `backend/data/helio.db` are the whole
> system.

```
funbunk-pms/
├── backend/                  Node + SQLite — the system of record
│   ├── src/schema.sql        full operational schema
│   ├── src/auth.ts           passwords, sessions, roles
│   ├── src/mfa.ts            TOTP, recovery codes, resets, sign-in log
│   ├── src/services/         availability · pricing · restrictions · folio ·
│   │                         night audit · housekeeping · reports · channels ·
│   │                         bookingpage · publicbooking
│   ├── src/routes/           ~140 REST endpoints, plus /book
│   ├── src/channels/         Beds24 API v2 connector (present, switched off)
│   └── scripts/              setup-funbunk · demo · smoke · screens · verify
├── frontend/                 React 19 + Vite staff UI (23 screens)
├── packages/
│   └── channel-engine/       earlier standalone prototype — superseded by
│                             backend/src/services/channels.ts, not wired in
└── docs/
    ├── tech-stack.md         what it is built on, and why
    ├── database-choice.md    why SQLite, and when to move to Postgres
    └── *.html                original gap-analysis blueprints
```

## The property

**The Fun Bunk** — one property, owner **Thilina**, prices in **USD**.

| Room | Type | Sleeps | Rate | High season (from 1 Oct) |
|---|---|---|---|---|
| 101 | Deluxe Double Bed Private Ensuite | 2 | $30.00 | $35.00 |
| 102 | Standard Double Bed Private Shared Bathroom | 2 | $25.00 | — ($30.00 Fri & Sat) |
| 201 | Deluxe 4 Bed Mixed Dorm Ensuite | 4 beds | $9.00 | $15.00 |
| 202 | Deluxe 6 Bed Mixed Dorm Ensuite | 6 beds | $8.30 | $14.00 |
| 203 | Deluxe 6 Bed Female Dorm Ensuite | 6 beds | $8.30 | $16.00 |
| 301, 302 | Standard 8 Bed Mixed Dorm Ensuite | 16 beds | $8.00 | $14.00 |

7 rooms · 32 dorm beds · sleeps 36. Stays of 1–30 nights. Dorms are sold **per
bed**, private rooms as a whole room.

## Run it

Requires **Node 22.6+** (the API uses the built-in `node:sqlite`). No database
server to install — the data lives in a single SQLite file.

**1. Start the API**

```bash
cd backend
npm start                 # https://api.funbunkpms.grobern.com
```

**2. Start the staff app**

```bash
cd frontend
npm install
npm run dev               # http://localhost:3000
```

```
Sign in   thilina@funbunk.com  /  FunBunk2026
```

Change that password from the account menu once you are in.

**3. The booking page is already live**

```
https://api.funbunkpms.grobern.com/book
```

Nothing to build, deploy or brand. The page reads the property, its rooms, its
rates, its stay limits and its availability from this PMS as the guest loads it
— so a rate changed in **Rates & Inventory** is quoted on the very next booking.
Find the link, a QR code for it, and its on/off switch under **Booking Page** in
the sidebar.

Bookings arrive in **Reservations** marked *awaiting confirmation*. They hold no
bed and take no inventory until somebody accepts one and picks the room — a form
a guest filled in is not the property agreeing to house them.

## Starting over

```bash
cd backend
npm run setup -- --yes
```

Erases the database and rebuilds it: the property, Thilina’s account, the room
types and rooms above, a year of nightly rates and the booking page’s settings.
No demo bookings — the property starts empty and real. Without `--yes` it tells
you what it would destroy and stops.

Set `FUNBUNK_ADMIN_EMAIL` / `FUNBUNK_ADMIN_PASSWORD` first if you want different
sign-in details.

## Connecting OTAs later

The Beds24 connector is still in the code and switched off. To turn it back on,
in `backend/.env`:

```bash
BEDS24_REFRESH_TOKEN=…            # from your Beds24 account
HELIO_CHANNEL_READONLY=false      # allow rates and availability to be pushed
HELIO_CHANNEL_DRAIN_SECONDS=60    # resume the rate/availability push
HELIO_BOOKING_POLL_SECONDS=60     # resume importing OTA bookings
HELIO_MESSAGE_POLL_SECONDS=300    # resume pulling guest messages
```

Then `npm run beds24:golive` — see **Going live on Beds24** below. Until then the
three loops that reach the network do not run at all.

## How it works

**The business date is sacred.** Only the night audit moves it. It runs as a
single database transaction: no-shows processed, room charges and taxes posted,
statistics frozen, housekeeping rolled, expired group blocks released, date
advanced. If any step fails, nothing is committed.

**Money is never a float.** Every amount is an integer of minor units (cents)
end to end; percentages are basis points. A folio's balance is always the sum of
its non-voided lines — it is reconstructed from the ledger, never stored as a
mutable total.

**Availability is computed, not cached.** For each room type and date:
physical units − out-of-order − sold − unpicked group blocks − manual holds +
overbooking allowance. Dorm types count beds rather than rooms.

**Rates resolve in a chain.** Rate-calendar cell → derived from the parent plan
± its offset → the plan's base rate → the room type's default. Then occupancy
supplements, length-of-stay pricing, yield rules, promotions, and finally the
channel's price multiplier.

**Nothing pretends to have happened.** A channel with no credentials reports
`not-configured` and refuses to push rather than showing a green tick. Failed
syncs are recorded with the real error. Guest messages stay drafts until a
provider is configured.

## Verification

Three suites, all runnable against a live server:

```bash
cd backend
npm run verify      # all 28 suites, each against its own clean database
npm run smoke        # 83 business-rule checks (needs an empty database)
npm run screens      # 64 screen-data checks
npm run auth-check   # 52 sign-in and security checks
npm run concurrency  # 11 overbooking / lost-update checks
npm run ui-check         # 23 real-browser checks of the staff app
npm run bookingpage-ui   # 26 real-browser checks of the guest booking page
npm run api-contract     # every path the app calls exists on the server
```

`smoke.ts` drives a complete business day through the real API — configure a
property, quote and book, hit the availability and restriction gates, check in,
post charges and payments, void a posting, run the night audit, check out,
invoice, and read the reports back. It asserts things like *"a void reverses the
money exactly once"*, *"the closed day was not posted twice"* and *"housekeeping
cannot change rates"*.

`screens.ts` confirms every endpoint the UI depends on returns usable data, and
that folio totals reconcile with both their own lines and their stored balance.

`auth-check.ts` creates a throwaway account and puts the whole sign-in system
through its paces: wrong passwords, lockout and unlock, 2FA enrolment and
challenge, recovery codes (including that a used one cannot be replayed),
password change rules, reset links, and session revocation. It is safe to run
against a property with real data in it.

`concurrency.ts` fires twelve simultaneous bookings at the last remaining room
and asserts exactly one wins, then twenty simultaneous payments at one folio and
asserts the balance still reconciles. It cleans up after itself. Run it after
any change to `tx()`, `createReservation` or `db.ts` — see
[docs/database-choice.md](docs/database-choice.md) for why that guarantee holds.

`ui-check.ts` drives the built app in headless Chrome via the DevTools Protocol:
each of the 22 screens must render inside the authenticated shell with no
uncaught console errors, and a signed-out browser must be held at sign-in.

Both codebases typecheck under `strict`.

## Signing in

**Password** — scrypt with a per-user salt. Minimum eight characters with
letters and numbers, checked in the browser against the same rules the server
enforces. A new password cannot repeat the old one, and changing it signs out
every other device.

**Two-factor authentication** — TOTP (RFC 6238) against any authenticator app:
Google Authenticator, 1Password, Authy, Microsoft Authenticator. Enrol from
Administration → Security by scanning the QR or typing the key. Nothing is
switched on until a code from the app is accepted, so you cannot lock yourself
out mid-setup. Enabling it issues ten single-use recovery codes, shown once.

**Sign-in flow** — password → second factor if enabled → property. A challenge
token stands in for the session between those steps and cannot be used to reach
anything; it expires in ten minutes.

**Lockout** — eight failed attempts locks an account for fifteen minutes. The
last three attempts warn how many are left; the lock says how long it lasts. An
administrator can unlock from Administration → Users.

**Sessions** — 12 hours, or 14 days with "keep me signed in". Only a SHA-256
hash of each token is stored, so the sessions table cannot be replayed. Sign out
of one device, or all the others at once.

**Password recovery** — no mail provider is configured, and the app does not
pretend otherwise. A request from the sign-in screen appears in Administration →
Security, where an administrator issues a one-hour, single-use link to hand over
in person. Using it signs out every session on that account. The request form
answers identically for unknown addresses, so it cannot be used to enumerate
accounts.

**Temporary passwords** — a password set by an administrator must be replaced
before anything else in the app is reachable.

**Security log** — every attempt is recorded with its outcome (`success`,
`bad-password`, `locked`, `mfa-failed`, `mfa-recovery`, `disabled`), IP and
user agent. Failures are attached to the targeted account, so its owner can see
someone trying to get in. Users see their own; administrators can see everyone's.

## Roles

`admin · manager · front_office · reservations · housekeeping · accounts ·
revenue · readonly`

Permissions are enforced server-side on every route; the UI hides or disables
what a role cannot do, but the server is the authority. Rate overrides, forced
availability, voids, folio reopens, night-audit overrides and every security
change are flagged as elevated in the audit trail.

## Configuration

| Variable | Where | Default |
|---|---|---|
| `HELIO_DB` | api | `backend/data/helio.db` |
| `PORT` | api | `5000` |
| `CORS_ORIGIN` | api | localhost 3000 / 4173 / 5173 / 5000 |
| `BEDS24_API` | api | `https://api.beds24.com/v2` |
| `HELIO_BACKUP_ENABLED` | api | `true` |
| `HELIO_BACKUP_INTERVAL_HOURS` | api | `6` |
| `HELIO_BACKUP_DIR` | api | `backend/backups` |
| `HELIO_CHANNEL_DRAIN_SECONDS` | api | `60` (`0` disables the automatic push — **0 here**) |
| `HELIO_MESSAGE_POLL_SECONDS` | api | `300` (`0` disables the guest message poll — **0 here**) |
| `HELIO_BOOKING_POLL_SECONDS` | api | `60` (`0` stops importing OTA bookings — **0 here**) |
| `HELIO_BOOKING_SITE_URL` | api | `https://api.funbunkpms.grobern.com` — the address the booking link and check-in QR codes point at |
| `VITE_API_URL` | frontend build | `https://api.funbunkpms.grobern.com` |

## Security and the audit

An independent technical audit (9 Aug 2026) found 2 Critical and 8 High issues.
**Wave 1 is fixed and verified** — tenant isolation, both tax-billing defects, the
silent channel-push failure, privilege escalation, and Airbnb messaging. See
[docs/audit-response.md](docs/audit-response.md) for what was confirmed, what
changed, and what is deliberately still open.

**Still open and Critical: channel credentials (C2).** Seven of eight roles can read
the Beds24 refresh token from , and it is stored in clear text.
Do not connect a live Beds24 account to a multi-user installation until that is fixed.
**Not a risk here:** no channel credentials are stored and the connector is switched off.

## Going live on Beds24

Helio exchanges a **refresh token** for a short-lived access token, caches it until
a minute before it expires, and re-persists it whenever Beds24 rotates it. You only
ever supply the refresh token.

```bash
cd backend
cp .env.example .env          # set HELIO_SECRET_KEY and BEDS24_REFRESH_TOKEN

npm run beds24:golive                            # connect, discover rooms, map by name
npm run beds24:golive -- --create-room-types     # …and build your inventory from Beds24
npm run beds24:golive -- --import                # …and pull the real bookings
npm run beds24:golive -- --import --push         # …and send rates/availability out
```

Six steps, each proved before the next is attempted: token exchange → confirm the
property → list Beds24 rooms → map them to your room types → import bookings → push
rates. **Rooms are mapped by exact name only.** Anything ambiguous is listed for you
to map by hand, because a fuzzy guess that puts one room type's prices on another
room's calendar is harder to notice than no mapping at all.

`--create-room-types` builds the room types, rooms, beds, a rate plan and a priced
calendar from what Beds24 actually holds. Two translations matter and are handled:

- **A dorm bed is sold as a one-person room.** "Bed in 8-Bed Mixed Dormitory Room"
  arrives as `maxPeople: 1, qty: 16` — sixteen *beds*, not sixteen rooms. The dorm
  is identified from Beds24's own `roomType: bedInDormitory`, never from occupancy,
  and 16 beds at 8 per room becomes 2 rooms of 8.
- **Prices come from the calendar, per night.** Beds24 returns date *ranges*, which
  are expanded so the calendar carries the real per-night price rather than one
  number smeared across the year. The room type's default rate is the night-weighted
  median, and the range found is printed so you can see what was chosen.

Room types the script created are marked as such, and only those have their rate
refreshed on a later run — a rate a person has set is left alone.

### The safety catch: `HELIO_CHANNEL_READONLY`

From the moment a channel is live, **taking one booking queues an availability push
and the background drain sends it to your OTAs within seconds.** That is right in
production and wrong while you are still checking that the imported inventory and
prices look correct — the first mistake is published before anyone has seen it.

```bash
HELIO_CHANNEL_READONLY=1      # imports still run; nothing is ever sent out
```

Queued work is kept, not discarded, so when you unset it the property's real state
goes out on the next drain. The startup banner says `channels: READ-ONLY` while it
is on, because the wrong moment to discover this setting is a week later, wondering
why the OTAs never got a rate change.

With `BEDS24_REFRESH_TOKEN` set, the channel also connects on startup — no UI step.
It is idempotent: on later boots it finds the channel already connected and does
nothing, rather than burning API credits re-authenticating.

**A channel is never marked connected because a token was stored** — only after a
call to Beds24 succeeds.

### Replacing the demo data

Two tools, and the difference matters once a channel is connected.

```bash
npm run clear-demo                      # deletes a whole property
npm run clear-demo-inventory            # empties one, keeps the shell
npm run clear-demo-inventory -- --yes
```

`clear-demo` deletes the property outright — right for a throwaway installation.
**Once Beds24 is connected it is the wrong tool**, because the property row owns the
channel and its encrypted refresh token, and dropping it means re-authorising the OTA
connection just to remove some sample bookings.

`clear-demo-inventory` clears the contents and keeps the shell:

| kept | cleared |
| --- | --- |
| the property, its currency, times and tax rules | room types, rooms, beds |
| every user account and role assignment | bookings, guest profiles, folios, invoices |
| connected channels **and their credentials** | rates, housekeeping, and everything derived |
| policies, transaction codes, number sequences | channel rows that were never configured |
| the audit log | |

**The clearable set is derived from the schema, not listed by hand** — any table
carrying a `property_id` is content unless it is on the keep list, and the delete
order is computed from the foreign keys. A hand-written list silently misses whatever
table was added last, which is how "cleared" databases keep their old room types.

Both take a verified backup first and **refuse** a property showing signs of real use
— a booking carrying an OTA reference, a recorded payment, anything booked in the last
24 hours — unless you add `--force`. User accounts are never touched, so you cannot
lock yourself out.

The usual sequence for a fresh property behind a live channel:

```bash
npm run clear-demo-inventory -- --yes
npm run beds24:golive -- --create-room-types --import
```

## Backups

The whole system is one SQLite file, and it backs itself up.

A snapshot is taken every six hours, on startup if the last one is stale, and
after every night audit. Each snapshot is written with `VACUUM INTO` — a
compacted copy taken while the API keeps serving — then immediately reopened
and checked with `integrity_check`, `foreign_key_check` and a row count of the
core tables. A snapshot that fails any of those is recorded as failed rather
than silently kept, because an unverified backup is not a backup.

Retention keeps the newest 4, then one a day for 7 days, one a week for 4
weeks, and one a month for 6 months. Older files are pruned; a snapshot still
being written is never pruned.

**Administration → Backups** shows the last verified snapshot, its age, the
space used and the full history, and warns loudly when the newest good backup
is older than 24 hours or the schedule has been switched off. Snapshots can be
taken, re-verified and deleted from there.

```bash
npm run verify            # the whole suite: 240 checks on throwaway databases
npm run backup            # take one now
npm run verify:backup     # 30 checks against a throwaway database
npm run restore           # list what is available
npm run restore -- <file> # dry run: what would change
```

Restoring is command-line only, on purpose — the file has to be swapped with
the API stopped, and the script refuses to run if anything is still answering
on `PORT`. It verifies the backup before touching anything, warns if the
backup holds fewer reservations than the live database, and saves a
`pre-restore` copy first, so a restore made in error is itself reversible.

**Copy the backup directory off this machine.** Snapshots on the same disk do
not survive that disk failing. For continuous replication with point-in-time
recovery, [Litestream](https://litestream.io) sits on top of this without
changing anything. See [docs/database-choice.md](docs/database-choice.md) §7.
