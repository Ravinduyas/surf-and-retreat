# Development requirements — round 2

Seven areas, written before any code is changed, so progress can be measured
against something. Each item states **what exists today**, **what is missing**,
and **how we will know it is done**.

Every claim about the current system below was read from the code, not assumed.

---

## Legend

| Mark | Meaning |
|---|---|
| ✅ | Already built and verified |
| ⚠️ | Partly built — works, but has a named gap |
| ❌ | Not built |
| 🔌 | Needs a funded Beds24 account to confirm against the live channel |

---

## R1 · Make the system fully SQLite-friendly

**Today** ✅ WAL mode, `synchronous = FULL`, `foreign_keys = ON`,
`busy_timeout = 5000`, `BEGIN IMMEDIATE` transactions, a prepared-statement
cache, 26 explicit indexes, and a proven no-overbooking guarantee
(`npm run concurrency`, 11/11).

**Missing**
- ⚠️ Indexes were written by hand, never checked against the queries that
  actually run. Some hot paths may be doing table scans.
- ❌ No `PRAGMA integrity_check` / `foreign_key_check` ever runs — silent
  corruption would go unnoticed until it caused a wrong number.
- ❌ No `ANALYZE`, so the query planner works without statistics.
- ❌ No maintenance path: WAL grows, free pages are never reclaimed.
- ❌ No visibility — nobody can see database size, WAL size, or table counts
  without opening a shell.

**Done when**
1. Every query in a hot path (availability grid, tape chart, folio balance,
   reservation list, night audit) is checked with `EXPLAIN QUERY PLAN`, and any
   scan over a large table is indexed away.
2. A `/api/system/database` endpoint reports size, WAL size, page counts, table
   row counts and index usage.
3. `PRAGMA integrity_check` and `foreign_key_check` run on demand and on a
   schedule, with failures raised as notifications.
4. `ANALYZE` runs after the night audit; `VACUUM`/checkpoint available as a
   maintenance action.
5. A measured before/after on the slowest endpoint.

---

## R2 · Backup schedule

**Today** ❌ Nothing. The README says a backup is "the highest-value hour of
work available on this system" and that is still true.

**Missing** — all of it.

**Done when**
1. Automatic snapshots on a schedule (default: after every night audit, plus a
   configurable interval) using SQLite's online `.backup` API, so a backup can
   be taken **while the system is running** without blocking writes.
2. Retention policy — keep N daily, N weekly, N monthly; prune the rest.
3. Every snapshot is **verified after writing** (`integrity_check` on the copy).
   An unverified backup is not a backup.
4. Restore is a documented, tested command — not a guess in an emergency.
5. Backup status visible in Administration: last run, size, age, verification
   result, and a loud warning when the last good backup is stale.
6. A manual "Back up now" button.
7. Backups written outside the database directory, with the path configurable.

---

## R3 · No-show reporting to Booking.com (via Beds24)

**Today** ⚠️ `markNoShow()` handles the *property* side correctly: sets the
status, releases the unposted nights back to inventory, posts the no-show
charge, writes the audit entry, and queues an availability push. The night audit
does this automatically for arrivals that never checked in.

**Missing**
- ❌ The channel is never told. Booking.com still believes the guest is
  arriving, so the commission stands and the guest is not flagged.
- ❌ No record of *whether* a no-show was reported, when, or whether it failed.
- ❌ No awareness of the reporting window — Booking.com will not accept a
  no-show report indefinitely.
- ❌ No way to report a credit-card-invalid or an "at-property" cancellation,
  which are the neighbouring channel actions front desks need.

**Done when**
1. Marking an OTA booking as a no-show offers to report it to the channel.
2. The report goes through Beds24 (`POST /bookings`, status change) and the
   outcome — success or the exact error — is stored on the reservation and shown
   in the sync log.
3. A reservation carries `channel_reported_at` / `channel_report_status`, so the
   UI can show "reported", "not reported", or "failed — retry".
4. Reporting is retryable, and the window is surfaced ("report within N days").
5. Never claims success it did not get. 🔌 The exact Beds24 payload and the
   Booking.com acceptance window must be confirmed against a live account before
   this is trusted in production.

---

## R4 · OTA guest messaging inside Helio

This is the largest item, and the one you described most precisely: *read and
reply to Booking.com guest messages inside Helio, without logging in to the
Booking.com extranet* — and the same for other OTAs.

**Today** ⚠️ There is a `messages` table, a thread on the guest dashboard, and
`GET/POST /api/messages`. But messages are local drafts only: nothing is ever
fetched from or sent to a channel. The connector has `getBookingMessages()`
written and **never called**.

