// Closing and reopening dates for sale.
//
// Two pieces live here: the action bar that appears when dates are selected on
// the rate calendar, and the close-out list that shows what is currently shut.
// The calendar itself stays in RatesInventory — this file owns the verbs.
import { useState } from 'react';
import { Lock, LockOpen, CalendarX, Trash2, CircleAlert } from 'lucide-react';
import {
  useCloseouts, useCloseDates, useOpenDates, useReopenCloseout, usePurgeExpiredCloseouts,
  useChannels, type Closeout,
} from '../queries';
import { Card, Pill, Button, Modal, Select, TextInput } from '../ui';
import { QueryState, useToast, PermissionButton, ConfirmDialog, WarnNote, InfoNote } from '../components';
import { shortDate } from '../format';

// ─── The selection made on the rate calendar ─────────────────

export interface DateSelection {
  roomTypeId: string | null;
  ratePlanId: string | null;
  roomTypeName: string;
  ratePlanCode: string;
  from: string;
  to: string;
  /** True when every selected night is already closed — offer Open, not Close. */
  allClosed: boolean;
  anyClosed: boolean;
}

/**
 * The bar that slides up when dates are selected.
 *
 * It defaults to whichever action makes sense for what is selected: a run of
 * closed nights offers Open, anything else offers Close. Both are still
 * available — the default is a shortcut, not a restriction.
 */
