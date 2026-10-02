# Overbooking control and audible alerts

**Status:** requirements — nothing below is built yet.
**Scope:** detect overbooking early, make it easy to fix without a guest being
turned away, and make sure nobody at the desk finds out too late.

---

## 1 · Why this is the hardest problem in channel management

Every other channel-manager problem costs money. This one costs a guest standing
at your desk at 11pm being told there is no room. It is the only failure a
property cannot apologise its way out of, and it is the one that ends up in the
review.

The uncomfortable truth is that **overbooking is a timing problem, not a
counting problem.** The arithmetic is trivial — rooms minus bookings. What is
hard is that the count is right in two places at once and still wrong, because
between Helio deciding a room is free and Booking.com being told it is not,
somebody bought it.

### How it actually happens

| # | Cause | Can Helio see it? |
|---|---|---|
| 1 | **Sync race** — the OTA sells during the seconds a push is in flight | After the fact, yes — the booking lands and the count goes negative |
| 2 | **A push that failed and nobody noticed** — the queue errored, the OTA kept selling stale availability | Yes, and this is the one worth catching *before* a booking arrives |
| 3 | **Deliberate oversell that did not pay off** — allowance set to +2 expecting no-shows that did not happen | Yes |
| 4 | **A room taken out of order over existing bookings** — maintenance blocks a room that is already sold | Yes, at the moment the block is created |
| 5 | **Mapping mismatch** — the channel believes the room type has more rooms than it does | Only by comparing pushed allotment against physical count |
| 6 | **Group block released late** — held rooms returned to sale after they were resold | Yes |
| 7 | **A stay extension taking a night that was sold** | Yes — R5 already refuses this |
| 8 | **Two reservations assigned to the same physical room** | Yes, and this is invisible to type-level counting |

Causes 2, 4, 5 and 8 are all detectable *before* anyone arrives. That is where
the value is: an overbooking found three weeks out is a free upgrade, one found
at 11pm is a taxi, another hotel, and a refund.

### The four kinds — and why counting rooms is not enough

Most systems check one of these. Checking one and calling it "no overbooking" is
how the other three reach the front desk.

1. **Type-level oversell** — more live reservations than sellable rooms of that
   type on a date. What everybody means by overbooking.
2. **Room-level clash** — two reservations assigned to the *same physical room*
   on the same night. The type can have spare capacity and this still happens; it
   is an assignment mistake, and the guest finds out by opening a door.
3. **Bed-level clash** — the same, per bed, in a dorm. A dorm room is not
   oversold when six people are in a six-bed room; it is oversold when two of
   them have bed 3.
4. **At risk** — availability is exactly zero with a deliberate allowance still
   open, or a channel push has failed for those dates. Not yet an overbooking,
   but one cancellation-reinstatement or one stale OTA away.

---

## 2 · What "world class" looks like when it happens

The measure of a PMS here is not that it prevents overbooking — nothing can
fully prevent a race with somebody else's website. It is **how few guests get
turned away when it does happen**, and how quickly.

The order matters, and it is always the same:

1. **Stop it getting worse.** Close those dates on the channels *now*. One
   oversold room is a problem; three is an incident. Helio already has close-outs
   (R7) — this must be one button, not a trip to another screen.
2. **Move inventory, not people.** Is a room of the same type actually free and
   just unassigned? Nine times out of ten at the type level, the fix is
   reassignment and nobody ever knows.
3. **Upgrade, don't walk.** A free upgrade into a better room that is sitting
   empty costs the rate difference. A walk costs a night at another hotel, the
   taxi, the refund, and the review. If a better room is free, that is the answer.
4. **Downgrade with compensation** — worth offering before a walk, to the right
   guest, with the discount recorded.
5. **Only then, walk someone** — and the whole game is *choosing who*.
6. **Record what it cost.** A property that cannot say what overbooking cost it
   last year cannot decide what allowance is sensible.

### Choosing who to walk

This is where a system either helps or gets in the way. The decision has to be
**suggested and explained**, never made silently. A screen that says "walk Mrs
Silva" without saying why will not be trusted, and should not be.

**Never walk:**
- a guest already checked in — they are asleep in the room;
- a VIP or a repeat guest — the relationship is worth more than the room;
- a long stay — you would have to find them somewhere for a week;
- part of a group — splitting a group creates several angry guests, not one;
- a guest with an accessibility or medical requirement tied to the room.