**Missing**
- ❌ No inbound sync — OTA messages never arrive.
- ❌ No outbound send — replies never leave Helio.
- ❌ No unified inbox screen; messages are only visible per reservation.
- ❌ No unread state, no assignment, no response-time visibility.
- ❌ No templates or canned replies for the messages a front desk sends fifty
  times a week.

**Done when**
1. A poll pulls new messages for recent and in-house bookings and files them
   against the right reservation and guest profile.
2. Replies sent from Helio go out through Beds24 to the originating channel.
3. A **unified inbox** screen: every conversation across every channel, filtered
   by unread / in-house / arriving, with the reservation context beside the
   thread.
4. Unread counts in the app shell, so a message is not missed.
5. Delivery state is honest per message — `queued`, `sent`, `delivered`,
   `failed` with the reason. A message that could not be delivered says so.
6. Templates with merge fields (guest name, room, arrival, check-in time).
7. 🔌 **Channel support varies and must be verified.** Booking.com and Airbnb
   support guest messaging through Beds24; several channels do not. The UI must
   show which channels are message-capable rather than implying all are. Until a
   live account confirms it, outbound messages must not be reported as delivered.

---

## R5 · Stay date changes (extend and shorten)

**Today** ⚠️ `updateReservation()` accepts a new `arrival`/`departure`, re-checks
availability and restrictions, re-prices unposted nights, keeps posted nights at
their original rate, preserves the room where it is still free, and pushes the
change to channels. Arrival is correctly frozen after check-in. Early departure
is handled at check-out.

**Missing**
- ❌ No dedicated "extend stay" action — the front desk has to open the full
  amend form and edit a date field, which is the most common in-house request
  and the most error-prone path.
- ❌ No preview: the user cannot see what the extra nights will cost, or that
  the room must change, *before* committing.
- ❌ If the same room is not free for the extra nights, the amend silently drops
  the room assignment instead of offering a move.
- ❌ No shorten-stay action for an in-house guest (only early departure at
  check-out).

**Done when**
1. One-click **Extend stay** on the guest dashboard and in-house list: pick new
   departure, see per-night price and new total before confirming.
2. If the current room is not free, say so plainly and offer the rooms that are.
3. **Shorten stay** with the same preview, refusing to drop nights already
   posted.
4. Both write an audit entry and queue a channel push.
5. Restriction violations (min-stay, CTD) are explained, not just refused.

---

## R6 · Room price change and price planning

**Today** ⚠️ `/api/rates/bulk` applies a fixed price, a percentage adjustment or
an amount adjustment across a date range, filtered by room type, rate plan and
day of week — and queues a channel push. Derived rate plans recalculate from
their parent automatically. Yield rules adjust prices by occupancy, lead time,
day of week and length of stay.

**Missing**
- ❌ **No preview.** A bulk edit is applied blind; there is no "this will change
  N cells, from X to Y" before committing, and no undo.
- ❌ No **seasons** — a named, reusable date range (High, Shoulder, Low) that
  rates hang off. Every change is an ad-hoc date range typed by hand.
- ❌ No **scheduled** changes — you cannot set a price to take effect next month
  and walk away.
- ❌ No **copy period** — "take last December and apply it to this December".
- ❌ No change history on a rate cell: who changed this price, when, from what.

**Done when**
1. Every bulk edit shows an exact preview — cells affected, current → new, with
   the biggest movers listed — before it is applied.
2. Named seasons, editable, with rates set per season and applied to a date span.
3. Scheduled rate changes with an effective date, visible in a queue, applied
   automatically, cancellable before they fire.
4. Copy rates from one period to another with a multiplier.
5. Rate change history per cell, queryable in the audit trail.

---

## R7 · Opening and closing rooms

**Today** ⚠️ The restrictions engine supports `stop-sell`, `cta`, `ctd`,
min/max stay, stay-through and advance windows — scoped to a room type, a rate
plan and/or a single channel. Physical rooms can be taken out of order or out of
service for a date range. Both are enforced at booking time and pushed to
channels.

**Missing**
- ❌ Closing dates takes six form fields in a modal. There is no quick "close
  these dates" from the rate calendar, which is where the decision is made.
- ❌ No **open** action — reopening means finding and deleting the right
  restriction row.
- ❌ No visible **close-out summary**: which dates are closed, why, on which
  channels, expiring when.
- ❌ No close **per channel** from the UI, though the engine supports it.

