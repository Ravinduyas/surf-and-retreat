// ─────────────────────────────────────────────────────────────
// Booking.com DIRECT connector (Connectivity Partner Programme).
//
// Protocol: OTA 2003B XML + Booking's B.XML extension (migrating to JSON).
// Hosts:  supply-xml.booking.com (ARI)  /  secure-supply-xml.booking.com (reservations, PCI)
// APIs:   Content · Rates & Availability (ARI) · Reservations · Promotions · Opportunities
//
// This is a REAL-SHAPED stub: the transport is wired to the right
// endpoints and the ARI→OTA_HotelAvailNotif/OTA_HotelRateAmountNotif
// mapping is sketched. It is INERT until you (a) sign the Connectivity
// Partner contract, (b) get a machine account + credentials, and
// (c) pass certification. Those TODO(cert) points are marked.
// ─────────────────────────────────────────────────────────────
import type { Connector, PushResult, RawBooking } from '../connector.ts';
import type {
  ChannelCode, Protocol, ConnectorCapabilities, AriUpdate,
  Reservation, AriCell, CertificationState, ConnectorHealth,
} from '../types.ts';

const ARI_HOST = 'https://supply-xml.booking.com/hotels/xml/availability';

export class BookingComConnector implements Connector {
  readonly channel: ChannelCode = 'BDC';
  readonly name = 'Booking.com';
  readonly protocol: Protocol = 'ota-xml';
  readonly capabilities: ConnectorCapabilities = {
    ariPush: true, restrictions: true, reservationsPull: true,
    reservationsPush: true, content: true, promotions: true,
    bedLevel: false, derivedRates: true,
  };
  // Starts uncertified — this is exactly the state "go direct" flips.
  certification: CertificationState = 'not-started';
  health: ConnectorHealth = 'disabled';

  // machine-account credentials, injected once the partner contract exists
  creds?: { username: string; password: string; hotelId: string };

  constructor(creds?: { username: string; password: string; hotelId: string }) {
    this.creds = creds;
  }

  async pushAri(update: AriUpdate): Promise<PushResult> {
    if (this.certification !== 'certified' || !this.creds) {
      return { ok: false, channel: this.channel, accepted: 0, rejected: update.cells.length,
        detail: 'Booking.com connection not certified — see certification checklist', retryable: false };
    }
    const xml = toBookingAvailXml(this.creds.hotelId, update.cells);
    // TODO(cert): POST xml to ARI_HOST with Basic auth over TLS 1.2,
    // parse OTA_HotelAvailNotifRS for <Success/> vs <Errors>.
    void xml; void ARI_HOST;
    throw new Error('Booking.com transport not enabled (awaiting certification)');
  }

  async testConnection() {
    return { ok: false, latencyMs: 0, detail: 'Not certified' };
  }

  // Booking.com pushes reservations as OTA_HotelResNotifRQ. Map the fields
  // we rely on into our normalized Reservation.
  normalizeBooking(raw: RawBooking): Reservation {
    const r = raw.raw as Record<string, string | number>;
    return {
      id: `res-BDC-${r.reservation_id}`,
      channel: 'BDC',
      otaReference: String(r.reservation_id),
      guest: String(r.guest_name ?? 'Guest'),
      roomType: String(r.room_type),
      ratePlan: String(r.rate_plan ?? 'BAR'),
      arrival: String(r.checkin),
      departure: String(r.checkout),
      amount: Number(r.total_price ?? 0),
      commission: Number(r.commission_amount ?? 0),
      status: 'new',
      receivedAt: new Date(0).toISOString(),
    };
  }
}

// Minimal OTA_HotelAvailNotifRQ builder (illustrative — the real message
// also carries rates via OTA_HotelRateAmountNotifRQ and restrictions).
function toBookingAvailXml(hotelId: string, cells: AriCell[]): string {
  const items = cells.map((c) =>
    `<AvailStatusMessage><StatusApplicationControl Start="${c.date}" End="${c.date}" ` +
    `InvTypeCode="${c.roomType}" RatePlanCode="${c.ratePlan}"/>` +
    `<LengthsOfStay><LengthOfStay Time="${c.minStay ?? 1}" MinMaxMessageType="SetMinLOS"/></LengthsOfStay>` +
    `<RestrictionStatus Status="${c.stopSell ? 'Close' : 'Open'}" ` +
    `BookingLimit="${c.available}"/></AvailStatusMessage>`
  ).join('');
  return `<?xml version="1.0"?><OTA_HotelAvailNotifRQ><AvailStatusMessages HotelCode="${hotelId}">` +
    `${items}</AvailStatusMessages></OTA_HotelAvailNotifRQ>`;
}
