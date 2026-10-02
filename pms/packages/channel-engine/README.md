# Helio Channel Engine — direct-to-OTA distribution core

The connectivity engine that replaces **Beds24-as-hub** with **direct, pluggable
connectors per OTA**. The PMS is the single source of truth; this engine fans
rate/availability/inventory (ARI) changes out to each channel directly and pulls
every booking back into one pooled calendar.

**Zero runtime dependencies.** Runs on Node 22+ via native TypeScript
type-stripping — no build step, no `npm install` needed to run.

```bash
npm run demo     # end-to-end proof: derive rates → publish → book → re-push → parity
npm run demo:cm  # world-class channel-manager brain: rates, restrictions, yield,
                 #   promotions, inventory models, Beds24 batched push
npm start        # REST server on http://localhost:8787
npm run typecheck  # optional: needs `npm i` for tsc + @types/node
```

## Two builds in here

1. **`demo.ts` (direct-to-OTA model)** — the PMS pushes ARI directly to each OTA
   through a connector-per-OTA layer (no aggregator). Kept for the "own direct
   development" track.
2. **`demo:cm` + `src/cm/*` (Beds24-backbone model)** — the current target:
   Beds24 stays as the distribution layer and the PMS holds the world-class
   rate/restriction/yield/inventory brain, pushing resolved values to Beds24
   via `adapters/beds24.ts`. Same architecture, Beds24 is one connector.

### World-class channel-manager modules (`src/cm/`)

| Module | Options |
|--------|---------|
| `cm/rates.ts` | occupancy-based, extra-adult, LOS pricing, derived/linked (±% / ±fixed), per-channel multiplier |
| `cm/restrictions.ts` | min/max stay, stay-through, CTA, CTD, stop-sell, release, min/max-advance + stay validator + per-channel capability matrix |
| `cm/yield.ts` | Beds24-style occupancy + lead-time auto-pricing |
| `cm/promotions.ts` | early-bird / last-minute / long-stay + native-promo vs must-send-as-price delivery |
| `cm/inventory.ts` | pooled, allocated caps, virtual/derived, dependent (combine/split), bed-level dorms |
| `adapters/beds24.ts` | Beds24 API v2 connector: batched writes under the ~100-credit/5-min budget, OTA booking-webhook normalization |

## What the demo proves (no Beds24 in the path)

1. **Derived rates cascade** — one BAR edit auto-computes NREF (−10%) and B&B (+$15).
2. **ARI publishes directly** to Booking.com / Expedia / Agoda connectors.
3. **Pooled-inventory guard** — an inbound Booking.com reservation decrements the
   shared availability (12→11) and the engine **re-pushes to every other channel**
   so the sold room disappears everywhere.
4. **Resilience** — a simulated HTTP 503 triggers retry with exponential backoff.
5. **Rate parity monitor** — a deliberately drifted channel is flagged (5.63%).

## Architecture

```
PMS (source of truth) ──▶ PushEngine ──▶ [Connector per OTA] ──▶ Booking.com
   rooms · rate plans        fan-out          adapter               Expedia/Vrbo
   pooled ARI calendar       retry/backoff    pushAri()             Agoda
   derived rates             sync log         normalizeBooking()    Hostelworld (bed-level)
        ▲                        ▲                                  Airbnb / Channex*
        └── ReservationDelivery ─┘   ◀── bookings pulled back, inventory re-balanced
```
`*` un-certifiable channels (Airbnb) ride a white-label connector — same interface.

| File | Role |
|------|------|
| `src/types.ts` | Domain model: ARI, rate plans (derived), connectors, reservations, parity |
| `src/sourceOfTruth.ts` | Master calendar, derived-rate resolution, pooled decrement |
| `src/connector.ts` | The one interface every OTA adapter implements + `canPushLive()` |
| `src/pushEngine.ts` | Fan-out, certified-only gating, retry/backoff, sync log |
| `src/reservationDelivery.ts` | Inbound normalize → decrement → re-push (overbooking guard) |
| `src/parity.ts` | Rate-parity drift monitor |
| `src/adapters/mock.ts` | Working demo connector |
| `src/adapters/{bookingcom,expedia,agoda,hostelworld}.ts` | Real-shaped stubs, inert until certified |
| `src/server.ts` | Stdlib REST API the PMS calls instead of Beds24 |

## Turning a connector live (per OTA)

Each real adapter is wired to the correct endpoint/protocol but **inert** until
certified. To go live:

1. Sign the OTA's connectivity-partner contract; obtain machine-account credentials.
2. Fill in the adapter's transport at the `TODO(cert)` markers (send ARI, parse ack).
3. Pass the OTA's certification suite.
4. Set `certification = 'certified'` and inject credentials — the engine starts
   pushing live immediately. Nothing else changes.

See `../helio-direct-ota-blueprint.html` for the full connectivity matrix,
certification gates, and phased roadmap.

## REST API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | liveness |
| GET | `/connectors` | connectors + certification state + capabilities |
| GET | `/calendar?room=DLXK` | source-of-truth ARI |
| POST | `/ari` | set a BAR cell → auto-republish to all live channels |
| POST | `/webhooks/:channel` | inbound OTA booking → decrement + re-push |
| GET | `/sync-log` | recent push/pull activity |
| GET | `/parity` | rate-parity snapshot |
