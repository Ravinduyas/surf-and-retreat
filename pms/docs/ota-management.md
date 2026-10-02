# Managing the OTAs, not the pipe

The Channel Manager currently shows one row: **Beds24**. That is honest about
the *connection* and useless as a working screen, because nobody sells on
Beds24. Guests book on Hostelworld, Booking.com, Airbnb — and the questions a
property actually asks are per-OTA: which one is producing, which is cancelling,
which is worth its commission, which has stopped syncing.

This is the checklist for turning that one row into the OTA list.

---

## What the Beds24 API will and will not tell us

I probed the live account rather than assuming. The results decide the design.

| Endpoint | Result |
| --- | --- |
| `/channels`, `/channels/booking`, `/channels/airbnb`, … | HTTP 200, body is literally `null` |
| `/properties/channels` | HTTP 500 |
| `/properties/offers`, `/inventory/rooms/unallocated` | HTTP 500 |
| `/authentication/details` | scopes include `all:channels` — so this is not a permissions problem |

**There is no endpoint that returns "the OTAs this property is connected to."**
The scope exists, the routes answer, and they return nothing.

Two things *are* available, and the design is built on them:

**1 · The channel catalogue, from `roomTypes[].priceRules[].channels`.**
Thirty-eight channels, named by Beds24 itself: `agoda, airbnb, atraveo,
bedandbreakfasteu, bedandbreakfastnl, bookeasycomau, booking, bookvisit,
bookitconz, despegar, edreamsodigeo, expedia, feratel, flipkey, goibibo,
guestlinkcouk, hometogo, hostelinternational, hostelsclub, hostelworld,
hotelbeds, hrs, jomres, lastminute, marriott, ostrovokru, ota, tablethotels,
tiket, tomastravel, traumferienwohnungen, traveloka, travia, trip,
tripadvisorrentals, vacationstay, vrbo, webroomsconz`. This is read live, so the
picker never drifts from what Beds24 supports.

**2 · A rate code per channel, in the same structure.** On this property exactly
one channel carries one: `booking = 31973989`, on all five room types.
`hostelworld` has an empty rate code.

**A rate code is a hint, not proof.** It shows a rate mapping exists on the
Beds24 side; it does not prove the channel is live, and it may be left over from
a connection since removed. It is treated as evidence and labelled as such —
never as fact.

**The only ground truth is a booking.** Every Beds24 booking carries a `referer`
naming the OTA it came from, and that is already stored per reservation in
`ota_channel` (schema v8). An OTA that has sent a booking is connected; there is
no arguing with it.

---

## The checklist

### Knowing which OTAs are live

- [x] **C1 · Read the catalogue from Beds24.** The 38 channel keys, with display
      names, pulled from the live property rather than hardcoded. Cached, and
      refreshed whenever the property is re-read.
- [x] **C2 · Detect connected OTAs from three signals, each labelled with where
      it came from** — because a screen that says "connected" without saying how
      it knows is the green tick this codebase keeps removing:
      - **Confirmed** — a booking has arrived from it. Ground truth.
      - **Evidence** — Beds24 holds a rate code for it. Strong, not conclusive.
      - **Declared** — a person ticked it. The API cannot tell us, so someone
        who knows can.
- [x] **C3 · The Channel Manager lists OTAs.** Beds24 moves to a line underneath
      — "via Beds24 · connected 3h ago" — because it is the transport, not the
      product. Each OTA card shows its state, how that state was decided,
      bookings to date, and when the last one arrived.
- [x] **C4 · An OTA can be turned on and off by hand,** for the case the API
      cannot see. Turning one off does not delete its history.
- [x] **C5 · Never silently claim.** An OTA with no evidence at all is listed as
      available, not connected. The counts on the screen distinguish confirmed
      from declared.

### Room types, against Beds24

- [ ] **C6 · Show the Beds24 link on each room type** — external room id, the
      rate code if there is one, and the quantity Beds24 holds.
- [ ] **C7 · Warn when Helio and Beds24 disagree.** Beds24 says `qty 16` for the
      8-bed mixed dorm; Helio holds 2 rooms × 8 beds. If someone changes either
      side, the two drift and the drift sells rooms that do not exist. The room
      type screen says so rather than waiting for an overbooking.
- [ ] **C8 · Deleting a mapped room type is refused,** with the reason: it is
      mapped to a live channel and bookings reference it.

### Verification

- [x] **C9 · `scripts/ota-check.ts`** — provenance is never upgraded without
      cause; a booking promotes an OTA to confirmed; a rate code alone never
      does; turning an OTA off keeps its bookings; the catalogue survives a
      Beds24 read that fails.

---

## What I found that the property should know

Beds24 holds a **Booking.com rate code (31973989) on all five room types**, and
none for Hostelworld. That is the opposite of what I was told is connected.

It is evidence, not proof — a rate code can outlive the connection that created
it. But if Booking.com is genuinely live and nobody expects it to be, it is
selling this property's beds right now, and Helio has never pushed it a rate.
Worth checking in the Beds24 control panel.
