# Which database should Helio PMS use?

Short answer: **keep SQLite.** Not as a placeholder — as the right choice for a
property this system is built to run. This document explains why, what would
change that, and exactly what to do if it does.

Everything below was measured on the running system, not assumed.

---

## 1. The measurement that settles it

The classic way a booking system corrupts itself is *check-then-act*: two
requests both read "1 room left", both pass the availability gate, both insert,
and the hotel is overbooked. Most PMS bugs of this kind are invisible until a
guest arrives to no room.

`scripts/concurrency.ts` fires that race deliberately — 12 simultaneous
requests for a single remaining room:

```
Racing the last Single Room
  4 available on 2026-11-29 · filling to leave exactly one
  12 simultaneous requests → 1 booked, 11 refused, 0 other

  ✓ exactly one request wins the last unit
  ✓ every loser is told the room is unavailable, not an error
  ✓ availability lands on exactly zero — never negative
  ✓ rooms sold never exceeds physical inventory
  ✓ 20 simultaneous payments all land
  ✓ the balance still equals the sum of its lines
```

**Eleven of twelve requests were correctly refused.** Twenty concurrent payments
all landed and the folio still reconciled to the cent.

That is not luck. It falls out of two properties of the current stack:

1. **`BEGIN IMMEDIATE`** (`db.ts`) takes the write lock at the *start* of the
   transaction, not at first write. The availability check and the insert are
   inside the same lock.
2. **`node:sqlite` is synchronous, on one connection.** Requests cannot
   interleave mid-transaction.

Together these give **serialisable** booking behaviour for free. No advisory
locks, no `SELECT … FOR UPDATE`, no optimistic-retry loop, no version columns.

This matters enormously for the migration question below, and it is the single
most under-appreciated argument for staying put.

---

## 2. Where SQLite genuinely sits

| Dimension | Reality for this system |
|---|---|
| Data size | 1.5 MB for a fortnight of a live property. A 500-room hotel with 5 years of history lands in the low hundreds of MB — SQLite is comfortable into the hundreds of GB |
| Read concurrency | Unlimited in WAL mode; readers never block the writer |
| Write concurrency | One writer at a time. A PMS writes on booking, check-in, posting and audit — bursty, small, and measured in tens per minute, not thousands per second |
| Durability | `synchronous = FULL` + WAL: a committed transaction has reached the disk |
| Operations | One file. `cp` is a backup. No server, no user accounts, no port, no failover |
| Failure modes | Far fewer than a networked database — no connection pool exhaustion, no split brain, no "could not connect" at 3am |

The honest limitation is **one writer**. The night audit is a single long
transaction, and while it runs, other writes wait. For a hostel this size that is
milliseconds. For a 500-room hotel posting 400 room charges and their taxes, it
is perhaps a second or two, once a day, at the quietest hour of the night. That
is an acceptable trade, and it is the *reason* the audit is atomic.

---

## 3. What I changed while investigating

One real gap, now fixed in `db.ts`:

```
busy_timeout  0 → 5000ms
```

At `0`, any second connection — a backup, a verification script, a stray process
— fails **instantly** with `SQLITE_BUSY` rather than waiting out a momentary
overlap. Five seconds turns a spurious error into a brief pause.

`synchronous = FULL` and `foreign_keys = ON` are now also set explicitly on the
connection rather than relying on `schema.sql`, which only runs its PRAGMAs at
migration time. PRAGMAs are per-connection, so setting them where the connection
is opened is the only place that reliably applies.

---

## 4. When to move — concrete triggers, not vibes

Migrate when **any** of these becomes true. Not before.

| Trigger | Why SQLite stops fitting |
|---|---|
| **More than one API process** | Horizontal scaling, or a separate worker for channel sync. Multiple processes on one file is where SQLite's single-writer model starts to bite |
| **Multi-property SaaS** | Many hotels on shared infrastructure, writing concurrently. One file per tenant is workable; one file for all tenants is not |
| **Managed backup / PITR / replicas required** | By policy or contract. SQLite can do this (Litestream, backup API) but a managed Postgres does it as a checkbox |
| **The database is not on the app server's disk** | SQLite over a network filesystem is a documented way to corrupt data. Do not do it |
| **Heavy analytical load beside operations** | Long reporting scans competing with the front desk. A read replica solves this; SQLite has no replicas |

Notably **not** on that list: number of rooms, number of reservations, or years
of history. Those are not what SQLite runs out of.

---

## 5. If you migrate: PostgreSQL

Not MySQL, and definitely not a document store. The reasons are specific to this
schema.

