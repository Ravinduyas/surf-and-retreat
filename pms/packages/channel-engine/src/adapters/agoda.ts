// ─────────────────────────────────────────────────────────────
// Agoda DIRECT connector — YCS (Yield Control System), YCS 5 API.
//
// Protocol: OTA XML for ARI/reservations (OTA_HotelRateAmountNotif,
// OTA_HotelResRQ/RS, OTA_CancelRQ/RS) + REST/JSON for Content Push
// and Promotions. Onboarding via Agoda's Onboarding API, then cert.
// Strong in Asia-Pacific — relevant for Sri Lanka / regional demand.
// ─────────────────────────────────────────────────────────────
import type { Connector, PushResult, RawBooking } from '../connector.ts';
import type {
  ChannelCode, Protocol, ConnectorCapabilities, AriUpdate,
  Reservation, CertificationState, ConnectorHealth,
} from '../types.ts';

export class AgodaConnector implements Connector {
  readonly channel: ChannelCode = 'AGD';
  readonly name = 'Agoda';
  readonly protocol: Protocol = 'ota-xml';
  readonly capabilities: ConnectorCapabilities = {
    ariPush: true, restrictions: true, reservationsPull: true,
    reservationsPush: true, content: true, promotions: true,
    bedLevel: false, derivedRates: false,
  };
  certification: CertificationState = 'not-started';
  health: ConnectorHealth = 'disabled';

  async pushAri(update: AriUpdate): Promise<PushResult> {
    if (this.certification !== 'certified') {
      return { ok: false, channel: this.channel, accepted: 0, rejected: update.cells.length,
        detail: 'Agoda YCS not certified', retryable: false };
    }
    // TODO(cert): OTA_HotelRateAmountNotifRQ per room/rate/date range.
    throw new Error('Agoda transport not enabled (awaiting certification)');
  }

  async testConnection() {
    return { ok: false, latencyMs: 0, detail: 'Not certified' };
  }

  normalizeBooking(raw: RawBooking): Reservation {
    const r = raw.raw as Record<string, string | number>;
    return {
      id: `res-AGD-${r.ReservationID}`,
      channel: 'AGD',
      otaReference: String(r.ReservationID),
      guest: String(r.CustomerName ?? 'Guest'),
      roomType: String(r.RoomTypeID),
      ratePlan: String(r.RatePlanID ?? 'BAR'),
      arrival: String(r.CheckIn),
      departure: String(r.CheckOut),
      amount: Number(r.Amount ?? 0),
      commission: Number(r.Commission ?? 0),
      status: 'new',
      receivedAt: new Date(0).toISOString(),
    };
  }
}
