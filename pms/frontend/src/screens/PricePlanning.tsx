// Price planning: the preview that goes in front of every bulk edit, plus
// seasons, scheduled changes, copying a period and the history of a rate cell.
//
// The preview panel is the important piece. It is fed by the same endpoint the
// apply call runs, so what it shows is what will happen — not an estimate made
// on the client from a different set of assumptions.
import { useState } from 'react';
import {
  TrendingUp, TrendingDown, TriangleAlert, CalendarRange, Clock, History,
  Copy, Trash2, Plus, Play, Ban,
} from 'lucide-react';
import {
  useRatePreview, useCopyPreview, useCopyRates, useSeasons, useUpsertSeason, useDeleteSeason,
  useScheduledRateChanges, useScheduleRateChange, useCancelScheduledRateChange,
  useRunDueRateChanges, useRateHistory, useRoomTypes, useRatePlans,
  type ChangePlan, type Season, type ScheduledRateChange,
} from '../queries';
import { Card, Pill, Button, Modal, Field, Select, TextInput, Tabs } from '../ui';
import {
  QueryState, useToast, PermissionButton, ConfirmDialog, WarnNote, InfoNote,
  NumberInput, DateInput, Loading,
} from '../components';
import { money, shortDate, timestamp, relativeTime, percentToBp, bpToPercent } from '../format';

// ─── The preview panel ───────────────────────────────────────

export function RateChangePreview({ body }: { body: Record<string, unknown> | null }) {
  const preview = useRatePreview(body);

  if (!body) {
    return (
      <p className="text-[12px] text-dash-muted">
        Choose a date range and a new price to see exactly what would change.
      </p>
    );
  }
  if (preview.isPending) return <Loading label="Working out what would change…" rows={2} />;
  if (preview.error) {
    return <WarnNote>{(preview.error as any)?.message ?? 'The change could not be planned.'}</WarnNote>;
  }
  return <PlanSummary plan={preview.data!} />;
}

