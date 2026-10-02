// ─────────────────────────────────────────────────────────────
// ARI push engine — fans one master change out to every DIRECT channel.
//
// Replaces "PMS → Beds24 → all OTAs" with "PMS → [engine] → each OTA
// adapter directly". Handles: certified-only gating, per-channel retry
// with exponential backoff, and a structured sync log. The engine never
// knows any OTA's protocol — it only speaks the Connector contract.
// ─────────────────────────────────────────────────────────────
import type { Connector } from './connector.ts';
import { canPushLive } from './connector.ts';
import type { AriUpdate, ChannelCode, SyncLogEntry } from './types.ts';
import type { SourceOfTruth } from './sourceOfTruth.ts';

const MAX_ATTEMPTS = 3;
let logSeq = 0;

export class ConnectorRegistry {
  private connectors = new Map<ChannelCode, Connector>();

  register(c: Connector): void {
    this.connectors.set(c.channel, c);
  }

  get(code: ChannelCode): Connector | undefined {
    return this.connectors.get(code);
  }

  all(): Connector[] {
    return [...this.connectors.values()];
  }

  live(): Connector[] {
    return this.all().filter(canPushLive);
  }
}

export class PushEngine {
  readonly log: SyncLogEntry[] = [];
  private now: () => string;
  private registry: ConnectorRegistry;
  private sot: SourceOfTruth;

  constructor(registry: ConnectorRegistry, sot: SourceOfTruth, now?: () => string) {
    this.registry = registry;
    this.sot = sot;
    // Injectable clock keeps demo output deterministic.
    this.now = now ?? (() => new Date().toISOString());
  }

  private record(e: Omit<SyncLogEntry, 'id' | 'ts'>): void {
    logSeq += 1;
    this.log.push({ id: `log-${logSeq}`, ts: this.now(), ...e });
  }

  // Push the current source-of-truth ARI for the given channels. Each
  // channel gets only the cells whose rate plans are distributed to it.
  async publish(channels: ChannelCode[], reason: string): Promise<void> {
    for (const code of channels) {
      const connector = this.registry.get(code);
      if (!connector) continue;
      if (!canPushLive(connector)) {
        this.record({ direction: 'push', channel: code, action: reason,
          status: 'failed', attempt: 0,
          detail: `skipped — ${connector.certification}` });
        continue;
      }
      const cells = this.sot.cellsForChannel(code);
      await this.dispatch(connector, { cells, channels: [code], reason });
    }
  }

  // Dispatch one update to one connector, retrying transient failures.
  private async dispatch(connector: Connector, update: AriUpdate): Promise<void> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const res = await connector.pushAri(update);
      if (res.ok) {
        this.record({ direction: 'push', channel: connector.channel, action: update.reason,
          status: 'success', attempt, detail: `${res.accepted} cells` });
        return;
      }
      const last = attempt === MAX_ATTEMPTS || !res.retryable;
      this.record({ direction: 'push', channel: connector.channel, action: update.reason,
        status: last ? 'failed' : 'retrying', attempt, detail: res.detail });
      if (last) {
        connector.health = res.retryable ? 'degraded' : 'error';
        return;
      }
      await backoff(attempt);
    }
  }
}

function backoff(attempt: number): Promise<void> {
  // 50ms, 100ms, 200ms ... (kept short for demo)
  return new Promise((r) => setTimeout(r, 25 * 2 ** attempt));
}
