// ─────────────────────────────────────────────────────────────
// "Your price changes are not going anywhere."
//
// This exists because of a real morning's confusion. Three dorm rates were
// changed in Rates & Inventory. The grid showed the new prices, the header said
// CHANNELS · 1 live, the status bar said Channels: Connected, and the channel
// health endpoint reported `healthy` — because nothing had *failed*. Nothing had
// been attempted either: the server was running with HELIO_CHANNEL_READONLY set,
// so the three pushes were queued and left there, and the OTA went on selling
// beds at the old rate for hours.
//
// Every indicator in the app was technically true and collectively a lie. The
// missing one is this: the property is not publishing, and here is what is
// waiting because of it.
//
// It is deliberately loud and deliberately specific — the count, the age of the
// oldest change, and the single line that fixes it. A banner that said "channel
// sync disabled" would have been just as invisible as the green tick.
// ─────────────────────────────────────────────────────────────
import { AlertTriangle } from 'lucide-react';
import { useChannelHealth } from './queries';
import { relativeTime } from './format';
import { CHANNEL_HUB } from './branding';

export function ChannelPublishNote({ className = '' }: { className?: string }) {
  const health = useChannelHealth();
  const rows = health.data ?? [];

  // Only speaks when there is something to say: a connected property that is
  // not publishing. A property with no channel at all is not affected by this
  // and does not need telling.
  const affected = rows.filter((c) => c.publishing === false && c.health !== 'not-configured');
  if (affected.length === 0) return null;

  const queued = affected.reduce((n, c) => n + (c.queued ?? 0), 0);
  const oldest = affected
    .map((c) => c.oldestQueuedAt)
    .filter((t): t is string => !!t)
    .sort()[0];

  return (
    <div
      role="status"
      className={`rounded-2xl bg-dash-peach/60 border border-status-warn/30 p-3.5
                  flex items-start gap-3 ${className}`}
    >
      <AlertTriangle className="w-4 h-4 text-status-warn mt-0.5 shrink-0" />
      <div className="min-w-0 text-[12px] leading-relaxed">
        <p className="font-bold">
          {queued > 0
            ? `${queued} change${queued === 1 ? '' : 's'} ${queued === 1 ? 'is' : 'are'} waiting and will not be sent`
            : `Rates and availability are not being sent to ${CHANNEL_HUB}`}
        </p>
        <p className="text-dash-muted mt-0.5">
          This property is in <span className="font-semibold">read-only</span> mode:
          bookings still come in, but nothing goes out. Prices you change here will
          not reach the OTAs
          {oldest ? <> — the oldest change has been waiting {relativeTime(oldest)}</> : null}.
        </p>
        <p className="text-dash-muted mt-1.5">
          To publish again, remove <span className="font-mono text-[11px]">HELIO_CHANNEL_READONLY</span>{' '}
          from the API's <span className="font-mono text-[11px]">.env</span> and restart it. Everything
          queued goes out on the next drain, so nothing you have changed is lost.
        </p>
      </div>
    </div>
  );
}
