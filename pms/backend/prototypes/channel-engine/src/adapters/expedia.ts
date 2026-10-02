// ─────────────────────────────────────────────────────────────
// Expedia Group DIRECT connector — EG Connectivity (formerly EQC).
//
// IMPORTANT: this is the SUPPLY side (push a hotel's ARI INTO Expedia,
// Hotels.com, Vrbo). It is NOT the Rapid API (that pulls Expedia's
// inventory OUT to resell — the opposite direction, wrong tool here).
//
// Protocol: OTA XML for ARI (Availability & Rates API, up to ~5,000
// updates/message) + GraphQL for reservation lifecycle / promotions.
// Gating: AOC (Attestation of Compliance) on file + PCI + certification.
// ─────────────────────────────────────────────────────────────
import type { Connector, PushResult, RawBooking } from '../connector.ts';
import type {
  ChannelCode, Protocol, ConnectorCapabilities, AriUpdate,
  Reservation, CertificationState, ConnectorHealth,
} from '../types.ts';

export class ExpediaConnector implements Connector {
  readonly channel: ChannelCode = 'EXP';
  readonly name = 'Expedia Group';
  readonly protocol: Protocol = 'ota-xml';
  readonly capabilities: ConnectorCapabilities = {
    ariPush: true, restrictions: true, reservationsPull: true,
    reservationsPush: true, content: true, promotions: true,
    bedLevel: false, derivedRates: true,
  };
  certification: CertificationState = 'not-started';
  health: ConnectorHealth = 'disabled';

  eqcKey?: string;

  async pushAri(update: AriUpdate): Promise<PushResult> {
    if (this.certification !== 'certified' || !this.eqcKey) {
      return { ok: false, channel: this.channel, accepted: 0, rejected: update.cells.length,
        detail: 'Expedia EG Connectivity not certified (needs AOC + PCI + cert)', retryable: false };
    }
    // TODO(cert): batch cells into an AR message (<=5000) → EG Connectivity ARI endpoint.
    throw new Error('Expedia transport not enabled (awaiting certification)');
  }

  async testConnection() {
    return { ok: false, latencyMs: 0, detail: 'Not certified' };
  }

  // Expedia delivers via Booking Retrieval / Booking Notification APIs.
  normalizeBooking(raw: RawBooking): Reservation {
    const r = raw.raw as Record<string, string | number>;
    return {
      id: `res-EXP-${r.EanRoomID ?? r.itineraryId}`,
      channel: 'EXP',
      otaReference: String(r.itineraryId),
      guest: String(r.guestName ?? 'Guest'),
      roomType: String(r.roomTypeCode),
      ratePlan: String(r.ratePlanCode ?? 'BAR'),
      arrival: String(r.arrivalDate),
      departure: String(r.departureDate),
      amount: Number(r.total ?? 0),
      commission: Number(r.commission ?? 0),
      status: 'new',
      receivedAt: new Date(0).toISOString(),
    };
  }
}