### 5.1 The feature that would genuinely improve correctness

Postgres can enforce "no two live reservations occupy the same room on
overlapping dates" **in the database**, not in application code:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE reservation_nights
  ADD CONSTRAINT no_double_booking
  EXCLUDE USING gist (
    room_id WITH =,
    daterange(date, date + 1, '[)') WITH &&
  )
  WHERE (room_id IS NOT NULL);
```

Today that guarantee lives in `isRoomFree()` — correct, tested, but enforced by
code that a future contributor could bypass. As a constraint it becomes
impossible to violate through any path, including a manual `INSERT`. For a
booking system that is the strongest single argument for Postgres.

Note it must be scoped to exclude dorms, which share a room by design — the same
distinction the application already makes.

### 5.2 What you must not lose

**This is the trap.** Postgres with a connection pool runs at `READ COMMITTED`
by default, where the check-then-act race in §1 *is* possible. Porting the code
as-is would silently reintroduce overbooking under load — the exact bug the
current stack prevents by accident.

A migration must do one of:

- add the exclusion constraint above (best — declarative and total), **or**
- `SELECT … FOR UPDATE` on the room-type inventory row inside the transaction, **or**
- run booking transactions at `SERIALIZABLE` with a retry loop.

`scripts/concurrency.ts` should be run against the migrated system before it
carries traffic. It is written against the HTTP API, so it ports unchanged.

### 5.3 What to keep exactly as it is

- **Integer minor units for money.** Do not switch to `numeric` or `money`
  because Postgres offers them. The invariant "money is an integer" is worth
  more than the convenience, and it is already proven correct.
- **Basis points for percentages.** Same reasoning.
- **`YYYY-MM-DD` strings for business dates.** They are deliberately not
  timestamps. A business date has no timezone.

### 5.4 Effort

The migration surface is small by design:

- `db.ts` — connection, prepared statements, `tx()` (~150 lines)
- SQL dialect — `INSERT … ON CONFLICT` is already Postgres-compatible;
  `PRAGMA` and `AUTOINCREMENT` are the differences
- `ensureColumn()` — becomes standard `ALTER TABLE … IF NOT EXISTS`

The 27 service and route files above `db.ts` do not change, because no ORM
assumptions leaked into them. That was the point of keeping raw SQL in one
layer.

---

## 6. What I would not choose, and why

| Option | Verdict |
|---|---|
| **MySQL / MariaDB** | Workable, but no exclusion constraints — the one thing that would most improve this schema. Weaker `CHECK` history, no transactional DDL |
| **MongoDB / DynamoDB** | Wrong shape. A folio is a ledger, a reservation owns per-night rows, taxes reference their parent charge. This data is relational to its core, and it is money. Cross-document transactions to fake what SQL gives natively is a bad trade |
| **Turso / libSQL** | Genuinely interesting — SQLite with replication and edge reads. Worth revisiting if multi-property arrives before the need for full Postgres |
| **Cloudflare D1** | Same family, but no long transactions — the night audit's whole-day atomicity would have to be redesigned. That is too high a price |
| **Supabase / Firebase** | Bundles auth and realtime you already own in ~250 lines of `node:crypto`. Postgres directly, if Postgres |
| **DuckDB** | Analytical, not transactional. If reporting ever outgrows the operational store, DuckDB *beside* it is a good answer — not instead of it |

---

## 7. Do these now, whatever you decide

1. **Copy the backups off the machine.** ✅ The schedule itself is now built in:
   `VACUUM INTO` every six hours and after every night audit, each snapshot
   verified with `integrity_check` before it is trusted, retention of
   4/7/4/6, and a guarded `npm run restore`. What that does *not* survive is the
   disk failing. Sync `apps/pms-api/backups` to off-machine storage, or run
   [Litestream](https://litestream.io) on top for continuous replication with
   point-in-time recovery.
2. **Keep the database on local disk.** Never a network share, never Dropbox,
   never a mapped drive.
3. **Run `npm run concurrency` after any change to `tx()`, `createReservation`
   or `db.ts`.** It is the regression test for the guarantee in §1.
4. **Revisit this document when a trigger in §4 fires** — not on a schedule, and
   not because a database sounds more serious than a file.

---

## Verdict

For one property on one server, SQLite is not a compromise — it is measurably
safer than the obvious alternative, because the single-writer model makes
overbooking structurally impossible rather than something you have to remember
to prevent.

Move to PostgreSQL when a trigger in §4 fires, take the exclusion constraint
with you, and re-run the concurrency suite before it carries a single booking.
