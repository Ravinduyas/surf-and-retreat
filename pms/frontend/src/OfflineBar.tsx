// The offline status bar.
//
// Whether the desk is online is not a technical detail here — it changes what
// the person in front of the screen is allowed to do. So it is stated plainly
// and permanently rather than as a toast that disappears: what is cached, how
// old it is, what is waiting to sync, and what failed and needs a human.
//
// The one thing this must never do is imply that queued work has landed.
import { useEffect, useState, useCallback } from 'react';
import {
  WifiOff, CloudUpload, TriangleAlert, RefreshCw, Check, X,
} from 'lucide-react';
import {
  onOfflineChange, offlineState, removeQueued, type QueuedWrite,
} from './offline';
import { flushOfflineQueue } from './api';

export function useOfflineState() {
  const [state, setState] = useState(offlineState);
  useEffect(() => onOfflineChange(() => setState(offlineState())), []);

  // The browser's own signal is a useful hint for coming *back*, even though it
  // is unreliable for going offline — a hostel router that answers DHCP but
  // routes nowhere still reports `online`.
  useEffect(() => {
    const onBack = () => { void flushOfflineQueue().then(() => setState(offlineState())); };
    window.addEventListener('online', onBack);
    return () => window.removeEventListener('online', onBack);
  }, []);

  return state;
}

export function OfflineBar() {
  const state = useOfflineState();
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const sync = useCallback(async () => {
    setSyncing(true);
    try { await flushOfflineQueue(); } finally { setSyncing(false); }
  }, []);

  // Nothing to say: no bar. A permanent "you are online" strip is noise that
  // trains people to stop reading the thing that matters.
  if (!state.offline && !state.pending && !state.failed) return null;

  const tone = state.failed ? 'bg-status-bad' : state.offline ? 'bg-dash-text' : 'bg-status-warn';

  return (
    <div className={`${tone} text-white`}>
      <div className="px-4 py-2 flex items-center gap-3 flex-wrap text-[12px]">
        {state.offline ? (
          <>
            <WifiOff className="w-4 h-4 shrink-0" />
            <span className="font-bold">Working offline</span>
            <span className="text-white/70">
              You can look things up, but bookings, payments and check-ins need the server.
            </span>
          </>
        ) : state.failed ? (
          <>
            <TriangleAlert className="w-4 h-4 shrink-0" />
            <span className="font-bold">
              {state.failed} change{state.failed === 1 ? '' : 's'} could not be saved
            </span>
            <span className="text-white/70">They need you to look at them.</span>
          </>
        ) : (
          <>
            <CloudUpload className="w-4 h-4 shrink-0" />
            <span className="font-bold">
              {state.pending} change{state.pending === 1 ? '' : 's'} waiting to sync
            </span>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {(state.pending > 0 || state.failed > 0) && (
            <button onClick={() => setExpanded(!expanded)}
              className="text-[11px] font-bold underline underline-offset-2">
              {expanded ? 'Hide' : `Show ${state.pending + state.failed}`}
            </button>
          )}
          {!state.offline && state.pending > 0 && (
            <button onClick={sync} disabled={syncing}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white/15 rounded-full px-3 py-1">
              <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 space-y-1.5">
          {state.queue.map((q) => <QueuedRow key={q.id} item={q} />)}
        </div>
      )}
    </div>
  );
}

function QueuedRow({ item }: { item: QueuedWrite }) {
  return (
    <div className="bg-white/10 rounded-xl px-3 py-2 flex items-start gap-2 text-[11px]">
      {item.error
        ? <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-px" />
        : <Check className="w-3.5 h-3.5 shrink-0 mt-px opacity-60" />}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{item.description}</p>
        {item.error
          ? <p className="text-white/80 mt-0.5">{item.error}</p>
          : (
            <p className="text-white/60 mt-0.5">
              Saved on this device {relative(item.queuedAt)} · not yet on the server
            </p>
          )}
      </div>
      {item.error && (
        // Only a failed item can be dismissed. Discarding something still
        // waiting would throw away work the person believes is safe.
        <button onClick={() => removeQueued(item.id)}
          title="Discard this change"
          className="shrink-0 opacity-70 hover:opacity-100">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function relative(at: number): string {
  const mins = Math.round((Date.now() - at) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)}h ago`;
}

/**
 * "Showing data from 14 minutes ago."
 *
 * Placed by a screen next to numbers that came from cache. Occupancy or a folio
 * balance shown as current when it is an hour old is worse than not showing it:
 * somebody will make a decision on it.
 */
export function StaleNote({ ageSeconds }: { ageSeconds: number }) {
  if (ageSeconds < 30) return null;
  const mins = Math.round(ageSeconds / 60);
  return (
    <p className="text-[10px] text-status-warn font-semibold flex items-center gap-1">
      <WifiOff className="w-3 h-3" />
      Showing data from {mins < 1 ? 'less than a minute' : mins < 60 ? `${mins} minutes` : `${Math.round(mins / 60)} hours`} ago
    </p>
  );
}
