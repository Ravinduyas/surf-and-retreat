// ─────────────────────────────────────────────────────────────
// Helio Channel Engine — domain types
//
// The PMS is the SINGLE SOURCE OF TRUTH. Everything here models the
// master record of rates, availability and inventory (ARI), plus the
// per-OTA connector contract used to distribute it DIRECTLY to each
// channel (no Beds24 / aggregator hop in the middle).
//
// Written in "erasable" TypeScript so it runs directly on Node 22+
// via `node --experimental-strip-types` — no build step, no deps.
// ─────────────────────────────────────────────────────────────

// ─── Channels / OTAs ─────────────────────────────────────────
// A channel is a DIRECT destination we distribute to. Each one is
// backed by a Connector (adapter) that speaks that OTA's protocol.
export type ChannelCode =
  | 'BDC'   // Booking.com
  | 'EXP'   // Expedia Group (Hotels.com)
  | 'VRBO'  // Vrbo (Expedia Group, vacation-rental)
  | 'AGD'   // Agoda
  | 'AIR'   // Airbnb
  | 'HW'    // Hostelworld (bed-level)
  | 'GHA'   // Google Hotel Ads (metasearch)
  | 'DIRECT'; // own booking engine (always in-sync, 0% commission)

// The wire protocol a connector speaks. Drives which adapter transport
// is used and what the certification path looks like.
export type Protocol =
  | 'ota-xml'     // OpenTravel 2003B XML (Booking.com legacy, Agoda OTA, Expedia legacy)
  | 'rest-json'   // modern REST/JSON (Booking.com new, Agoda content/promo, Channex)
  | 'graphql'     // Expedia EG Connectivity (reservations/promotions)
  | 'ical'        // calendar-only availability (long-tail portals)
  | 'internal';   // own booking engine, no external certification

// Where a channel sits on its OTA's certification ladder. This is the
// state that "replace Beds24 with direct connections" actually turns on.
export type CertificationState =
  | 'not-started'   // no partner contract yet
  | 'sandbox'       // building against test endpoints
  | 'in-review'     // submitted for certification
  | 'certified'     // approved, live push allowed
  | 'suspended';    // revoked / quality hold

export type ConnectorHealth = 'connected' | 'degraded' | 'error' | 'disabled';

// Which capabilities a given OTA actually exposes over its API. Not all
// OTAs support everything — the engine must degrade gracefully.
export interface ConnectorCapabilities {
  ariPush: boolean;        // push availability + rates + inventory
  restrictions: boolean;   // min/max-LOS, CTA, CTD, stop-sell
  reservationsPull: boolean;
  reservationsPush: boolean; // OTA delivers via webhook
  content: boolean;        // photos / descriptions / amenities
  promotions: boolean;
  bedLevel: boolean;       // dorm / per-bed inventory (Hostelworld)
  derivedRates: boolean;   // parent/child linked rates supported natively
}

// ─── ARI: Availability, Rates, Inventory (the master calendar) ──
export interface RatePlan {
  code: string;
  name: string;
  refundable: boolean;
  // Derived (linked) rate support: a child recalculates from its parent
  // whenever the parent (usually BAR) changes. This is how one edit stays
  // parity-clean across every channel.
  parent?: string;             // parent rate plan code
  offsetType?: 'percent' | 'fixed';
  offsetValue?: number;        // e.g. -10 (%) for non-ref, +15 (fixed) for breakfast
  channels: ChannelCode[];     // which channels this plan is distributed to
}

export interface RoomType {
  code: string;
  name: string;
  physicalCount: number;       // real rooms (the pooled inventory ceiling)
  occupancy: number;
  bedLevel?: boolean;          // true = dorm sold per-bed (occupancy = beds)
}

// One cell of the master calendar: a room type on a date, for a rate plan.
export interface AriCell {
  roomType: string;
  ratePlan: string;
  date: string;                // YYYY-MM-DD
  price: number;               // resolved price (after derived-rate math)
  available: number;           // pooled availability remaining
  // restrictions
  stopSell?: boolean;
  minStay?: number;
  maxStay?: number;
  cta?: boolean;               // closed to arrival
  ctd?: boolean;               // closed to departure
}

// The unit of work pushed to a connector: a batch of ARI cells for a
// set of channels. Connectors translate this into their own wire format.
export interface AriUpdate {
  cells: AriCell[];
  channels: ChannelCode[];
  reason: string;              // audit ("rate.bulk-update", "booking.decrement", ...)
}

// ─── Reservations (inbound from OTAs) ────────────────────────
export interface Reservation {
  id: string;                  // our internal id
  channel: ChannelCode;
  otaReference: string;        // the OTA's booking id
  guest: string;
  email?: string;
  roomType: string;
  ratePlan: string;
  arrival: string;
  departure: string;
  beds?: number;               // for bed-level (dorm) bookings
  amount: number;
  commission: number;
  status: 'new' | 'modified' | 'cancelled';
  receivedAt: string;
}

// ─── Sync log / observability ────────────────────────────────
export interface SyncLogEntry {
  id: string;
  ts: string;
  direction: 'push' | 'pull';
  channel: ChannelCode;
  action: string;
  status: 'success' | 'failed' | 'retrying';
  attempt: number;
  detail?: string;
}

// ─── Rate parity ─────────────────────────────────────────────
export interface ParityRow {
  roomType: string;
  date: string;
  reference: number;                 // our BAR / source-of-truth price
  perChannel: Partial<Record<ChannelCode, number>>;
  worstDeltaPct: number;             // largest disparity vs reference
  inParity: boolean;
}