**Done when**
1. Select a date range on the rate calendar → **Close** / **Open** in one action,
   with an optional reason.
2. Closed cells are unmistakable on the calendar and say why on hover.
3. A close-out list showing every active closure with its scope, reason and
   expiry, and one-click reopen.
4. Per-channel closure from the same control (close Booking.com only).
5. Every open/close is audited and pushed to the affected channels.

---

## Build order

Value first, and dependencies before dependents.

| # | Item | Status | Why this position |
|---|---|---|---|
| 1 | **R2 Backup schedule** | ✅ done | Nothing else matters if the data can be lost. One hour, highest value |
| 2 | **R1 SQLite hardening** | ✅ done | Underpins everything; measurable before/after |
| 3 | **R7 Open/close** | ✅ done | Small, high daily use, no external dependency |
| 4 | **R5 Date changes** | ✅ done | Small, high daily use, no external dependency |
| 5 | **R6 Price planning** | ✅ done | Larger, self-contained, no external dependency |
| 6 | **R3 No-show reporting** | ✅ built · 🔌 unconfirmed | Needs the channel write path built first |
| 7 | **R4 OTA messaging** | ✅ built · 🔌 unconfirmed | Largest; reuses the channel write path from R3 |

### What R1 actually found

Measured against a purpose-built database of three years' trading — 15,330
reservations, 60 rooms, 58 MB (`npm run bench`):

| Operation | Before | After |
|---|---|---|
| Reservation list · first page | 19.6ms | 0.9ms |
| Reservation list · by status | 11.4ms | 0.0ms |
| Reservation search · by name | 21.4ms (p95 69ms) | 1.4ms |
| Reservation count (paging) | 10.1ms | 0.5ms |

Three defects, none of which the existing checks caught:

1. **The list sorted every reservation for the property in memory.** `ORDER BY
   arrival, guest_name` matched no index, so SQLite materialised the whole
   history into a temp b-tree, sorted it, and handed back fifty rows. Having to
   sort anyway, it also chose to drive the join from `rate_plans` — scanning
   reservations once per rate plan. Fixed by `ix_res_list`, and by widening
   `ix_res_status` so a status-filtered page is walked rather than sorted.
2. **A balance query per row.** A fifty-row page issued fifty-one queries. Now
   one grouped query for the whole page.
3. **The paging count carried a join it never used.** Only the search predicate
   reaches into `rooms`; the join is now added only when search is active.

The query-plan review had been reporting "every hot path uses an index"
throughout all of this. It looked only for table scans, and it never examined
the list query at all — that one is assembled from a shared `RES_SELECT`
fragment, so it did not begin with a SQL verb and the extractor skipped it
without saying so. Both are fixed: fragments are resolved (285 statements
reviewed, up from 260), a sort feeding a LIMIT is now flagged, and anything
that still cannot be reconstructed is listed by name. A check that omits the
query you most wanted checked is worse than no check.

That last change immediately paid for itself in `messages`: the guest inbox
scanned and sorted the whole table. Harmless at zero rows today, not harmless
once R4 puts OTA conversations through it. Fixed by `ix_msg_inbox`.

Index changes reach existing databases through `ensureIndex()` (schema v3).
`CREATE INDEX IF NOT EXISTS` does nothing when the name already exists even if
the columns have changed, so a widened index would otherwise reach new
installations only — fast on a fresh database, slow on the one with three years
of real bookings in it.

### What R7 delivered

The restrictions engine was already right; what was missing was the operator's
side of it. `services/closeouts.ts` adds the verbs — close, open, list — on top
of the same `stop-sell` row the engine already enforces.

- **Close from the calendar.** Drag across dates in a row and a bar rises with
  Close / Open, an optional reason, and a channel selector. The row supplies the
  scope, so what is about to be closed is whatever is under the cursor.
- **Open is a real operation, not a delete.** Reopening a slice out of the middle
  of a closure splits it in two; reopening an edge shrinks it; reopening all of
  it removes it. Consecutive closes merge back into one row so the list does not
  fill with fragments.
- **Scope is honoured honestly.** Opening one room type out of a property-wide
  closure would mean exploding that row into one per type. It is refused and the
  blocking closure is named, rather than appearing to succeed while the dates
  stay shut.
- **Per-channel closing** is reachable from the same control — close
  Booking.com and leave the desk selling.
- **Closed cells are unmistakable** on the calendar and say why on hover.
- **A close-out list** shows every closure with its scope, reason, who set it,
  and whether it is live, upcoming or expired, with one-click reopen.