export function CloseoutBar({
  selection, onDone, onCancel,
}: {
  selection: DateSelection;
  onDone: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const close = useCloseDates();
  const open = useOpenDates();
  const channels = useChannels();
  const [reason, setReason] = useState('');
  const [channelCode, setChannelCode] = useState('');
  const [blocked, setBlocked] = useState<Array<{ from: string; to: string; reason: string | null }>>([]);

  const nights = Math.round(
    (Date.parse(`${selection.to}T00:00:00Z`) - Date.parse(`${selection.from}T00:00:00Z`)) / 86_400_000,
  ) + 1;

  const scope = {
    roomTypeId: selection.roomTypeId,
    ratePlanId: selection.ratePlanId,
    channelCode: channelCode || null,
    from: selection.from,
    to: selection.to,
  };

  async function doClose() {
    try {
      const r: any = await close.mutateAsync({ ...scope, reason: reason || undefined });
      toast.success(
        r.extended ? 'Existing closure extended' : 'Dates closed',
        `${shortDate(r.from)} → ${shortDate(r.to)} is off sale${channelCode ? ` on ${channelCode}` : ''}`,
      );
      onDone();
    } catch (e) { toast.fail(e, 'Could not close those dates'); }
  }

  async function doOpen() {
    try {
      const r: any = await open.mutateAsync(scope);
      if (r.stillClosedBy?.length) {
        // Do not claim success for dates that are demonstrably still shut.
        setBlocked(r.stillClosedBy);
        return;
      }
      toast.success('Dates reopened',
        r.split ? 'The closure was split around the reopened nights' : `${nights} night(s) back on sale`);
      onDone();
    } catch (e) { toast.fail(e, 'Could not reopen those dates'); }
  }

  const busy = close.isPending || open.isPending;

  return (
    <>
      <div className="sticky bottom-3 z-20 mt-3">
        <Card className="shadow-lg border border-black/10">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 shrink-0">
              <CalendarX className="w-4 h-4 text-dash-muted" />
              <div>
                <p className="text-[12px] font-bold leading-tight">
                  {shortDate(selection.from)}
                  {selection.from !== selection.to && <> → {shortDate(selection.to)}</>}
                  <span className="text-dash-muted font-semibold"> · {nights} night{nights === 1 ? '' : 's'}</span>
                </p>
                <p className="text-[10px] text-dash-muted">
                  {selection.roomTypeName} · {selection.ratePlanCode}
                  {selection.anyClosed && !selection.allClosed && ' · partly closed already'}
                </p>
              </div>
            </div>

            <div className="w-full sm:w-[170px]">
              <Select value={channelCode} onChange={setChannelCode} options={[
                { label: 'All channels', value: '' },
                ...(channels.data ?? [])
                  .filter((c: any) => c.code)
                  .map((c: any) => ({ label: `${c.name} only`, value: c.code })),
              ]} />
            </div>

            <div className="flex-1 min-w-[160px]">
              <TextInput value={reason} onChange={setReason} placeholder="Reason (optional)" />
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Button variant="ghost" onClick={onCancel}>Cancel</Button>
              {selection.anyClosed && (
                <PermissionButton permission="rates.write" variant="secondary" disabled={busy}
                  icon={<LockOpen className="w-3.5 h-3.5" />} onClick={doOpen}>
                  {open.isPending ? 'Opening…' : 'Open'}
                </PermissionButton>
              )}
              {!selection.allClosed && (
                <PermissionButton permission="rates.write" disabled={busy}
                  icon={<Lock className="w-3.5 h-3.5" />} onClick={doClose}>
                  {close.isPending ? 'Closing…' : 'Close'}
                </PermissionButton>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Modal open={blocked.length > 0} onClose={() => setBlocked([])} title="Those dates are held by a wider closure"
        footer={<div className="flex justify-end"><Button onClick={() => setBlocked([])}>Close</Button></div>}>
        <div className="space-y-3">
          <InfoNote>
            Nothing was changed. The selected dates are closed by a closure that covers more than
            what you selected — reopening only part of it would mean splitting it across every room
            type it applies to. Reopen the closure itself from the Close-outs tab, or narrow it first.
          </InfoNote>
          {blocked.map((b, i) => (
            <div key={i} className="text-[12px] border-b subtle-divider pb-2">
              <p className="font-bold">{shortDate(b.from)} → {shortDate(b.to)}</p>
              <p className="text-dash-muted">{b.reason ?? 'No reason recorded'}</p>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}

// ─── The close-out list ──────────────────────────────────────

export function CloseoutsTab() {
  const toast = useToast();
  const [includeExpired, setIncludeExpired] = useState(false);
  const closeouts = useCloseouts(includeExpired);
  const reopen = useReopenCloseout();
  const purge = usePurgeExpiredCloseouts();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmPurge, setConfirmPurge] = useState(false);

  return (
    <QueryState query={closeouts} loadingRows={4}>
      {(data) => (
        <div className="space-y-3">
          {data.failedPushes > 0 && (
            <WarnNote>
              {data.failedPushes} channel update(s) have failed. Until they succeed, the OTAs may
              still be selling dates that are closed here. Check the channel manager's sync log.
            </WarnNote>
          )}
          {data.failedPushes === 0 && data.pendingPushes > 0 && (
            <InfoNote>
              {data.pendingPushes} channel update(s) are queued and will be sent within a minute.
              Closures apply immediately to direct bookings either way.
            </InfoNote>
          )}

          <Card>
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                  Closed dates
                </p>
                <p className="text-[11px] text-dash-muted mt-0.5">
                  Everything currently off sale. Select dates on the rate calendar to close more.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {data.expiredCount > 0 && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setIncludeExpired(!includeExpired)}>
                      {includeExpired ? 'Hide' : 'Show'} {data.expiredCount} expired
                    </Button>
                    <PermissionButton permission="rates.write" variant="ghost" size="sm"
                      icon={<Trash2 className="w-3 h-3" />} onClick={() => setConfirmPurge(true)}>
                      Clear expired
                    </PermissionButton>
                  </>
                )}
              </div>
            </div>

            {data.closeouts.length === 0 ? (
              <div className="py-10 text-center">
                <LockOpen className="w-6 h-6 text-dash-muted mx-auto mb-2" />
                <p className="text-[13px] font-bold">Everything is open for sale</p>
                <p className="text-[11px] text-dash-muted mt-1">
                  No dates are closed. Select a range on the rate calendar to close one.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full min-w-[46rem] text-[12px]">
                  <thead>
                    <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                      <th className="pb-2">Dates</th>
                      <th className="pb-2">Nights</th>
                      <th className="pb-2">Applies to</th>
                      <th className="pb-2">Reason</th>
                      <th className="pb-2">Closed by</th>
                      <th className="pb-2">State</th>
                      <th className="pb-2 text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.closeouts.map((c: Closeout) => (
                      <tr key={c.id} className={`border-b border-black/[0.03] ${c.expired ? 'opacity-50' : ''}`}>
                        <td className="py-2.5 whitespace-nowrap font-semibold">
                          {shortDate(c.from)}
                          {c.from !== c.to && <> → {shortDate(c.to)}</>}
                        </td>
                        <td className="py-2.5 tabular-nums text-dash-muted">{c.nights}</td>
                        <td className="py-2.5">{c.scope}</td>
                        <td className="py-2.5 text-dash-muted">{c.reason ?? '—'}</td>
                        <td className="py-2.5 text-dash-muted">{c.createdBy ?? '—'}</td>
                        <td className="py-2.5">
                          {c.expired ? <Pill tone="grey">expired</Pill>
                            : c.active ? <Pill tone="red">closed now</Pill>
                              : <Pill tone="yellow">upcoming</Pill>}
                        </td>
                        <td className="py-2.5 text-right whitespace-nowrap">
                          {!c.expired && (
                            <PermissionButton permission="rates.write" size="sm" variant="ghost"
                              icon={<LockOpen className="w-3 h-3" />}
                              disabled={reopen.isPending}
                              onClick={() => setConfirmId(c.id)}>
                              Reopen
                            </PermissionButton>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-start gap-2">
              <CircleAlert className="w-4 h-4 text-dash-muted shrink-0 mt-0.5" />
              <p className="text-[11px] text-dash-muted leading-relaxed">
                A closure stops new bookings for those nights — it does not cancel bookings already
                taken. Closing is pushed to every connected channel automatically; direct bookings
                are blocked the moment you save. Closing a single channel leaves the others, and the
                front desk, still selling.
              </p>
            </div>
          </Card>

          <ConfirmDialog
            open={!!confirmId}
            title="Reopen these dates?"
            body="The nights go back on sale immediately, here and on every connected channel."
            confirmLabel="Reopen"
            busy={reopen.isPending}
            onCancel={() => setConfirmId(null)}
            onConfirm={async () => {
              if (!confirmId) return;
              try {
                const r: any = await reopen.mutateAsync({ id: confirmId });
                if (r.stillClosedBy?.length) {
                  toast.push({
                    kind: 'error', title: 'Still closed',
                    body: 'Another, wider closure also covers these dates.',
                  });
                } else {
                  toast.success('Dates reopened');
                }
              } catch (e) { toast.fail(e); }
              setConfirmId(null);
            }}
          />

          <ConfirmDialog
            open={confirmPurge}
            title="Clear expired closures?"
            body="Closures whose last night has already passed are deleted. Nothing currently or
                  future-dated is touched, and no availability changes."
            confirmLabel="Clear"
            busy={purge.isPending}
            onCancel={() => setConfirmPurge(false)}
            onConfirm={async () => {
              try {
                const r: any = await purge.mutateAsync();
                toast.success(`${r.removed} expired closure(s) cleared`);
              } catch (e) { toast.fail(e); }
              setConfirmPurge(false);
            }}
          />
        </div>
      )}
    </QueryState>
  );
}

/** Tab-header count, taken from the same query the list renders. */
export function useCloseoutCount(): number | undefined {
  return useCloseouts(false).data?.closeouts.length;
}