**Prefer to walk**, in this order:
- shortest stay — one night is one night's problem;
- arriving latest by ETA — most time to arrange somewhere;
- lowest total value — walking the cheapest booking costs the least to make good;
- booked through the highest-commission channel — the margin is lowest anyway;
- booked most recently — the guest has had the least time to build expectations.

Every one of those is a *heuristic*, not a rule. The screen shows the score and
the reasons; a human presses the button.

---

## 3 · Requirements

### O1 · Detection

**Done when**

1. A scan covering a date window finds all four kinds: type-level oversell,
   room-level clash, bed-level clash, and at-risk dates.
2. Each finding carries: the date, the room type, how many rooms over, the
   reservations involved, and **the likely cause** — a failed push, an
   out-of-order block over a sold room, allowance exceeded, or an unexplained
   channel booking (the race).
3. Severity is by *time*, not size: arriving today is critical, this week is
   urgent, further out is a warning. One room oversold tonight beats three
   oversold next month.
4. The scan runs on demand, on every booking import, and during the night audit,
   and never takes longer than a second on a year of dates.
5. It cannot report an overbooking that is not one — cancelled, no-show and
   checked-out reservations hold no inventory.

### O2 · The overbooking desk

**Done when**

1. One screen lists every current finding, worst first, with the guests involved
   and what each is worth.
2. For a type-level oversell it shows, in order: free rooms of the same type,
   free rooms of a better type (upgrade candidates), free rooms of a lesser type
   (downgrade candidates) — each with the rate difference.
3. **Close these dates** is one button from the finding, and it closes the
   affected room type on every connected channel.
4. A finding can be marked resolved with a note, and reappears if it is still
   true — a resolution that did not fix anything must not hide it.

### O3 · Fixing without a walk

**Done when**

1. Reassigning a guest to a free room of the same type is one click from the
   finding, and the finding disappears because it is actually fixed.
2. An upgrade is one click, records the rate difference as a courtesy, and does
   not charge the guest.
3. A downgrade is one click, offers a compensation amount, and posts it as a
   credit when accepted.
4. Every one of those is audited as an overbooking resolution, not as a routine
   room move — so the trail says *why* it happened.

### O4 · Walking a guest, properly

**Done when**

1. Helio suggests who to walk, ranked, **with the reasons written out** —
   "1 night, arriving 22:00, $180, Booking.com 18%" — and with protected guests
   excluded and the exclusion explained.
2. Walking records: the guest, the hotel they went to, the nights, what it cost,
   the transport, the compensation, and who authorised it.
3. The reservation's status reflects it, the room is released, and the folio
   carries the cost.
4. A walked guest returning for the remaining nights is handled — a two-night
   stay walked on night one still needs a room on night two.
5. The cost is reportable: what overbooking cost this property, by month and by
   cause.

### O6 · Last-room protection — the only real prevention

Everything else in this document makes an overbooking cheap. **This is the only
control that makes the simultaneous-OTA race impossible**, and it deserves to be
first among the preventive measures rather than a footnote.

The race exists because two channels can each sell the *same last room*. Take
that room off the OTAs and there is nothing to race for. Nothing else — not a
faster push, not a better queue — can close a window that lives inside somebody
else's checkout.

The cost is real and must be stated wherever the setting appears: **you will
sell fewer rooms.** A property that protects its last room finishes some nights
at 95% instead of 100%. That is a business decision, and it belongs to the
property, not to the software.

**Done when**

1. Per room type, a threshold: stop selling on OTAs when availability drops to
   N or below. `0` means no protection — sell everything and manage the
   consequences.
2. The protection applies to channels only. The front desk and direct bookings
   can always sell the protected room; that is the point of protecting it.
3. It works through the existing close-out and ARI push — a protected date is
   pushed as unavailable to the OTAs, and reopens by itself the moment a
   cancellation puts availability back above the threshold.
4. The rate calendar shows which dates are protected and why, distinctly from a
   manual close-out — an operator must not think the system has closed a date
   they did not close.
5. The setting states the trade-off in plain words, with the property's own
   numbers: how many nights in the last year would have sold out, and how many
   overbookings occurred.

### O7 · Knowing your actual exposure

A property cannot decide whether to protect the last room without knowing what
the race is costing it. The number is measurable from data Helio already keeps.

**Done when**

1. The time between a booking landing and the outgoing push completing is
   recorded, and reported as a median and a worst case — that is the exposure
   window.
2. Total exposure is reported per month: how long the property spent with stale
   availability sitting on the OTAs.
