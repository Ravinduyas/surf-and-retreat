# Closing rooms without closing the desk, and feeding Helio from Beds24

Two requests, one of which turned out to be a live defect.

---

## 1 · Closing a room currently closes it to *you* as well

A property closes rooms for one of two quite different reasons:

- **"Stop the OTAs selling this."** The room still exists, the front desk can
  still walk somebody into it, and often that is the whole point — pull the last
  few beds off Hostelworld so the desk can sell them at the door, or hold
  inventory back over a busy weekend.
- **"Nobody sells this."** Maintenance, a burst pipe, a room being repainted.

Helio has one mechanism for both. A `stop-sell` restriction with a NULL
`channel_code` means "applies to every channel", and
[restrictions.ts:39](../apps/pms-api/src/services/restrictions.ts#L39) reads a
direct booking as just another channel:

```ts
if (r.channel_code && r.channel_code !== (ctx.channelCode ?? null)) return false;
```

A walk-in has no `channelCode`, so a property-wide stop-sell matches it and the
booking is refused. **Close your rooms on the OTAs and you have also stopped
your own reception taking the guest standing in front of them.**

That is the wrong way round. The desk is the one seller who can see the room,
knows it is free, and has the guest in the building.

### The fix

- [x] **K1 · A stop-sell says who it applies to.** `applies_to`: `channels`
      (OTAs stop; the desk carries on), `all` (nobody sells), or `direct`.
      Existing rows keep `all`, because that is what they have meant until now
      and changing the meaning of stored data silently is its own incident.
- [x] **K2 · Closing from the calendar defaults to `channels`.** That is the
      common case and the safe one: the worst outcome is a room sold at the
      desk that could have been sold twice, not a room nobody can sell.
- [x] **K3 · A walk-in is never blocked by a channel closure,** and the arrival
      screen says the room is closed to OTAs so the receptionist knows why it
      looked unavailable online.
- [x] **K4 · Both kinds still push to Beds24.** `channels` and `all` both close
      the dates on the OTAs — the difference is only what Helio itself allows.
- [ ] **K5 · Say which one you are doing.** The close dialog spells out the
      consequence in a sentence rather than offering a checkbox called "scope".

## 2 · Feeding Helio from Beds24, from the screen

`beds24-golive --create-room-types` already builds room types, rooms, beds, a
rate plan and a priced calendar out of what Beds24 holds. It is a command-line
script, which means it is unavailable to the person who actually configures the
property.

- [ ] **K6 · The Beds24 property id is visible and settable** in Configuration,
      with the properties the token can see offered as a list rather than typed
      from memory.
- [ ] **K7 · "Import inventory from Beds24"** as a button: read the rooms, show
      what would be created or changed, and apply it on confirmation. Nothing is
      written before somebody has seen the list.
- [ ] **K8 · Re-importing is safe.** A room type already present is matched and
      left alone rather than duplicated; only its Beds24 link and quantity are
      refreshed.

## 3 · Rates out in real time

Rate-planner changes already enqueue a channel push
([rateplanning.ts:251](../apps/pms-api/src/services/rateplanning.ts#L251)), and
the queue drains every 60 seconds.

- [x] **K9 · Drain right after a change** so a price edit reaches the OTAs in
      seconds rather than up to a minute, with the timer still there as the
      backstop.

### Verification

- [x] **K10 · `scripts/closing-check.ts`** — a channel closure does not stop a
      walk-in; an `all` closure stops everyone; existing rows keep their meaning;
      both kinds reach the ARI push; and a closure scoped to one OTA leaves the
      others selling.