The behavioural change worth noting: **closing now reaches the OTAs by itself.**
The push queue existed but only drained when somebody pressed a button, so a
date closed in Helio stayed on sale on Booking.com until it was noticed. A
background drain runs every 60s (`HELIO_CHANNEL_DRAIN_SECONDS`) for properties
with a connected channel, keeping the queue's retry and failure accounting. The
close-out screen states plainly when pushes are queued or have failed rather
than implying a closure is live everywhere the moment it is saved.

Verified by `npm run verify:closeouts` — 61 checks against the booking engine
itself, so every case asserts what the system will actually refuse to sell — and
`npm run closeout-ui` — 19 checks driving the real screen in a browser.

### What R5 delivered

`services/staydates.ts` gives extending and shortening their own path, separate
from the general amend form. Three things it does that the amend path did not:

- **Nights already agreed keep their rate.** The general amend re-prices every
  unposted night, so adding a fourth night could quietly re-price the first
  three if a rate change had landed in between. An extension prices only the
  nights being added. The dialog says so, because a guest who was quoted a
  number expects to pay it.
- **The room is never dropped silently.** If the current room is not free for
  the new dates, the change is refused and the rooms that *are* free are offered
  — or the room can be released, but only when that is asked for explicitly.
- **A posted night cannot be dropped.** Shortening past a night the night audit
  has already posted would unwind a closed business day. It is refused, the
  dates are named, and the message says to void the charges first.

`previewStayChange` answers everything `changeStayDates` will act on without
writing anything: the nights added or removed with their prices, the delta, the
new total, whether the room survives, and every selling rule the new dates break
— in words, not as a status code. It is a GET, so the screen can call it freely
as the operator types.

Reachable in one click from the guest dashboard and the in-house list, with
+1 / +2 / +3 / +7 / −1 shortcuts. Both directions are audited
(`reservation.extend` / `reservation.shorten`) and queue a channel push across
the whole affected span, so nights released by a shortening are re-opened on the
OTAs as well as nights taken by an extension.

Verified by `npm run verify:staydates` — 57 checks — and `npm run staydates-ui`
— 23 checks driving the real dialog in a browser, including that previewing
writes nothing.

### What R6 delivered

The organising idea in `services/rateplanning.ts` is that **planning and
applying are the same code path**. `planChange` works out every cell a change
would touch and what each goes from and to; `applyChange` takes that plan and
writes it. The preview endpoint runs step one and stops. A preview can therefore
never disagree with what happens — which is the only thing that makes a preview
worth showing, and it is asserted directly: the check applies a change and then
compares every written cell against what the plan promised.

- **Preview before apply.** The bulk editor shows how many prices move, over how
  many dates, room types and plans, the average movement, the current and new
  ranges, and the twelve biggest movers. It warns when a change would zero a
  price, more than double one, or is aimed at a derived plan that will be
  recalculated away. `Apply now` sits next to `Schedule for later`.
- **Seasons** — named, coloured, prioritised date ranges. Where two overlap the
  higher priority wins. A season is a label, not a rate: deleting one changes no
  prices.
- **Scheduled changes** with an effective date, a queue showing what each will
  do, cancellable before they fire, and applied automatically by the night audit
  that rolls onto the date. A change is planned when it is *scheduled*, so one
  that could never work is rejected then rather than failing silently at 3am. A
  change that fails on the day is recorded as failed with its reason and does
  not stop the audit.
- **Copy a period** onto another, day for day, with a multiplier. It warns when
  the periods start on different weekdays — weekend prices landing on weekdays
  is the classic way this goes wrong — and when source and target overlap.
- **Rate history per cell**: what it moved from and to, by what means (bulk,
  scheduled, copy), why, who and when. A first write onto an inherited cell
  records `from` as null rather than inventing a number.

Cells that would not move are not written, so the history stays free of noise
and the channels are not told about changes that did not happen.

Verified by `npm run verify:rates` — 76 checks — and `npm run rateplanning-ui` —
32 checks driving the real screen, including reading the promised number off the
page and holding the server to it.

### What R3 delivered — and what is still unconfirmed

Marking a guest as a no-show was only the property's half. Until Booking.com is
told, it still believes the guest arrived: the commission stands and the guest
is not flagged. `services/channelreports.ts` closes that loop, along with the
two neighbouring actions a desk needs — a booking cancelled at the property and
a card that could not be charged.

The rule the whole file is built around: **it must never claim a success it did
not get.** Beds24 reports write failures *inside* a successful HTTP response, so
a 200 does not mean the booking changed. Both the envelope and the per-item
result have to say so; anything else is recorded as failed with the channel's
own words, and the raw request and response are kept on the reservation so a
failure can be diagnosed rather than guessed at.

