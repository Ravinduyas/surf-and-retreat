// ─────────────────────────────────────────────────────────────
// Mock OTA adapter — a fully working connector used for local demos
// and tests. Simulates an OTA that accepts ARI and occasionally throws
// a retryable transient error, and can mint an inbound booking.
//
// Real adapters (bookingcom.ts, expedia.ts, ...) implement the SAME
// interface; only the transport + payload mapping differ.
// ─────────────────────────────────────────────────────────────
import type { Connector, PushResult, RawBooking } from '../connector.ts';
import type {
  ChannelCode, Protocol, ConnectorCapabilities, AriUpdate,
  Reservation, CertificationState, ConnectorHealth,
} from '../types.ts';

let seq = 0;
// Deterministic pseudo-random so demo output is stable (no Math.random).
function flaky(n: number): boolean {
  seq += 1;
  return (seq * 2654435761) % n === 0;
}

export class MockConnector implements Connector {
  readonly channel: ChannelCode;
  readonly name: string;
  readonly protocol: Protocol = 'rest-json';
  readonly capabilities: ConnectorCapabilities = {
    ariPush: true, restrictions: true, reservationsPull: true,
    reservationsPush: true, content: true, promotions: true,
    bedLevel: false, derivedRates: true,
  };
  certification: CertificationState = 'certified';
  health: ConnectorHealth = 'connected';

  constructor(channel: ChannelCode, name: string) {
    this.channel = channel;
    this.name = name;
  }

  async pushAri(update: AriUpdate): Promise<PushResult> {
    const cells = update.cells.length;
    // Simulate a transient 503 roughly 1-in-7 pushes to exercise retry.
    if (flaky(7)) {
      return { ok: false, channel: this.channel, accepted: 0, rejected: cells,
        detail: 'HTTP 503 (transient)', retryable: true };
    }
    return { ok: true, channel: this.channel, accepted: cells, rejected: 0 };
  }

  async testConnection(): Promise<{ ok: boolean; latencyMs: number; detail?: string }> {
    return { ok: true, latencyMs: 40 + (seq % 20) };
  }

  normalizeBooking(raw: RawBooking): Reservation {
    const b = raw.raw as Record<string, unknown>;
    return {
      id: `res-${this.channel}-${(b.ref as string) ?? seq}`,
      channel: this.channel,
      otaReference: (b.ref as string) ?? 'MOCK-0',
      guest: (b.guest as string) ?? 'Guest',
      roomType: b.roomType as string,
      ratePlan: (b.ratePlan as string) ?? 'BAR',
      arrival: b.arrival as string,
      departure: b.departure as string,
      beds: b.beds as number | undefined,
      amount: (b.amount as number) ?? 0,
      commission: Math.round(((b.amount as number) ?? 0) * 0.15),
      status: 'new',
      receivedAt: new Date(0).toISOString(), // stamped by caller in real use
    };
  }
}