3. Dates that were sold at exactly zero availability are counted — every one of
   those was a race that happened to be won.
4. It is presented beside the last-room setting, so the decision is made against
   the property's own figures rather than a guess.

### O5 · Prevention

**Done when**

1. A dashboard tile shows overbookings and at-risk dates, and it is visible
   without going looking.
2. Setting a room out of order over an existing booking warns, names the
   bookings, and requires confirmation.
3. A channel push that has been failing for a date range is surfaced as an
   overbooking risk, not just as a sync error.
4. The oversell allowance can be set per room type per date range, with the
   historical no-show rate shown beside it so the number is a decision rather
   than a guess.

---

### A1 · Alerts and sound

The point of a sound is that the person is looking at another screen, or at a
guest. It has to be **impossible to miss and impossible to resent** — those pull
in opposite directions, which is why each one must be switchable off
independently.

**Done when**

1. Three events raise an alert: **overbooking detected**, **new booking
   arrived**, **booking cancelled**.
2. Each has its own distinct sound: an urgent repeating alarm for overbooking, a
   rising chime for a new booking, a falling tone for a cancellation. Distinct
   enough to tell apart from across a room without looking.
3. Sounds are generated in the browser, not loaded as files — the app stays
   self-contained and works offline.
4. Nothing sounds for events that happened before the screen was opened. An
   alarm on every page refresh is how alarms get switched off for good.

### A2 · Settings, properly

**Done when**

1. Each of the three alerts can be turned off on its own, in Configuration.
2. Volume is settable, and each sound has a **test** button — a setting you
   cannot hear before you commit to it is a setting nobody trusts.
3. **Quiet hours**: a from/to window during which sounds are suppressed, with
   an option to let overbooking through anyway, because that one is worth waking
   for.
4. Repeat behaviour for the overbooking alarm is settable — once, or until
   acknowledged.
5. The person at the desk can mute their own device without changing the
   property's settings, and that mute is obvious rather than silent.
6. Browsers refuse to play audio before a user interacts with the page. That is
   stated plainly with a one-click "enable sound", not left to fail quietly —
   a muted alarm that thinks it is armed is worse than no alarm.

### A3 · The event feed

**Done when**

1. The app learns about new bookings, cancellations and overbookings within
   about twenty seconds, without reloading.
2. Events carry enough to act on — guest, dates, room type, and a link straight
   to the thing that happened.
3. An alert can be acknowledged, and acknowledging stops a repeating alarm.

---

## 4 · Build order

| # | Item | Why this position |
|---|---|---|
| 1 | **O1 Detection** | Nothing else can be built without it, and it is the part that must be exactly right |
| 2 | **A3 Event feed** | Both the desk and the sounds hang off it |
| 3 | **A1/A2 Alerts and settings** | Small, self-contained, immediately useful |
| 4 | **O2 The desk** | Where the findings become actions |
| 5 | **O3 Fixing without a walk** | The common case — most overbookings never need a walk |
| 6 | **O4 Walking** | The rare case, but the one that must be recorded properly |
| 7 | **O6 Last-room protection** | The only real prevention — but it needs O7's numbers to be a decision rather than a guess |
| 8 | **O7 Exposure measurement** | Built alongside O6; meaningless apart from it |
| 9 | **O5 Prevention** | Closes the loop back to O1 |

Everything here is verifiable on this machine. There is no 🔌 — no live channel
account is needed, because overbooking is detected from Helio's own data and the
close-out push already exists and is proven.

---

## 5 · What this will not do

Stated so it is not discovered later:

- **It cannot prevent the race — except by not entering it.** Each OTA is
  authoritative for its own sale: Booking.com does not ask your PMS at the
  moment a guest checks out, it sells from its own cached copy and tells you
  afterwards. If two channels each hold "1 available" and both sell within the
  same few seconds, both succeed and nobody was asked. No channel manager can
  stop that, because there is no lock across other companies' websites.

  What Helio can do is (a) shrink the window by pushing fast, (b) notice within
  seconds and make the fix cheap, and (c) offer **last-room protection (O6)**,
  which removes the contested room from the OTAs altogether. That last one is
  the only actual prevention, and it costs occupancy. Any system claiming to
  prevent the race without that trade-off is claiming to control somebody else's
  checkout.
- **It will not walk a guest by itself.** Suggested, explained, ranked — but a
  person presses the button. This is somebody's night.
- **It cannot know the local hotel market.** The walk record captures where the
  guest went and what it cost; it does not find them a hotel.
