// ─────────────────────────────────────────────────────────────
// Hostelworld DIRECT connector — BED-LEVEL distribution.
//
// The distinguishing feature: dorms are sold PER BED, not per room.
// occupancy = beds, so a 3-bed dorm at $15 sends three $15 bed listings;
// a private double is sent per-person ($30 double => $15pp). This adapter
// sets `bedLevel: true` and expands pooled dorm inventory into bed units.
//
// Protocol: Hostelworld Partner API (REST/Swagger) + legacy XML in places.
// A special Hostelworld API password (from your HW account manager) is
// required — not normal login credentials.
// ─────────────────────────────────────────────────────────────
import type { Connector, PushResult, RawBooking } from '../connector.ts';
import type {
  ChannelCode, Protocol, ConnectorCapabilities, AriUpdate,
  Reservation, CertificationState, ConnectorHealth,
} from '../types.ts';

export class HostelworldConnector implements Connector {
  readonly channel: ChannelCode = 'HW';
  readonly name = 'Hostelworld';
  readonly protocol: Protocol = 'rest-json';
  readonly capabilities: ConnectorCapabilities = {
    ariPush: true, restrictions: true, reservationsPull: true,
    reservationsPush: true, content: true, promotions: false,
    bedLevel: true, derivedRates: false,
  };
  certification: CertificationState = 'not-started';
  health: ConnectorHealth = 'disabled';

  apiPassword?: string;

  async pushAri(update: AriUpdate): Promise<PushResult> {
    if (this.certification !== 'certified' || !this.apiPassword) {
      return { ok: false, channel: this.channel, accepted: 0, rejected: update.cells.length,
        detail: 'Hostelworld connection not certified (needs HW API password)', retryable: false };
    }
    // Bed-level: each dorm cell becomes N bed listings at per-bed price.
    // TODO(cert): map to HW room/rate IDs (via "Get Code") and PUT availability.
    throw new Error('Hostelworld transport not enabled (awaiting certification)');
  }

  async testConnection() {
    return { ok: false, latencyMs: 0, detail: 'Not certified' };
  }

  normalizeBooking(raw: RawBooking): Reservation {
    const r = raw.raw as Record<string, string | number>;
    return {
      id: `res-HW-${r.bookingRef}`,
      channel: 'HW',
      otaReference: String(r.bookingRef),
      guest: String(r.guestName ?? 'Guest'),
      roomType: String(r.roomId),
      ratePlan: String(r.rateId ?? 'DORM'),
      arrival: String(r.arrival),
      departure: String(r.departure),
      beds: Number(r.beds ?? 1),
      amount: Number(r.total ?? 0),
      commission: Number(r.commission ?? 0),
      status: 'new',
      receivedAt: new Date(0).toISOString(),
    };
  }
}
