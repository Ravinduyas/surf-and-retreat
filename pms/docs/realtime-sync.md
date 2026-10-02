# Real-time between Helio and Beds24

## What the system does today

| Direction | Mechanism | Delay |
| --- | --- | --- |
| Rates & availability out | queue, drained every 60s | up to 60s |
| Room quantity out | on save | immediate |
| Guest messages in | polled every 300s | up to 5 min |
| **Bookings in** | **nothing** | **never, until somebody presses Import** |

That last row is the one that matters and it is not a delay, it is a hole. A
guest books on Hostelworld right now; Beds24 has it in seconds; Helio does not
know until a human opens the Channel Manager and clicks a button. Between those
two moments the front desk is working from an inventory that is wrong, the tape
chart shows a free bed that is sold, and nothing on any screen suggests
otherwise.

Everything else here is tuning. This is a correctness problem.

## What Beds24 offers

Probed on the live account:

**Webhooks, per property.** `property.webhooks` exists and is currently unset:

```json
{ "version": "one", "url": "", "additionalData": "none", "customHeader": "" }
```

`url` is where Beds24 will POST when a booking changes. `customHeader` is a
header it will send with every call — the shared secret that proves the caller
is Beds24 and not somebody who guessed the path. It is writable through the same
`POST /properties` that already sets room quantity.

**Incremental booking reads.** `/bookings?modifiedFrom=YYYY-MM-DD` is accepted,
so polling can ask "what changed since I last looked" rather than dragging the
whole book every minute.

**The catch: a webhook needs a public URL.** Helio runs on `localhost:5000`, and
Beds24 cannot reach that. So the webhook is built and registerable, and polling
is what actually runs until this is deployed somewhere with a hostname.

---

## The checklist

### Inbound — closing the hole

- [x] **S1 · Poll bookings on a schedule.** Every 60s by default, using
      `modifiedFrom` against the last successful poll so each call is small.
      This is what removes the hole whether or not a webhook is ever set up.
- [x] **S2 · A webhook endpoint** at `POST /api/webhooks/beds24`, which imports
      the changed booking immediately instead of waiting for the next poll.
- [x] **S3 · Verify the caller.** Beds24 sends `customHeader`; a request without
      the configured secret is refused. An unauthenticated endpoint that creates
      reservations is not an endpoint, it is a way in.
- [x] **S4 · Import exactly once.** A booking arriving by webhook and again by
      the next poll must update, not duplicate — keyed on the OTA reference.
- [x] **S5 · Register the URL with Beds24** from a command, and show on the
      Channel Manager whether real-time is live or the system is polling.

### Outbound — closing the gap

- [ ] **S6 · Drain the queue on demand.** A change queued now waits up to a
      minute for the next tick; nudging the drain right after a change makes it
      seconds, while keeping the timer as the backstop.

### Verification

- [x] **S7 · `scripts/realtime-check.ts`** — a webhook without the secret is
      refused; with it, the booking lands; the same booking twice is one
      reservation; polling picks up what the webhook missed; and a failed poll
      does not move the watermark forward, so nothing is skipped.