export function PlanSummary({ plan, label = 'change' }: { plan: ChangePlan; label?: string }) {
  const rising = plan.averageToMinor >= plan.averageFromMinor;
  return (
    <div className="space-y-3">
      {plan.warnings.map((w, i) => (
        <WarnNote key={i}>
          <span className="inline-flex items-start gap-1.5">
            <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-px" />{w}
          </span>
        </WarnNote>
      ))}

      <div className="rounded-xl border subtle-divider p-3">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {rising
            ? <TrendingUp className="w-4 h-4 text-status-ok" />
            : <TrendingDown className="w-4 h-4 text-status-warn" />}
          <p className="text-[13px] font-black">
            {plan.changedCount.toLocaleString()} of {plan.cellCount.toLocaleString()} price(s) would {label}
          </p>
          {plan.unchangedCount > 0 && (
            <Pill tone="grey">{plan.unchangedCount.toLocaleString()} already at that price</Pill>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Dates" value={String(plan.dates)} />
          <Stat label="Room types" value={String(plan.roomTypes)} />
          <Stat label="Rate plans" value={String(plan.ratePlans)} />
          <Stat label="Average price"
            value={`${money(plan.averageFromMinor)} → ${money(plan.averageToMinor)}`} />
        </div>

        {plan.minFrom !== null && (
          <p className="text-[11px] text-dash-muted mt-3">
            Current range {money(plan.minFrom)} – {money(plan.maxFrom!)} ·
            {' '}new range {money(plan.minTo!)} – {money(plan.maxTo!)}
          </p>
        )}
      </div>

      {plan.biggestMovers.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1.5">
            Biggest movers
          </p>
          <div className="max-h-[200px] overflow-auto scroll-thin">
            <table className="w-full min-w-[40rem] text-[12px]">
              <tbody>
                {plan.biggestMovers.map((c, i) => {
                  const delta = c.toMinor - c.fromMinor;
                  return (
                    <tr key={i} className="border-b border-black/[0.03]">
                      <td className="py-1.5 whitespace-nowrap">{shortDate(c.date)}</td>
                      <td className="py-1.5 text-dash-muted">{c.roomType}</td>
                      <td className="py-1.5"><Pill tone="grey">{c.ratePlan}</Pill></td>
                      <td className="py-1.5 text-right tabular-nums text-dash-muted">
                        {money(c.fromMinor)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums font-bold">{money(c.toMinor)}</td>
                      <td className={`py-1.5 text-right tabular-nums text-[11px] font-semibold ${
                        delta > 0 ? 'text-status-ok' : 'text-status-warn'}`}>
                        {delta > 0 ? '+' : ''}{money(delta)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1">{label}</p>
      <p className="text-[13px] font-black tabular-nums">{value}</p>
    </div>
  );
}

// ─── The planning tab ────────────────────────────────────────

export function PlanningTab({ today }: { today: string }) {
  const [tab, setTab] = useState<'scheduled' | 'seasons' | 'copy' | 'history'>('scheduled');
  const seasons = useSeasons();
  const scheduled = useScheduledRateChanges();

  return (
    <div className="space-y-3">
      <Tabs
        tabs={[
          {
            value: 'scheduled', label: 'Scheduled changes',
            count: scheduled.data?.filter((s) => s.status === 'scheduled').length,
          },
          { value: 'seasons', label: 'Seasons', count: seasons.data?.length },
          { value: 'copy', label: 'Copy a period' },
          { value: 'history', label: 'Rate history' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'scheduled' && <ScheduledPanel today={today} />}
      {tab === 'seasons' && <SeasonsPanel />}
      {tab === 'copy' && <CopyPanel today={today} />}
      {tab === 'history' && <HistoryPanel />}
    </div>
  );
}

// ─── Scheduled changes ───────────────────────────────────────

function ScheduledPanel({ today }: { today: string }) {
  const toast = useToast();
  const scheduled = useScheduledRateChanges();
  const cancel = useCancelScheduledRateChange();
  const runDue = useRunDueRateChanges();
  const [cancelId, setCancelId] = useState<string | null>(null);

  return (
    <QueryState query={scheduled} loadingRows={3}>
      {(rows) => {
        const due = rows.filter((r) => r.due);
        return (
          <div className="space-y-3">
            {due.length > 0 && (
              <InfoNote>
                {due.length} change(s) are due and will be applied by the next night audit.
                Apply them now if you would rather not wait.
              </InfoNote>
            )}

            <Card>
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                    Scheduled rate changes
                  </p>
                  <p className="text-[11px] text-dash-muted mt-0.5">
                    Set a price to take effect on a future date and walk away. Changes are applied
                    during the night audit that rolls onto their effective date.
                  </p>
                </div>
                {due.length > 0 && (
                  <PermissionButton permission="rates.write" size="sm"
                    icon={<Play className="w-3 h-3" />}
                    disabled={runDue.isPending}
                    onClick={async () => {
                      try {
                        const r: any = await runDue.mutateAsync();
                        toast.success(`${r.applied} of ${r.due} change(s) applied`);
                      } catch (e) { toast.fail(e); }
                    }}>
                    Apply {due.length} due now
                  </PermissionButton>
                )}
              </div>

              {rows.length === 0 ? (
                <div className="py-10 text-center">
                  <Clock className="w-6 h-6 text-dash-muted mx-auto mb-2" />
                  <p className="text-[13px] font-bold">Nothing scheduled</p>
                  <p className="text-[11px] text-dash-muted mt-1">
                    Use “Schedule for later” in the bulk rate editor.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto scroll-thin">
                  <table className="w-full min-w-[40rem] text-[12px]">
                    <thead>
                      <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                        <th className="pb-2">Takes effect</th>
                        <th className="pb-2">Name</th>
                        <th className="pb-2">Applies to</th>
                        <th className="pb-2">Change</th>
                        <th className="pb-2">State</th>
                        <th className="pb-2 text-right" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s: ScheduledRateChange) => (
                        <tr key={s.id} className={`border-b border-black/[0.03] ${
                          s.status === 'cancelled' ? 'opacity-50' : ''}`}>
                          <td className="py-2.5 whitespace-nowrap">
                            <span className="font-semibold">{shortDate(s.effectiveDate)}</span>
                            {s.effectiveDate >= today && (
                              <p className="text-[10px] text-dash-muted">
                                {relativeTime(`${s.effectiveDate}T00:00:00Z`)}
                              </p>
                            )}
                          </td>
                          <td className="py-2.5 font-semibold">{s.name}</td>
                          <td className="py-2.5 text-dash-muted whitespace-nowrap">
                            {shortDate(s.change.from)} → {shortDate(s.change.to)}
                            {s.change.daysOfWeek?.length && (
                              <span className="ml-1">({s.change.daysOfWeek.join(', ')})</span>
                            )}
                          </td>
                          <td className="py-2.5 tabular-nums">
                            {s.change.priceMinor !== undefined ? money(s.change.priceMinor)
                              : s.change.adjustPercentBp !== undefined
                                ? `${s.change.adjustPercentBp > 0 ? '+' : ''}${bpToPercent(s.change.adjustPercentBp)}%`
                                : s.change.adjustMinor !== undefined
                                  ? `${s.change.adjustMinor > 0 ? '+' : ''}${money(s.change.adjustMinor)}`
                                  : '—'}
                          </td>
                          <td className="py-2.5">
                            {s.status === 'applied'
                              ? <Pill tone="mint">applied{s.cellsChanged !== null ? ` · ${s.cellsChanged}` : ''}</Pill>
                              : s.status === 'cancelled' ? <Pill tone="grey">cancelled</Pill>
                                : s.status === 'failed' ? <Pill tone="red">failed</Pill>
                                  : s.due ? <Pill tone="yellow">due now</Pill>
                                    : <Pill tone="sky">scheduled</Pill>}
                            {s.error && <p className="text-[10px] text-status-bad mt-0.5">{s.error}</p>}
                          </td>
                          <td className="py-2.5 text-right whitespace-nowrap">
                            {s.status === 'scheduled' && (
                              <PermissionButton permission="rates.write" size="sm" variant="ghost"
                                icon={<Ban className="w-3 h-3" />}
                                onClick={() => setCancelId(s.id)}>
                                Cancel
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

            <ConfirmDialog
              open={!!cancelId}
              title="Cancel this scheduled change?"
              body="It will never fire. Prices stay as they are — nothing that has already been applied is undone."
              confirmLabel="Cancel it"
              danger
              busy={cancel.isPending}
              onCancel={() => setCancelId(null)}
              onConfirm={async () => {
                if (!cancelId) return;
                try {
                  await cancel.mutateAsync({ id: cancelId });
                  toast.success('Scheduled change cancelled');
                } catch (e) { toast.fail(e); }
                setCancelId(null);
              }}
            />
          </div>
        );
      }}
    </QueryState>
  );
}

// ─── Seasons ─────────────────────────────────────────────────

function SeasonsPanel() {
  const toast = useToast();
  const seasons = useSeasons();
  const upsert = useUpsertSeason();
  const remove = useDeleteSeason();
  const [editing, setEditing] = useState<Season | 'new' | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <QueryState query={seasons} loadingRows={3}>
      {(rows) => (
        <div className="space-y-3">
          <Card>
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                  Seasons
                </p>
                <p className="text-[11px] text-dash-muted mt-0.5">
                  Named date ranges the property already thinks in. A season does not price
                  anything by itself — it saves retyping the same dates every time rates move.
                </p>
              </div>
              <PermissionButton permission="rates.write" size="sm"
                icon={<Plus className="w-3 h-3" />} onClick={() => setEditing('new')}>
                Add season
              </PermissionButton>
            </div>

            {rows.length === 0 ? (
              <div className="py-10 text-center">
                <CalendarRange className="w-6 h-6 text-dash-muted mx-auto mb-2" />
                <p className="text-[13px] font-bold">No seasons yet</p>
                <p className="text-[11px] text-dash-muted mt-1">
                  High, Shoulder and Low are the usual three.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full min-w-[40rem] text-[12px]">
                  <thead>
                    <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                      <th className="pb-2">Season</th>
                      <th className="pb-2">Dates</th>
                      <th className="pb-2">Nights</th>
                      <th className="pb-2">Priority</th>
                      <th className="pb-2">Note</th>
                      <th className="pb-2 text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s) => (
                      <tr key={s.id} className={`border-b border-black/[0.03] ${s.active ? '' : 'opacity-50'}`}>
                        <td className="py-2.5">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ background: s.colour ?? '#cbd5e1' }} />
                            <span className="font-bold">{s.name}</span>
                            {!s.active && <Pill tone="grey">off</Pill>}
                          </span>
                        </td>
                        <td className="py-2.5 whitespace-nowrap">
                          {shortDate(s.from)} → {shortDate(s.to)}
                        </td>
                        <td className="py-2.5 tabular-nums text-dash-muted">{s.nights}</td>
                        <td className="py-2.5 tabular-nums text-dash-muted">{s.priority}</td>
                        <td className="py-2.5 text-dash-muted">{s.note ?? '—'}</td>
                        <td className="py-2.5 text-right whitespace-nowrap">
                          <PermissionButton permission="rates.write" size="sm" variant="ghost"
                            onClick={() => setEditing(s)}>Edit</PermissionButton>
                          <PermissionButton permission="rates.write" size="sm" variant="ghost"
                            icon={<Trash2 className="w-3 h-3" />}
                            onClick={() => setDeleteId(s.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {rows.length > 1 && (
              <p className="text-[11px] text-dash-muted mt-3">
                Where two seasons cover the same date, the higher priority wins.
              </p>
            )}
          </Card>

          <SeasonModal
            season={editing}
            busy={upsert.isPending}
            onClose={() => setEditing(null)}
            onSave={async (body, id) => {
              try {
                await upsert.mutateAsync({ id, body });
                toast.success(id ? 'Season updated' : 'Season added');
                setEditing(null);
              } catch (e) { toast.fail(e); }
            }}
          />

          <ConfirmDialog
            open={!!deleteId}
            title="Delete this season?"
            body="Only the named date range goes. No prices change — a season is a label, not a rate."
            confirmLabel="Delete"
            danger
            busy={remove.isPending}
            onCancel={() => setDeleteId(null)}
            onConfirm={async () => {
              if (!deleteId) return;
              try {
                await remove.mutateAsync({ id: deleteId });
                toast.success('Season deleted');
              } catch (e) { toast.fail(e); }
              setDeleteId(null);
            }}
          />
        </div>
      )}
    </QueryState>
  );
}

function SeasonModal({
  season, busy, onClose, onSave,
}: {
  season: Season | 'new' | null;
  busy: boolean;
  onClose: () => void;
  onSave: (body: Record<string, unknown>, id?: string) => void;
}) {
  const existing = season && season !== 'new' ? season : null;
  const [name, setName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [priority, setPriority] = useState(0);
  const [colour, setColour] = useState('#ef4444');
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState<string | null>(null);

  const key = existing?.id ?? (season === 'new' ? 'new' : null);
  if (key && key !== loaded) {
    setLoaded(key);
    setName(existing?.name ?? '');
    setFrom(existing?.from ?? '');
    setTo(existing?.to ?? '');
    setPriority(existing?.priority ?? 0);
    setColour(existing?.colour ?? '#ef4444');
    setNote(existing?.note ?? '');
  }

  return (
    <Modal open={!!season} onClose={onClose} title={existing ? `Edit ${existing.name}` : 'Add a season'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || !name || !from || !to}
            onClick={() => onSave(
              { name, from, to, priority, colour, note: note || undefined }, existing?.id)}>
            {busy ? 'Saving…' : existing ? 'Save' : 'Add season'}
          </Button>
        </div>
      }>
      <div className="space-y-3">
        <Field label="Name"><TextInput value={name} onChange={setName} placeholder="High season" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><DateInput value={from} onChange={setFrom} /></Field>
          <Field label="To (inclusive)"><DateInput value={to} onChange={setTo} min={from || undefined} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority" hint="Higher wins where seasons overlap">
            <NumberInput value={priority} onChange={setPriority} min={0} max={100} />
          </Field>
          <Field label="Colour">
            <Select value={colour} onChange={setColour} options={[
              { label: 'Red', value: '#ef4444' },
              { label: 'Amber', value: '#f59e0b' },
              { label: 'Green', value: '#10b981' },
              { label: 'Blue', value: '#3b82f6' },
              { label: 'Purple', value: '#8b5cf6' },
              { label: 'Grey', value: '#94a3b8' },
            ]} />
          </Field>
        </div>
        <Field label="Note (optional)">
          <TextInput value={note} onChange={setNote} placeholder="School holidays, festival week…" />
        </Field>
      </div>
    </Modal>
  );
}

// ─── Copy a period ───────────────────────────────────────────

function CopyPanel({ today }: { today: string }) {
  const toast = useToast();
  const roomTypes = useRoomTypes();
  const ratePlans = useRatePlans();
  const copy = useCopyRates();

  const [sourceFrom, setSourceFrom] = useState('');
  const [sourceTo, setSourceTo] = useState('');
  const [targetFrom, setTargetFrom] = useState('');
  const [roomTypeId, setRoomTypeId] = useState('');
  const [ratePlanId, setRatePlanId] = useState('');
  const [percent, setPercent] = useState(0);

  const ready = !!sourceFrom && !!sourceTo && !!targetFrom && sourceTo >= sourceFrom;
  const body = ready ? {
    sourceFrom, sourceTo, targetFrom,
    roomTypeIds: roomTypeId ? [roomTypeId] : undefined,
    ratePlanIds: ratePlanId ? [ratePlanId] : undefined,
    multiplierBp: 10_000 + percentToBp(percent),
  } : null;
  const preview = useCopyPreview(body);

  return (
    <div className="space-y-3">
      <Card>
        <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1">
          Copy a period
        </p>
        <p className="text-[11px] text-dash-muted mb-3">
          Take the prices from one stretch of dates and lay them onto another, day for day,
          with an optional uplift. Nothing is written until you apply.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Copy from"><DateInput value={sourceFrom} onChange={setSourceFrom} /></Field>
          <Field label="…to (inclusive)">
            <DateInput value={sourceTo} onChange={setSourceTo} min={sourceFrom || undefined} />
          </Field>
          <Field label="Starting on" hint="The first day of the target period">
            <DateInput value={targetFrom} onChange={setTargetFrom} min={today} />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <Field label="Room type">
            <Select value={roomTypeId} onChange={setRoomTypeId} options={[
              { label: 'All room types', value: '' },
              ...(roomTypes.data ?? []).map((rt) => ({ label: rt.name, value: rt.id })),
            ]} />
          </Field>
          <Field label="Rate plan">
            <Select value={ratePlanId} onChange={setRatePlanId} options={[
              { label: 'All non-derived plans', value: '' },
              ...(ratePlans.data ?? []).map((rp) => ({ label: `${rp.code} · ${rp.name}`, value: rp.id })),
            ]} />
          </Field>
          <Field label="Adjust by %" hint="0 copies the prices unchanged">
            <NumberInput value={percent} onChange={setPercent} min={-99} max={500} />
          </Field>
        </div>
      </Card>

      <Card>
        {!ready ? (
          <p className="text-[12px] text-dash-muted">
            Pick a source period and a start date for the target to see what would change.
          </p>
        ) : preview.isPending ? (
          <Loading label="Working out what would change…" rows={2} />
        ) : preview.error ? (
          <WarnNote>{(preview.error as any)?.message ?? 'The copy could not be planned.'}</WarnNote>
        ) : (
          <>
            <PlanSummary plan={preview.data!} label="be copied over" />
            <div className="flex justify-end mt-4">
              <PermissionButton permission="rates.write"
                icon={<Copy className="w-3.5 h-3.5" />}
                disabled={copy.isPending || preview.data!.changedCount === 0}
                onClick={async () => {
                  try {
                    const r: any = await copy.mutateAsync(body!);
                    toast.success('Prices copied', `${r.written} cell(s) written`);
                  } catch (e) { toast.fail(e, 'Could not copy those prices'); }
                }}>
                {copy.isPending ? 'Copying…' : `Copy ${preview.data!.changedCount} price(s)`}
              </PermissionButton>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

// ─── History ─────────────────────────────────────────────────

const SOURCE_TONE: Record<string, 'grey' | 'mint' | 'sky' | 'lilac' | 'yellow'> = {
  bulk: 'grey', scheduled: 'sky', copy: 'lilac', single: 'mint', clear: 'yellow',
};

function HistoryPanel() {
  const roomTypes = useRoomTypes();
  const [roomTypeId, setRoomTypeId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filters: Record<string, string> = {};
  if (roomTypeId) filters.roomTypeId = roomTypeId;
  if (from) filters.from = from;
  if (to) filters.to = to;
  const history = useRateHistory(filters);

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="w-full sm:w-[200px]">
            <Field label="Room type">
              <Select value={roomTypeId} onChange={setRoomTypeId} options={[
                { label: 'All room types', value: '' },
                ...(roomTypes.data ?? []).map((rt) => ({ label: rt.name, value: rt.id })),
              ]} />
            </Field>
          </div>
          <Field label="Stay dates from"><DateInput value={from} onChange={setFrom} /></Field>
          <Field label="to"><DateInput value={to} onChange={setTo} /></Field>
          {(roomTypeId || from || to) && (
            <Button variant="ghost" size="sm"
              onClick={() => { setRoomTypeId(''); setFrom(''); setTo(''); }}>
              Clear
            </Button>
          )}
        </div>
      </Card>

      <QueryState query={history} loadingRows={5}>
        {(rows) => (
          <Card>
            <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
              Rate changes
            </p>
            {rows.length === 0 ? (
              <div className="py-10 text-center">
                <History className="w-6 h-6 text-dash-muted mx-auto mb-2" />
                <p className="text-[13px] font-bold">No rate changes recorded</p>
                <p className="text-[11px] text-dash-muted mt-1">
                  Every price movement from here on will be listed, with who made it.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full min-w-[52rem] text-[12px]">
                  <thead>
                    <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                      <th className="pb-2">Stay date</th>
                      <th className="pb-2">Room type</th>
                      <th className="pb-2">Plan</th>
                      <th className="pb-2 text-right">From</th>
                      <th className="pb-2 text-right">To</th>
                      <th className="pb-2">How</th>
                      <th className="pb-2">Reason</th>
                      <th className="pb-2">Changed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((h) => (
                      <tr key={h.id} className="border-b border-black/[0.03]">
                        <td className="py-2.5 whitespace-nowrap font-semibold">{shortDate(h.date)}</td>
                        <td className="py-2.5">{h.roomType}</td>
                        <td className="py-2.5"><Pill tone="grey">{h.ratePlan}</Pill></td>
                        <td className="py-2.5 text-right tabular-nums text-dash-muted">
                          {h.fromMinor === null
                            ? <span title="The cell had no explicit price — it was inherited">inherited</span>
                            : money(h.fromMinor)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums font-bold">{money(h.toMinor)}</td>
                        <td className="py-2.5">
                          <Pill tone={SOURCE_TONE[h.source] ?? 'grey'}>{h.source}</Pill>
                        </td>
                        <td className="py-2.5 text-dash-muted">{h.reason ?? '—'}</td>
                        <td className="py-2.5 whitespace-nowrap">
                          <span className="text-dash-muted">{h.changedBy ?? '—'}</span>
                          <p className="text-[10px] text-dash-muted" title={timestamp(h.changedAt)}>
                            {relativeTime(h.changedAt)}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </QueryState>
    </div>
  );
}

// ─── Scheduling from the bulk editor ─────────────────────────

export function ScheduleModal({
  open, onClose, change, today,
}: {
  open: boolean;
  onClose: () => void;
  change: Record<string, unknown> | null;
  today: string;
}) {
  const toast = useToast();
  const schedule = useScheduleRateChange();
  const [name, setName] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');

  return (
    <Modal open={open} onClose={onClose} title="Schedule this rate change"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!name || !effectiveDate || schedule.isPending}
            onClick={async () => {
              try {
                const r: any = await schedule.mutateAsync({ ...change, name, effectiveDate });
                toast.success('Change scheduled',
                  `${r.willChange} price(s) will move on ${shortDate(r.effectiveDate)}`);
                onClose();
              } catch (e) { toast.fail(e, 'Could not schedule that change'); }
            }}>
            {schedule.isPending ? 'Scheduling…' : 'Schedule it'}
          </Button>
        </div>
      }>
      <div className="space-y-3">
        <InfoNote>
          The change is stored exactly as entered and applied during the night audit that rolls
          onto its effective date. It is checked now, so a change that could never work is
          rejected here rather than failing quietly at 3am.
        </InfoNote>
        <Field label="Name it" hint="So you know what it is in the queue">
          <TextInput value={name} onChange={setName} placeholder="Festive uplift" />
        </Field>
        <Field label="Takes effect on">
          <DateInput value={effectiveDate} onChange={setEffectiveDate} min={today} />
        </Field>
      </div>
    </Modal>
  );
}
