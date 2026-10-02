# The offline front desk

**Status:** requirements + design. Nothing here is built yet.

## What exists today

Installable, with an update prompt, caching fonts and avatars. **No API data is
cached at all**, so the app opens offline and every screen shows an error. It is a
shortcut to a website, not an offline tool.

## The danger, stated first

The obvious way to build an offline PWA is to queue every write and replay it when
the connection returns. **For a PMS that is actively dangerous**, and it would destroy
the one guarantee this system is built on.

Helio prevents overbooking because every booking goes through one serialised writer:
twelve simultaneous requests for the last room produce exactly one booking. A client
that queues bookings offline breaks that completely — two devices each take "the last
room", both queue, both replay, and the property is oversold with a clean sync log.
The same reasoning kills offline payments, rate changes and the night audit.

So the rule is:

> **Offline reads: yes, generously. Offline writes: only where the operation is
> idempotent and cannot conflict. Everything else refuses, and says why.**

This is the honesty principle applied to connectivity. A queued booking that "will sync
later" is exactly the green tick for something that did not happen that the rest of the
system refuses to show.

## What is safe, and what is not

| Operation | Offline | Why |
|---|---|---|
| Arrivals / departures / in-house lists | **Read from cache** | Stale by minutes at worst; the alternative is a blank screen with a guest at the desk |
| Guest details, room number, phone, notes | **Read from cache** | Same |
| Housekeeping room list and statuses | **Read from cache** | Same |
| **Housekeeping status change** | **Queue** | Idempotent (`set status = Clean`), one attendant per room, last-write-wins is genuinely correct, and it is done in corridors where wifi is worst |
| Room-inspection notes | **Queue** | Append-only, no conflict |
| Creating a booking | **Refuse** | Overbooking. Two devices cannot both take the last room |
| Taking a payment | **Refuse** | Money must not be recorded until it is recorded |
| Check-in / check-out | **Refuse** | Moves inventory and posts charges; a queued check-in on a room somebody else filled is a guest with no bed |
| Rate or availability change | **Refuse** | Goes to the OTAs; late is worse than never |
| Night audit | **Refuse** | Single all-or-nothing transaction over the whole property |

## Requirements

### P1 · Cache the operational reads
1. GET responses for today's operational data are cached and served when offline.
2. The cache is **per property** — switching property must never show another one's data.
3. Signing out clears it. A cached arrivals list is guest personal data.

### P2 · Never lie about freshness
1. When serving cached data the screen says so, with the age: *"showing data from 14 minutes ago"*.
2. The distinction between "offline" and "the server is down" is preserved — they need different actions.
3. Nothing shows a spinner forever; a failed read that has a cached answer shows the answer.

### P3 · A queue for the two safe writes
1. Housekeeping status changes and inspection notes queue when offline.
2. The count is always visible: *"3 changes waiting to sync"*. Never hidden.
3. They replay in order on reconnect, and a **rejected** replay surfaces as a real
   failure the user must resolve — not a silent drop.
4. The queue survives a page reload and an app restart.

### P4 · Refuse the dangerous writes clearly
1. Attempting one offline gives a plain reason, not a generic network error:
   *"A booking cannot be taken offline — it would risk selling the same room twice."*
2. The button says it before it is pressed where possible, rather than failing after.

### P5 · Make it a real app
1. Installable with proper icons, standalone display, and a maskable icon.
2. App shortcuts to Arrivals, In-house and Housekeeping.
3. Works on a phone: the housekeeping and arrivals screens are the mobile cases that matter.

### P6 · Update without losing work
1. A new version does not reload the page under someone mid-task; it offers.
2. A pending sync queue is never discarded by an update.

## Build order

| # | Item | Why here |
|---|---|---|
| 1 | **P1 + P2** — cached reads with honest freshness | The whole value; useless without honesty |
| 2 | **P4** — refuse dangerous writes | Must land with P1, or offline becomes unsafe |
| 3 | **P3** — the safe write queue | The genuinely new capability |
| 4 | **P5** — install polish, shortcuts, mobile | Makes it feel like an app |
| 5 | **P6** — update handling | Small, last |