- Marking an OTA no-show now offers to report it straight away, rather than
  leaving it to be remembered.
- The reservation carries `channel_report_status`, `channel_reported_at`,
  the error, the attempt count and the raw exchange (schema v4).
- Reporting is retryable — calling it again *is* the retry — and a later success
  clears the error while keeping the attempt count.
- The window is surfaced ("about 2 days left to report this"), and a passed
  window is a warning, not a refusal: the exact limit is one of the unconfirmed
  numbers, so refusing on it would be the wrong kind of confidence. The channel
  gets the final word.
- **Channel manager → To report** lists every no-show the channel has not been
  told about, with its window and whether the channel is even connected.

**🔌 What still needs a live account.** Two things are written from the
documented behaviour and have not been confirmed against a funded Beds24 account
connected to a real Booking.com property:

1. whether a no-show is reported as `status: 'cancelled'` with a `subStatus`, or
   through a dedicated field;
2. how long after arrival the channel still accepts the report.

Both live in one table (`REPORT_ACTIONS`) so a correction is a one-place change.
The uncertainty is stated on the screen, in those words, rather than left for
someone to discover during an argument about commission.

Verified by `npm run verify:reports` — 64 checks against a stub channel that can
answer cleanly, reject inside a 200, reject at the envelope, return an HTTP
error, refuse the token, or say nothing at all. Every one of those asserts the
failure is recorded as a failure.

### What R4 delivered — and what is still unconfirmed

The thing you asked for most precisely: read and answer a Booking.com guest
inside Helio, without logging in to the extranet. `services/messaging.ts` polls
conversations in through Beds24 and sends replies back out through the same
connector.

- **Inbound.** A poll every five minutes (`HELIO_MESSAGE_POLL_SECONDS`) pulls
  messages for bookings that are still live — arriving, in-house, or departed
  within a fortnight — and files them against the right reservation. The window
  overlaps itself deliberately, so a message arriving twice is the normal case;
  the channel's own message id is the dedup key.
- **Outbound.** A reply goes out through the originating channel, is retryable,
  and carries the channel's own words when it is refused.
- **A unified inbox** — every conversation, every channel, filtered by unread /
  in-house / arriving today / channel, searchable, with the booking beside the
  thread and one click through to it.
- **Unread counts** on the thread and in the filter.
- **Templates with merge fields** — `{{firstName}}`, `{{room}}`, `{{roomType}}`,
  `{{arrival}}`, `{{checkInTime}}` and the rest, seeded with five the demo
  property can use immediately. An *unknown* field is left visible rather than
  blanked: "see you on {{arrivalDate}}" is obviously broken and gets fixed;
  "see you on " looks fine and goes out.

**The two honesty rules.** First, a message is never marked *delivered* —
`accepted by the channel` is the strongest claim available, because Beds24
taking a message is not the guest receiving it. Second, a reply that could not
be sent is **kept on the thread and labelled**, never dropped: losing a typed
reply is worse than failing to send it, because then nobody knows it was
attempted.

**🔌 What still needs a live account.** Which channels relay guest messages is
set from the documented integrations (Booking.com and Airbnb yes; Hostelworld
and others no). It is used only to *withhold* a claim — a channel not on the
list gets no reply box, just an explanation and an internal note. The list lives
in one constant (`MESSAGE_CAPABLE`) so a correction is a one-line change. The
inbox states the uncertainty in those words.

Verified by `npm run verify:messaging` — 75 checks, including a channel that
cannot carry messages, a rejection inside a 200, a transport failure, a booking
with no channel at all, and polling the same conversation repeatedly.

One bug worth recording because no test could have caught it: the outgoing
message bubbles used a Tailwind colour that does not exist (`dash-ink` rather
than `dash-text`), so they rendered as white text on a white card — invisible.
It was found by looking at a screenshot of the finished screen. The same
mistake was in the close-out selection highlight.

R1–R2 and R5–R7 are fully verifiable on this machine. R3 and R4 will be built
against the documented Beds24 API and tested with a stubbed channel, but the
final confirmation needs a funded Beds24 account connected to a real
Booking.com property. That limitation will be stated in the UI, not hidden.

---

## What "well developed" means for each item

Every item ships with:

- Server-side enforcement — the UI may guide, but the API decides.
- An audit entry for anything that changes money, inventory or availability.
- An automated check added to a verification suite, so it cannot regress.
- Honest failure states — no green tick for something that did not happen.
