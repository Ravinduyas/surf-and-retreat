// ─────────────────────────────────────────────────────────────
// Connector (adapter) contract.
//
// This is the seam that replaces "everything goes through Beds24".
// Each OTA gets its own adapter implementing this interface. The push
// engine talks ONLY to this contract, so adding/removing a direct OTA
// connection — or swapping in a white-label fallback like Channex for
// the long tail — never touches the engine.
// ─────────────────────────────────────────────────────────────
import type {
  ChannelCode, Protocol, CertificationState, ConnectorHealth,
  ConnectorCapabilities, AriUpdate, Reservation,
} from './types.ts';

export interface PushResult {
  ok: boolean;
  channel: ChannelCode;
  accepted: number;      // cells accepted
  rejected: number;
  detail?: string;
  retryable: boolean;    // engine should retry on failure
}

// Raw inbound payload an OTA delivers (webhook or poll). The adapter is
// responsible for turning its OTA-specific shape into a normalized
// Reservation the PMS understands.
export interface RawBooking {
  raw: unknown;
}

export interface Connector {
  readonly channel: ChannelCode;
  readonly name: string;
  readonly protocol: Protocol;
  readonly capabilities: ConnectorCapabilities;

  // live state
  certification: CertificationState;
  health: ConnectorHealth;

  // ── outbound ────────────────────────────────────────────────
  // Push availability / rates / inventory / restrictions to the OTA.
  // Only cells whose rate plan is distributed to this channel are sent.
  pushAri(update: AriUpdate): Promise<PushResult>;

  // Verify credentials / endpoint reachability.
  testConnection(): Promise<{ ok: boolean; latencyMs: number; detail?: string }>;

  // ── inbound ─────────────────────────────────────────────────
  // Normalize an OTA booking notification into a PMS Reservation.
  normalizeBooking(raw: RawBooking): Reservation;
}

// A connector may only push live ARI once it is certified. The engine
// enforces this so an in-progress integration can't corrupt live channels.
export function canPushLive(c: Connector): boolean {
  return c.certification === 'certified' && c.health !== 'disabled';
}
