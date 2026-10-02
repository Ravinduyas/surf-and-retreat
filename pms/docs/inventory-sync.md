# Editing inventory in Helio, and making Beds24 agree

Two questions, both answered against the live account rather than guessed.

---

## 1 · Can Helio change the room count on Beds24? **Yes.**

`POST /properties` accepts a nested room-type update and the route works. Probed
with a property id that is *not* this account's, so nothing could be modified:

```
POST /properties   [{ "id": 999999999, "roomTypes": [{ "id": 888888888, "qty": 8 }] }]
→ 201  [{ "success": false, "errors": [{ "action": "modify property", "message": "access denied" }] }]
```

"Access denied" is the answer for someone else's property — the shape is
accepted and the field is understood. For room `715747` on property `346677`,
the same call sets `qty`.

**Note the status code: `201` with `success: false` in the body.** Beds24
reports a *refused* write with a success-shaped HTTP status. This is exactly the
envelope-versus-per-item trap that `readWriteResult` already exists to catch, and
the quantity push goes through it — a rejected inventory change must never be
reported as applied.

## 2 · Can Helio read which OTAs are connected? **No. Confirmed again.**

Every channel route answers `200` with a body of literally `null`, with or
without parameters, on a token holding the `all:channels` scope:

```
/channels                                     → null
/channels/booking/properties                  → null
/channels/booking/rooms?propertyId=346677     → null
/channels/hostelworld/properties              → null
/channels/hostelworld/rooms?propertyId=346677 → null
/channels/airbnb/rooms?propertyId=346677      → null
/properties/channels                          → 500
```

So, precisely:

- **The OTA names come from the Beds24 API** — all 38 of them, read live from
  `roomTypes[].priceRules[].channels`. Nothing is hardcoded.
- **Which of them is connected does not.** There is no endpoint. Hostelworld
  cannot be auto-detected until it sends a booking.

That is why the screen needs one click from someone who knows. After that click
Hostelworld shows as connected; from its first booking onward it is confirmed by
the booking itself and no longer depends on anyone's word.

---

## The steps

### A · Editing how many rooms and beds exist

- [x] **A1 · Store what Beds24 holds.** Each mapping records the `qty` Beds24
      has for that room, read on every discover, so the two sides can be
      compared without a live call.
- [x] **A2 · Show both numbers on the room type.** "Helio 16 beds · Beds24 16" —
      and when they differ, say so in colour with the difference spelled out.
- [x] **A3 · An inventory editor.** Change the number of rooms, or beds per room,
      from the room type screen. Adding creates rooms and beds; reducing removes
      the highest-numbered ones.
- [x] **A4 · Push the new quantity to Beds24** through `POST /properties`, read
      per-item, and record the result. A refusal is shown as a refusal.
- [x] **A5 · Refuse to remove what is sold.** A bed with a booking on it cannot
      be deleted by lowering a number; the editor says which ones and stops.
      This is the guard that makes the feature safe to give to a receptionist.

### B · Making the two sides agree

- [ ] **B1 · A match screen.** Every Beds24 room beside its Helio room type:
      name, kind, quantity, price. Differences highlighted, each with a "use
      Beds24's" or "send Helio's" action.
- [x] **B2 · Drift is checked on every sync** and raises a notification rather
      than waiting to become an overbooking.

### C · The Channel Manager shows OTAs only

- [x] **C1 · Beds24 disappears from the channel list.** It becomes a status
      line — "via Beds24 · connected · synced 3h ago" — because it is the pipe,
      not a place anyone books.
- [x] **C2 · Hostelworld can be marked connected in one click,** and the screen
      explains why the click is needed rather than pretending it detected it.
- [x] **C3 · The connection's own controls** (test, import, push, disconnect)
      move under that status line, where they still belong to Beds24.

### D · Verification

- [x] **D1 · Extend `ota-check.ts`** — quantity drift is detected; a reduction
      below sold inventory is refused; a Beds24 refusal is not recorded as
      applied.
