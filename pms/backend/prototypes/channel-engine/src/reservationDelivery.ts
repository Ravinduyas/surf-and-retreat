// ─────────────────────────────────────────────────────────────
// Reservation delivery — the inbound half + the overbooking guard.
//
// When ANY OTA delivers a booking, we: (1) let that OTA's adapter
// normalize it, (2) decrement the shared pooled inventory in the
// source of truth, (3) re-push the affected ARI to EVERY OTHER live
// channel so the just-sold room disappears everywhere. This closing
// loop is what prevents overbooking across direct connections.
// ─────────────────────────────────────────────────────────────
import type { RawBooking } from './connector.ts';
import type { ChannelCode, Reservation } from './types.ts';
import type { SourceOfTruth } from './sourceOfTruth.ts';
import type { ConnectorRegistry, PushEngine } from './pushEngine.ts';

export class ReservationDelivery {
  readonly received: Reservation[] = [];
  private registry: ConnectorRegistry;
  private sot: SourceOfTruth;
  private engine: PushEngine;
  private now?: () => string;

  constructor(registry: ConnectorRegistry, sot: SourceOfTruth, engine: PushEngine, now?: () => string) {
    this.registry = registry;
    this.sot = sot;
    this.engine = engine;
    this.now = now;
  }

  // Handle an inbound booking notification from `channel`.
  async handle(channel: ChannelCode, raw: RawBooking): Promise<Reservation | null> {
    const connector = this.registry.get(channel);
    if (!connector) return null;

    const res = connector.normalizeBooking(raw);
    res.receivedAt = (this.now ?? (() => new Date().toISOString()))();
    this.received.push(res);

    // Bed-level (dorm) books N beds; room-level books 1 unit.
    const units = res.beds ?? 1;
    this.sot.decrement(res.roomType, res.arrival, res.departure, units);

    // Re-push the affected room type to all OTHER live channels.
    const others = this.registry.live()
      .map((c) => c.channel)
      .filter((c) => c !== channel);
    await this.engine.publish(others, `booking.decrement ${res.otaReference}`);

    return res;
  }
}
