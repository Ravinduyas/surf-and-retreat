import { Fragment, useState } from 'react';
import {
  RadioTower, Plug, Upload, Download, RefreshCw, Link2, AlertTriangle, Search,
  Activity, ListTree, FileWarning, Gauge, Globe, CheckCircle2, CircleHelp, ChevronRight,
} from 'lucide-react';
import {
  useChannels, useChannelCatalogue, useChannelHealth, useChannelMappings, useSaveChannel,
  useUpdateChannel, useConnectChannel, useTestChannel, useDisconnectChannel, useSaveMapping,
  useDeleteMapping, usePushChannel, useProcessQueue, useChannelQueue, useImportBookings,
  useSyncLog, useConflicts, useResolveConflict, useIgnoreConflict, useDetectDrift,
  useRoomTypes, useRatePlans, useAri, useDiscoveredUnits, useChannelContent, useSaveChannelContent,
  usePendingChannelReports, useOtas, useRefreshOtas, useDeclareOta,
} from '../queries';
import { PendingReportsPanel } from './ChannelReport';
import { useNav } from '../nav';
import { useAuthStore } from '../stores';
import { Card, Pill, Button, SectionHeader, Tabs, Field, Select, TextInput, Modal } from '../ui';
import { ChannelPublishNote } from '../ChannelPublishNote';
import {
  QueryState, useToast, PermissionButton, Toggle, statusTone, NumberInput, DateInput,
  InfoNote, WarnNote, ErrorNote,
} from '../components';
import { money, moneyShort, pct, relativeTime, bytes, addDays, longDate, bpToPercent, percentToBp } from '../format';
import type { Channel } from '../types';
import { CHANNEL_HUB, CHANNEL_HUB_TITLE, CHANNEL_HUB_SHORT } from '../branding';
import { ConnectionTab } from './ChannelConnect';

export function ChannelManagerScreen() {
  const toast = useToast();
  const property = useAuthStore((s) => s.property);
  const today = property?.businessDate ?? new Date().toISOString().slice(0, 10);

  const channels = useChannels();
  const otas = useOtas();
  const catalogue = useChannelCatalogue();
  const health = useChannelHealth();
  const roomTypes = useRoomTypes();
  const ratePlans = useRatePlans();
  const queue = useChannelQueue();
  const conflicts = useConflicts();

  const { navigate } = useNav();
  const pendingReports = usePendingChannelReports();
  // 'connection' first, and the default: it is the step everything else
  // depends on, and the screen somebody opens when distribution is not
  // working. The old default landed on a channel list that looks identical
  // whether or not the credential behind it is valid.
  const [tab, setTab] = useState<'connection' | 'channels' | 'mappings' | 'ari' | 'reservations' | 'reports' | 'log' | 'content'>('connection');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [addOpen, setAddOpen] = useState(false);
  const [connectTarget, setConnectTarget] = useState<Channel | null>(null);
  const [showConnection, setShowConnection] = useState(false);

  const mappings = useChannelMappings(selectedChannelId || undefined);
  const syncLog = useSyncLog(selectedChannelId || undefined, 120);

  const saveChannel = useSaveChannel();
  const updateChannel = useUpdateChannel();
  const connectChannel = useConnectChannel();
  const testChannel = useTestChannel();
  const disconnectChannel = useDisconnectChannel();
  const saveMapping = useSaveMapping();
  const deleteMapping = useDeleteMapping();
  const pushChannel = usePushChannel();
  const processQueue = useProcessQueue();
  const importBookings = useImportBookings();
  const resolveConflict = useResolveConflict();
  const ignoreConflict = useIgnoreConflict();
  const detectDrift = useDetectDrift();

  return (
    <div>
      <SectionHeader
        eyebrow="Distribution"
        title="Channel manager"
        action={
          <Tabs
            tabs={[
              { value: 'connection', label: 'Connection' },
              { value: 'channels', label: 'Channels', count: channels.data?.length },
              { value: 'mappings', label: 'Mappings', count: mappings.data?.length },
              { value: 'ari', label: 'ARI preview' },
              { value: 'reservations', label: 'Inbound', count: conflicts.data?.length },
              { value: 'reports', label: 'To report', count: pendingReports.data?.length },
              { value: 'log', label: 'Sync log' },
              { value: 'content', label: 'Content' },
            ]}
            active={tab}
            onChange={setTab}
          />
        }
      />

      <ChannelPublishNote className="mb-4" />

      {/* Channel picker bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="w-full sm:w-[240px]">
          <Select value={selectedChannelId} onChange={setSelectedChannelId} options={[
            { label: 'All channels', value: '' },
            ...(channels.data ?? []).map((c) => ({ label: `${c.name} (${c.code})`, value: c.id })),
          ]} />
        </div>
        {queue.data && queue.data.length > 0 && (
          <PermissionButton permission="channels.write" size="sm" variant="secondary"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            disabled={processQueue.isPending}
            onClick={async () => {
              try {
                const res = await processQueue.mutateAsync({ maxBatches: 10 });
                const failed = res.results.filter((r: any) => !r.ok).length;
                toast.push({
                  kind: failed ? 'warn' : 'ok',
                  title: `${res.batches} batch(es) sent${failed ? `, ${failed} failed` : ''}`,
                  body: res.stillQueued ? `${res.stillQueued} still queued` : res.notes?.join(' · '),
                });
              } catch (e) { toast.fail(e); }
            }}>
            Process queue ({queue.data.length})
          </PermissionButton>
        )}
        <PermissionButton permission="channels.write" size="sm" className="ml-auto"
          icon={<Plug className="w-3.5 h-3.5" />} onClick={() => setAddOpen(true)}>
          Add a channel
        </PermissionButton>
      </div>

      {tab === 'connection' && <ConnectionTab />}

      {tab === 'channels' && (
        <QueryState query={channels} loadingRows={4}
          empty="No channels configured"
          emptyHint={`Add Booking.com, Expedia, Hostelworld and the rest, then connect them through ${CHANNEL_HUB}.`}>
          {(list) => (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Card tone="mint"><Metric label="OTAs selling"
                  value={String(otas.data?.summary?.confirmed ?? 0)} /></Card>
                <Card><Metric label="Likely live"
                  value={String(otas.data?.summary?.likely ?? 0)} /></Card>
                <Card tone={list.some((c) => c.status === 'error') ? 'peach' : 'plain'}>
                  <Metric label="In error" value={String(list.filter((c) => c.status === 'error').length)} />
                </Card>
                <Card><Metric label="Queued pushes" value={String(queue.data?.length ?? 0)} /></Card>
              </div>

              <OtaPanel channels={list} />

              {/* The pipe, folded away.
                  Beds24 is not a place anyone books, so it does not belong in a
                  list of where the rooms are sold. Its controls are still here
                  — test, import, push, disconnect are real operations someone
                  needs — just behind one click instead of above the OTAs. */}
              <button
                onClick={() => setShowConnection((v) => !v)}
                className="flex items-center gap-1.5 mt-6 mb-2 text-[10px] font-bold uppercase
                           tracking-widest text-dash-muted hover:text-dash-text"
              >
                <ChevronRight className={`w-3 h-3 transition-transform ${showConnection ? 'rotate-90' : ''}`} />
                Connection settings
              </button>
              <div className={`space-y-2 ${showConnection ? '' : 'hidden'}`}>
                {list.map((c) => (
                  <Card key={c.id}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <RadioTower className="w-4 h-4 text-dash-muted" />
                          <p className="text-[14px] font-bold">{c.name}</p>
                          <Pill tone="grey">{c.code}</Pill>
                          <Pill tone={statusTone(c.status)}>{c.status}</Pill>
                          {!c.active && <Pill tone="peach">Paused</Pill>}
                        </div>
                        <div className="flex flex-wrap gap-3 text-[11px] text-dash-muted">
                          <span>{c.mappings} mapping{c.mappings === 1 ? '' : 's'}</span>
                          <span>Commission {bpToPercent(c.commissionBp)}%</span>
                          {c.priceMultiplierBp !== 10000 && (
                            <span>Price ×{(c.priceMultiplierBp / 10000).toFixed(2)}</span>
                          )}
                          {c.allotment !== null && c.allotment !== undefined && <span>Allotment {c.allotment}</span>}
                          <span>{c.pushedToday} push · {c.pulledToday} pull today</span>
                          {c.failuresToday > 0 && (
                            <span className="text-status-bad font-semibold">{c.failuresToday} failure(s)</span>
                          )}
                          <span>Last sync {c.lastSyncAt ? relativeTime(c.lastSyncAt) : 'never'}</span>
                        </div>
                        {c.lastError && (
                          <p className="text-[11px] text-status-bad mt-2 break-all">{c.lastError}</p>
                        )}
                        {!c.configured && (
                          <p className="text-[11px] text-dash-muted mt-2">
                            No credentials stored — connect the channel to start distributing.
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        <Toggle checked={c.active}
                          onChange={(v) => updateChannel.mutate({ id: c.id, body: { active: v } })} />
                        {c.configured ? (
                          <>
                            <PermissionButton permission="channels.write" size="sm" variant="secondary"
                              icon={<Activity className="w-3 h-3" />}
                              disabled={testChannel.isPending}
                              onClick={async () => {
                                const res = await testChannel.mutateAsync({ id: c.id });
                                if (res.ok) toast.success(`${c.name} is connected`,
                                  `${res.properties?.length ?? 0} property/properties visible`);
                                else toast.push({ kind: 'error', title: 'Connection failed', body: res.error });
                              }}>
                              Test
                            </PermissionButton>
                            <PermissionButton permission="channels.write" size="sm" variant="secondary"
                              icon={<Upload className="w-3 h-3" />}
                              disabled={pushChannel.isPending || !c.active}
                              onClick={async () => {
                                try {
                                  const res = await pushChannel.mutateAsync({
                                    id: c.id, body: { from: today, to: addDays(today, 60) },
                                  });
                                  toast.success(`Pushed ${res.rooms} room(s) to ${c.name}`,
                                    res.rateLimit?.fiveMinRemaining !== null
                                      ? `${res.rateLimit.fiveMinRemaining} sync credits left`
                                      : undefined);
                                } catch (e) { toast.fail(e, 'Push failed'); }
                              }}>
                              Push 60d
                            </PermissionButton>
                            <PermissionButton permission="channels.write" size="sm" variant="secondary"
                              icon={<Download className="w-3 h-3" />}
                              disabled={importBookings.isPending}
                              onClick={async () => {
                                try {
                                  const res = await importBookings.mutateAsync({ id: c.id });
                                  toast.success(
                                    `${res.created} new booking(s) imported`,
                                    `${res.fetched} fetched · ${res.updated} updated · ${res.conflicts} conflict(s)`,
                                  );
                                } catch (e) { toast.fail(e, 'Import failed'); }
                              }}>
                              Import
                            </PermissionButton>
                            <PermissionButton permission="channels.write" size="sm" variant="ghost"
                              icon={<Gauge className="w-3 h-3" />}
                              disabled={detectDrift.isPending}
                              onClick={async () => {
                                try {
                                  const res = await detectDrift.mutateAsync({
                                    id: c.id, body: { from: today, to: addDays(today, 14) },
                                  });
                                  toast.push({
                                    kind: res.drift.length ? 'warn' : 'ok',
                                    title: res.drift.length
                                      ? `${res.drift.length} difference(s) between Helio and ${c.name}`
                                      : `${c.name} matches Helio exactly`,
                                    body: res.drift.slice(0, 3)
                                      .map((d: any) => `${d.date} ${d.field}: PMS ${d.pmsValue} vs ${d.channelValue}`)
                                      .join(' · '),
                                  });
                                } catch (e) { toast.fail(e, 'Drift check failed'); }
                              }}>
                              Drift
                            </PermissionButton>
                            <PermissionButton permission="channels.write" size="sm" variant="ghost"
                              onClick={async () => {
                                try {
                                  await disconnectChannel.mutateAsync({ id: c.id });
                                  toast.success('Credentials removed');
                                } catch (e) { toast.fail(e); }
                              }}>
                              Disconnect
                            </PermissionButton>
                          </>
                        ) : (
                          <PermissionButton permission="channels.write" size="sm"
                            icon={<Link2 className="w-3 h-3" />} onClick={() => setConnectTarget(c)}>
                            Connect
                          </PermissionButton>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {queue.data && queue.data.length > 0 && (
                <Card className="mt-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
                    Pending pushes
                  </p>
                  <div className="overflow-x-auto scroll-thin">
                    <table className="w-full min-w-[40rem] text-[12px]">
                      <thead>
                        <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                          <th className="pb-2">Channel</th>
                          <th className="pb-2">Room type</th>
                          <th className="pb-2">Dates</th>
                          <th className="pb-2">Reason</th>
                          <th className="pb-2">Status</th>
                          <th className="pb-2 text-right">Attempts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/*
                          The reason a push failed belongs on the screen showing that
                          it failed. `queueStatus` has always returned `lastError` and
                          this table has always dropped it, so a row of red "failed"
                          pills said something was wrong and gave no way at all to find
                          out what — the one question anybody has when they see it.
                        */}
                        {queue.data.slice(0, 20).map((q: any) => (
                          <Fragment key={q.id}>
                            <tr className={q.lastError ? '' : 'border-b border-black/[0.03]'}>
                              <td className="py-2">{q.channel}</td>
                              <td className="py-2 text-dash-muted">{q.roomType ?? 'All'}</td>
                              <td className="py-2 whitespace-nowrap">{q.from} → {q.to}</td>
                              <td className="py-2 text-dash-muted">{q.reason}</td>
                              <td className="py-2"><Pill tone={statusTone(q.status)}>{q.status}</Pill></td>
                              <td className="py-2 text-right">{q.attempts}</td>
                            </tr>
                            {q.lastError && (
                              <tr className="border-b border-black/[0.03]">
                                <td colSpan={6} className="pb-2 text-[11px] text-status-bad break-all">
                                  {q.lastError}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}
        </QueryState>
      )}

      {tab === 'mappings' && (
        <MappingsTab
          channelId={selectedChannelId}
          channels={channels.data ?? []}
          mappings={mappings}
          roomTypes={roomTypes.data ?? []}
          ratePlans={ratePlans.data ?? []}
          onSave={async (body) => {
            try { await saveMapping.mutateAsync(body); toast.success('Mapping saved'); }
            catch (e) { toast.fail(e); }
          }}
          onDelete={async (id) => {
            try { await deleteMapping.mutateAsync({ id }); toast.success('Mapping removed'); }
            catch (e) { toast.fail(e); }
          }}
        />
      )}

      {tab === 'ari' && (
        <AriTab
          channels={channels.data ?? []}
          roomTypes={roomTypes.data ?? []}
          ratePlans={ratePlans.data ?? []}
          today={today}
        />
      )}

      {tab === 'reservations' && (
        <QueryState query={conflicts} loadingRows={3}
          empty="No unmapped inbound bookings"
          emptyHint="Bookings that arrive for a room Helio does not recognise appear here for you to map.">
          {(rows) => (
            <div className="space-y-2">
              <WarnNote>
                These bookings arrived from a channel but could not be matched to a room type or rate plan.
                Resolve each one by choosing what it should map to — the mapping is remembered for next time.
              </WarnNote>
              {rows.map((c) => (
                <ConflictCard
                  key={c.id}
                  conflict={c}
                  roomTypes={roomTypes.data ?? []}
                  ratePlans={ratePlans.data ?? []}
                  onResolve={async (body) => {
                    try {
                      await resolveConflict.mutateAsync({ id: c.id, body });
                      toast.success('Booking imported and mapping saved');
                    } catch (e) { toast.fail(e); }
                  }}
                  onIgnore={async () => {
                    try {
                      await ignoreConflict.mutateAsync({ id: c.id });
                      toast.success('Conflict ignored');
                    } catch (e) { toast.fail(e); }
                  }}
                />
              ))}
            </div>
          )}
        </QueryState>
      )}

      {tab === 'reports' && (
        <PendingReportsPanel onOpen={(id) => navigate('guest-dashboard', { reservationId: id })} />
      )}

      {tab === 'log' && (
        <QueryState query={syncLog} loadingRows={6}
          empty="Nothing has been synced yet"
          emptyHint="Every push, pull and failure is recorded here with its payload size and duration.">
          {(rows) => (
            <Card>
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full min-w-[46rem] text-[12px]">
                  <thead>
                    <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                      <th className="pb-2">When</th>
                      <th className="pb-2">Channel</th>
                      <th className="pb-2">Direction</th>
                      <th className="pb-2">Action</th>
                      <th className="pb-2 text-right">Size</th>
                      <th className="pb-2 text-right">Time</th>
                      <th className="pb-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((l) => (
                      <tr key={l.id} className="border-b border-black/[0.03]">
                        <td className="py-2 text-dash-muted whitespace-nowrap">{relativeTime(l.ts)}</td>
                        <td className="py-2 font-semibold">{l.channel}</td>
                        <td className="py-2">
                          <Pill tone={l.direction === 'push' ? 'sky' : 'lilac'}>{l.direction}</Pill>
                        </td>
                        <td className="py-2">
                          {l.action}
                          {l.error && <p className="text-[10px] text-status-bad mt-0.5 break-all">{l.error}</p>}
                        </td>
                        <td className="py-2 text-right text-dash-muted">{bytes(l.payloadBytes)}</td>
                        <td className="py-2 text-right text-dash-muted">{l.durationMs}ms</td>
                        <td className="py-2 text-right"><Pill tone={statusTone(l.status)}>{l.status}</Pill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </QueryState>
      )}

      {tab === 'content' && (
        <ContentTab channelId={selectedChannelId} channels={channels.data ?? []} />
      )}

      {/* ── Add channel ── */}
      <AddChannelModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        catalogue={catalogue.data ?? []}
        existing={channels.data ?? []}
        busy={saveChannel.isPending}
        onSave={async (body) => {
          try {
            await saveChannel.mutateAsync(body);
            toast.success('Channel added', `Connect it to ${CHANNEL_HUB} to start distributing`);
            setAddOpen(false);
          } catch (e) { toast.fail(e); }
        }}
      />

      {/* ── Connect ── */}
      <ConnectModal
        open={!!connectTarget}
        channel={connectTarget}
        onClose={() => setConnectTarget(null)}
        busy={connectChannel.isPending}
        onConnect={async (body) => {
          if (!connectTarget) return;
          try {
            const res = await connectChannel.mutateAsync({ id: connectTarget.id, body });
            if (res.ok) {
              toast.success(`${connectTarget.name} connected`,
                `${res.properties?.length ?? 0} property/properties available`);
              setConnectTarget(null);
            } else {
              toast.push({ kind: 'error', title: 'Could not connect', body: res.error });
            }
          } catch (e) { toast.fail(e, 'Connection failed'); }
        }}
      />
    </div>
  );
}

// ─── Mappings ────────────────────────────────────────────────
function MappingsTab({ channelId, channels, mappings, roomTypes, ratePlans, onSave, onDelete }: any) {
  const [adding, setAdding] = useState(false);
  const [roomTypeId, setRoomTypeId] = useState('');
  const [ratePlanId, setRatePlanId] = useState('');
  const [externalRoomId, setExternalRoomId] = useState('');
  const [externalRateId, setExternalRateId] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const discovered = useDiscoveredUnits(channelId || undefined, discovering && !!channelId);

  if (!channelId) {
    return (
      <Card>
        <p className="text-[12px] text-dash-muted">
          Select a channel above to manage how its rooms and rate plans map to yours.
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="flex justify-end gap-2 mb-3">
        <PermissionButton permission="channels.write" variant="secondary" size="sm"
          icon={<ListTree className="w-3.5 h-3.5" />}
          onClick={() => setDiscovering(true)}>
          Discover rooms from {CHANNEL_HUB}
        </PermissionButton>
        <PermissionButton permission="channels.write" size="sm" icon={<Link2 className="w-3.5 h-3.5" />}
          onClick={() => setAdding(true)}>
          Add mapping
        </PermissionButton>
      </div>

      {discovering && (
        <Card className="mb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
            Rooms found on {CHANNEL_HUB}
          </p>
          {discovered.isLoading && <p className="text-[12px] text-dash-muted">Reading the room list…</p>}
          {discovered.isError && <ErrorNote error={discovered.error} />}
          {discovered.data && discovered.data.length === 0 && (
            <p className="text-[12px] text-dash-muted">{CHANNEL_HUB_TITLE} returned no rooms for this property.</p>
          )}
          <div className="space-y-2">
            {discovered.data?.map((u) => (
              <div key={u.externalId} className="flex items-center gap-3 p-3 rounded-xl bg-dash-bg">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold">{u.name}</p>
                  <p className="text-[10px] text-dash-muted">
                    {CHANNEL_HUB_SHORT} id {u.externalId} · qty {u.quantity} · max {u.maxPeople} guests
                  </p>
                </div>
                <Pill tone={u.status === 'mapped' ? 'mint' : u.status === 'suggested' ? 'yellow' : 'grey'}>
                  {u.status}
                </Pill>
                {u.status !== 'mapped' && (
                  <PermissionButton permission="channels.write" size="sm" variant="secondary"
                    onClick={() => onSave({
                      channelId,
                      roomTypeId: u.suggestedRoomTypeId ?? roomTypes[0]?.id,
                      externalRoomId: u.externalId,
                      externalName: u.name,
                    })}>
                    Map to {u.suggestedRoomType ?? roomTypes[0]?.name ?? '—'}
                  </PermissionButton>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <QueryState query={mappings} loadingRows={3}
        empty="No mappings for this channel"
        emptyHint={`A mapping tells Helio which ${CHANNEL_HUB} room its room type corresponds to.`}>
        {(rows: any[]) => (
          <Card>
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[40rem] text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                    <th className="pb-2">Helio room type</th>
                    <th className="pb-2">Rate plan</th>
                    <th className="pb-2">{CHANNEL_HUB_SHORT} room id</th>
                    <th className="pb-2">{CHANNEL_HUB_SHORT} rate id</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.id} className="border-b border-black/[0.03]">
                      <td className="py-2.5 font-semibold">{m.roomType ?? '—'}</td>
                      <td className="py-2.5 text-dash-muted">{m.ratePlanCode ?? 'Any'}</td>
                      <td className="py-2.5 font-mono text-[11px]">{m.externalRoomId ?? '—'}</td>
                      <td className="py-2.5 font-mono text-[11px]">{m.externalRateId ?? '—'}</td>
                      <td className="py-2.5">
                        <Pill tone={m.active && m.externalRoomId ? 'mint' : 'peach'}>
                          {m.externalRoomId ? (m.active ? 'active' : 'inactive') : 'incomplete'}
                        </Pill>
                      </td>
                      <td className="py-2.5 text-right">
                        <PermissionButton permission="channels.write" size="sm" variant="ghost"
                          onClick={() => onDelete(m.id)}>
                          Remove
                        </PermissionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </QueryState>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a room mapping"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
            <Button disabled={!roomTypeId || !externalRoomId.trim()}
              onClick={() => {
                onSave({
                  channelId, roomTypeId,
                  ratePlanId: ratePlanId || undefined,
                  externalRoomId: externalRoomId.trim(),
                  externalRateId: externalRateId.trim() || undefined,
                });
                setAdding(false); setExternalRoomId(''); setExternalRateId('');
              }}>
              Save mapping
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <Field label="Helio room type" required>
            <Select value={roomTypeId} onChange={setRoomTypeId} options={[
              { label: 'Select a room type', value: '' },
              ...roomTypes.map((rt: any) => ({ label: rt.name, value: rt.id })),
            ]} />
          </Field>
          <Field label="Rate plan" hint="Which plan's price is pushed for this room">
            <Select value={ratePlanId} onChange={setRatePlanId} options={[
              { label: 'First active plan', value: '' },
              ...ratePlans.map((rp: any) => ({ label: `${rp.code} · ${rp.name}`, value: rp.id })),
            ]} />
          </Field>
          <Field label={`${CHANNEL_HUB_SHORT} room id`} required hint="Use “Discover rooms” to read these in">
            <TextInput value={externalRoomId} onChange={setExternalRoomId} />
          </Field>
          <Field label={`${CHANNEL_HUB_SHORT} rate id`}><TextInput value={externalRateId} onChange={setExternalRateId} /></Field>
        </div>
      </Modal>
    </>
  );
}

// ─── ARI preview ─────────────────────────────────────────────
function AriTab({ channels, roomTypes, ratePlans, today }: any) {
  const [roomTypeId, setRoomTypeId] = useState('');
  const [ratePlanId, setRatePlanId] = useState('');
  const [channelCode, setChannelCode] = useState('');
  const [from, setFrom] = useState(today);
  const to = addDays(from, 14);
  const ari = useAri(from, to, roomTypeId || undefined, ratePlanId || undefined, channelCode || undefined);

  return (
    <>
      <InfoNote>
        This is exactly what would be sent to the channel for these dates: pooled availability capped by any
        allotment, the channel-adjusted price, and the effective restrictions.
      </InfoNote>

      <div className="flex items-end gap-3 my-4 flex-wrap">
        <div className="w-full sm:w-[180px]">
          <Field label="Room type">
            <Select value={roomTypeId} onChange={setRoomTypeId} options={[
              { label: 'All', value: '' }, ...roomTypes.map((rt: any) => ({ label: rt.name, value: rt.id })),
            ]} />
          </Field>
        </div>
        <div className="w-full sm:w-[180px]">
          <Field label="Rate plan">
            <Select value={ratePlanId} onChange={setRatePlanId} options={[
              { label: 'All', value: '' }, ...ratePlans.map((rp: any) => ({ label: rp.code, value: rp.id })),
            ]} />
          </Field>
        </div>
        <div className="w-full sm:w-[180px]">
          <Field label="As seen by channel">
            <Select value={channelCode} onChange={setChannelCode} options={[
              { label: 'Direct (no uplift)', value: '' },
              ...channels.map((c: any) => ({ label: c.name, value: c.code })),
            ]} />
          </Field>
        </div>
        <div className="w-full sm:w-[150px]"><Field label="From"><DateInput value={from} onChange={setFrom} /></Field></div>
      </div>

      <QueryState query={ari} loadingRows={5} isEmpty={(d: any) => !d?.cells?.length}
        empty="Nothing to distribute" emptyHint="Create a room type and a rate plan first.">
        {(data: any) => (
          <Card>
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[56rem] text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Room type</th>
                    <th className="pb-2">Rate plan</th>
                    <th className="pb-2 text-right">Available</th>
                    <th className="pb-2 text-right">Price</th>
                    <th className="pb-2 text-center">Min stay</th>
                    <th className="pb-2 text-center">CTA</th>
                    <th className="pb-2 text-center">CTD</th>
                    <th className="pb-2 text-center">Stop sell</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cells.map((c: any, i: number) => (
                    <tr key={i} className="border-b border-black/[0.03]">
                      <td className="py-2 whitespace-nowrap">{longDate(c.date)}</td>
                      <td className="py-2">{c.roomTypeCode}</td>
                      <td className="py-2 font-mono text-[10px]">{c.ratePlanCode}</td>
                      <td className={`py-2 text-right font-bold ${c.available === 0 ? 'text-status-bad' : ''}`}>
                        {c.available}
                      </td>
                      <td className="py-2 text-right tabular-nums font-bold">{money(c.priceMinor)}</td>
                      <td className="py-2 text-center text-dash-muted">{c.minStay ?? '—'}</td>
                      <td className="py-2 text-center">{c.cta ? <Pill tone="red">yes</Pill> : '—'}</td>
                      <td className="py-2 text-center">{c.ctd ? <Pill tone="red">yes</Pill> : '—'}</td>
                      <td className="py-2 text-center">{c.stopSell ? <Pill tone="red">closed</Pill> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </QueryState>
    </>
  );
}

// ─── Content ─────────────────────────────────────────────────
function ContentTab({ channelId, channels }: any) {
  const toast = useToast();
  const content = useChannelContent(channelId || undefined);
  const save = useSaveChannelContent();
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [editing, setEditing] = useState(false);

  if (!channelId) {
    return (
      <Card>
        <p className="text-[12px] text-dash-muted">
          Select a channel to manage the listing content pushed to it.
        </p>
      </Card>
    );
  }

  const current = content.data?.[0];

  return (
    <QueryState query={content} loadingRows={3} isEmpty={() => false}>
      {() => (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">Listing content</p>
              {current && (
                <p className="text-[11px] text-dash-muted mt-1">
                  Completeness {current.contentScore}% · updated {relativeTime(current.updatedAt)}
                </p>
              )}
            </div>
            <PermissionButton permission="channels.write" size="sm" variant="secondary"
              onClick={() => {
                setDraft({
                  shortName: current?.shortName ?? '',
                  description: current?.description ?? '',
                  amenities: (current?.amenities ?? []).join(', '),
                  photoCount: current?.photoCount ?? 0,
                  cancellationPolicy: current?.cancellationPolicy ?? 'Flexible',
                  maxOccupancy: current?.maxOccupancy ?? 2,
                  minStay: current?.minStay ?? 1,
                  maxStay: current?.maxStay ?? 30,
                });
                setEditing(!editing);
              }}>
              {editing ? 'Cancel' : current ? 'Edit content' : 'Add content'}
            </PermissionButton>
          </div>

          {!current && !editing && (
            <p className="text-[12px] text-dash-muted py-6 text-center">
              No content stored for this channel yet.
            </p>
          )}

          {editing ? (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Listing name"><TextInput value={draft.shortName}
                  onChange={(v) => setDraft({ ...draft, shortName: v })} /></Field>
                <Field label="Photos on the listing"><NumberInput value={draft.photoCount}
                  onChange={(v) => setDraft({ ...draft, photoCount: v })} min={0} /></Field>
              </div>
              <Field label="Description" hint="OTAs generally want at least 120 characters">
                <textarea value={draft.description} rows={4}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-black/40" />
              </Field>
              <Field label="Amenities" hint="Comma separated">
                <TextInput value={draft.amenities} onChange={(v) => setDraft({ ...draft, amenities: v })} />
              </Field>
              <div className="grid md:grid-cols-4 gap-3">
                <Field label="Cancellation">
                  <Select value={draft.cancellationPolicy}
                    onChange={(v) => setDraft({ ...draft, cancellationPolicy: v })} options={[
                      { label: 'Flexible', value: 'Flexible' }, { label: 'Moderate', value: 'Moderate' },
                      { label: 'Strict', value: 'Strict' }, { label: 'Non-refundable', value: 'Non-refundable' },
                    ]} />
                </Field>
                <Field label="Max occupancy"><NumberInput value={draft.maxOccupancy}
                  onChange={(v) => setDraft({ ...draft, maxOccupancy: v })} min={1} /></Field>
                <Field label="Min stay"><NumberInput value={draft.minStay}
                  onChange={(v) => setDraft({ ...draft, minStay: v })} min={1} /></Field>
                <Field label="Max stay"><NumberInput value={draft.maxStay}
                  onChange={(v) => setDraft({ ...draft, maxStay: v })} min={1} /></Field>
              </div>
              <div className="flex justify-end">
                <Button disabled={save.isPending}
                  onClick={async () => {
                    try {
                      await save.mutateAsync({
                        id: channelId,
                        body: {
                          ...draft,
                          amenities: String(draft.amenities ?? '').split(',').map((s) => s.trim()).filter(Boolean),
                        },
                      });
                      toast.success('Content saved');
                      setEditing(false);
                    } catch (e) { toast.fail(e); }
                  }}>
                  Save content
                </Button>
              </div>
            </div>
          ) : current && (
            <div className="space-y-3">
              <div className="grid md:grid-cols-2 gap-x-6 gap-y-3">
                <Detail label="Listing name" value={current.shortName ?? '—'} />
                <Detail label="Photos" value={String(current.photoCount)} />
                <Detail label="Cancellation" value={current.cancellationPolicy ?? '—'} />
                <Detail label="Occupancy / stay"
                  value={`${current.maxOccupancy ?? '—'} guests · ${current.minStay ?? 1}-${current.maxStay ?? '—'} nights`} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1">Description</p>
                <p className="text-[12px]">{current.description || '—'}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(current.amenities ?? []).map((a: string) => <Pill key={a} tone="mint">{a}</Pill>)}
              </div>
            </div>
          )}
        </Card>
      )}
    </QueryState>
  );
}

// ─── Modals & helpers ────────────────────────────────────────
function AddChannelModal({ open, onClose, catalogue, existing, onSave, busy }: any) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState('ota');
  const [commission, setCommission] = useState(15);
  const [uplift, setUplift] = useState(0);
  const [allotment, setAllotment] = useState<number | null>(null);

  const taken = new Set(existing.map((c: any) => c.code));

  return (
    <Modal open={open} onClose={onClose} title="Add a distribution channel"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!code.trim() || !name.trim() || busy}
            onClick={() => onSave({
              code: code.trim().toUpperCase(), name: name.trim(), kind,
              commissionBp: percentToBp(commission),
              priceMultiplierBp: 10000 + percentToBp(uplift),
              allotment,
              active: true,
            })}>
            Add channel
          </Button>
        </div>
      }>
      <div className="space-y-4">
        <Field label={`Pick from the ${CHANNEL_HUB} catalogue`}>
          <div className="flex flex-wrap gap-1.5">
            {catalogue.filter((c: any) => !taken.has(c.code)).map((c: any) => (
              <button key={c.code}
                onClick={() => { setCode(c.code); setName(c.name); setKind(c.kind); }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${
                  code === c.code ? 'bg-black text-white border-black' : 'bg-white border-black/10'
                }`}>
                {c.name}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Code" required><TextInput value={code} onChange={(v) => setCode(v.toUpperCase())} /></Field>
          <Field label="Name" required><TextInput value={name} onChange={setName} /></Field>
          <Field label="Commission %" hint="Recorded against bookings for reporting">
            <input type="number" value={commission} onChange={(e) => setCommission(Number(e.target.value))}
              className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-black/40" />
          </Field>
          <Field label="Price uplift %" hint="Adds a margin to the price sent to this channel">
            <input type="number" value={uplift} onChange={(e) => setUplift(Number(e.target.value))}
              className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-black/40" />
          </Field>
          <Field label="Allotment cap" hint="Leave blank for pooled inventory (recommended)">
            <input type="number" value={allotment ?? ''}
              onChange={(e) => setAllotment(e.target.value === '' ? null : Number(e.target.value))}
              className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-black/40" />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function ConnectModal({ open, channel, onClose, onConnect, busy }: any) {
  const [mode, setMode] = useState<'invite' | 'refresh'>('invite');
  const [inviteCode, setInviteCode] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [externalPropertyId, setExternalPropertyId] = useState('');

  return (
    <Modal open={open} onClose={onClose} title={`Connect ${channel?.name ?? ''} through ${CHANNEL_HUB}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={busy || (mode === 'invite' ? !inviteCode.trim() : !refreshToken.trim())}
            onClick={() => onConnect({
              inviteCode: mode === 'invite' ? inviteCode.trim() : undefined,
              refreshToken: mode === 'refresh' ? refreshToken.trim() : undefined,
              externalPropertyId: externalPropertyId.trim() || undefined,
            })}>
            {busy ? 'Connecting…' : 'Connect'}
          </Button>
        </div>
      }>
      <div className="space-y-4">
        <InfoNote>
          Helio distributes through {CHANNEL_HUB}. In that account go to Settings → Apps &amp; Integrations →
          API, create an invite code with read/write scopes for bookings and inventory, and paste it below.
          Helio exchanges it once for a long-lived token and stores only that.
        </InfoNote>

        <Field label="Credential type">
          <Select value={mode} onChange={(v) => setMode(v as any)} options={[
            { label: 'Invite code (first-time setup)', value: 'invite' },
            { label: 'Existing refresh token', value: 'refresh' },
          ]} />
        </Field>

        {mode === 'invite' ? (
          <Field label={`${CHANNEL_HUB_SHORT} invite code`} required>
            <TextInput value={inviteCode} onChange={setInviteCode} placeholder="Paste the invite code" />
          </Field>
        ) : (
          <Field label="Refresh token" required>
            <TextInput value={refreshToken} onChange={setRefreshToken} />
          </Field>
        )}

        <Field label={`${CHANNEL_HUB_SHORT} property id`} hint="Optional — restricts the sync to one property in a multi-property account">
          <TextInput value={externalPropertyId} onChange={setExternalPropertyId} />
        </Field>

        <WarnNote>
          The connection is verified against the live API before it is marked connected. If the
          credentials are wrong you'll see the exact error rather than a false success.
        </WarnNote>
      </div>
    </Modal>
  );
}

function ConflictCard({ conflict, roomTypes, ratePlans, onResolve, onIgnore }: any) {
  const [roomTypeId, setRoomTypeId] = useState('');
  const [ratePlanId, setRatePlanId] = useState('');

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <FileWarning className="w-4 h-4 text-status-warn" />
            <p className="text-[13px] font-bold">{conflict.guest ?? 'Unknown guest'}</p>
            <Pill tone="grey">{conflict.channel}</Pill>
            <Pill tone="red">{conflict.reason}</Pill>
          </div>
          <p className="text-[11px] text-dash-muted">
            Reference {conflict.otaReference} · received {relativeTime(conflict.receivedAt)}
          </p>
          <p className="text-[11px] text-dash-muted mt-1">
            Channel sent room <span className="font-mono font-bold">{conflict.roomTypeRaw ?? '—'}</span>
            {conflict.ratePlanRaw ? <> and rate <span className="font-mono font-bold">{conflict.ratePlanRaw}</span></> : null}
          </p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <div className="w-full sm:w-[160px]">
            <Field label="Map to room type">
              <Select value={roomTypeId} onChange={setRoomTypeId} options={[
                { label: 'Select…', value: '' },
                ...roomTypes.map((rt: any) => ({ label: rt.name, value: rt.id })),
              ]} />
            </Field>
          </div>
          <div className="w-full sm:w-[160px]">
            <Field label="Rate plan">
              <Select value={ratePlanId} onChange={setRatePlanId} options={[
                { label: 'Select…', value: '' },
                ...ratePlans.map((rp: any) => ({ label: rp.code, value: rp.id })),
              ]} />
            </Field>
          </div>
          <PermissionButton permission="channels.write" size="sm"
            disabled={!roomTypeId || !ratePlanId}
            onClick={() => onResolve({ roomTypeId, ratePlanId, createMapping: true })}>
            Import &amp; map
          </PermissionButton>
          <Button size="sm" variant="ghost" onClick={onIgnore}>Ignore</Button>
        </div>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-2">{label}</p>
      <p className="text-[24px] font-black leading-none">{value}</p>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-0.5">{label}</p>
      <p className="text-[13px] font-semibold">{value}</p>
    </div>
  );
}

/**
 * The OTAs behind the hub.
 *
 * Beds24 is one connection and many shopfronts. Nobody sells on Beds24 — guests
 * book on Hostelworld, Booking.com, Airbnb — and every question a property
 * actually asks is per-shopfront: which one produces, which cancels, which has
 * gone quiet. A screen showing a single "Beds24" row is honest about the pipe
 * and useless about the business.
 *
 * **Every row says how it knows.** Beds24's API cannot answer "which OTAs am I
 * connected to" — `/channels` returns literal null, `/properties/channels`
 * returns 500, and that is with the `all:channels` scope granted. So the state
 * is assembled from a booking (proof), a rate code (evidence) or a person
 * saying so (declared), and the reason is written next to the state rather than
 * flattened into a green tick that claims more than is known.
 */
function OtaPanel({ channels }: { channels: Channel[] }) {
  const toast = useToast();
  const otas = useOtas();
  const refresh = useRefreshOtas();
  const declare = useDeclareOta();
  const [showAll, setShowAll] = useState(false);

  const hub = channels.find((c) => c.status === 'connected') ?? channels[0];
  const rows: any[] = otas.data?.otas ?? [];
  const live = rows.filter((o) => o.state !== 'available');
  const rest = rows.filter((o) => o.state === 'available');

  const tone = (state: string) =>
    state === 'confirmed' ? 'mint' : state === 'evidence' ? 'yellow'
      : state === 'declared' ? 'sky' : 'grey';
  const icon = (state: string) =>
    state === 'confirmed' ? <CheckCircle2 className="w-4 h-4 text-status-good" />
      : state === 'available' ? <CircleHelp className="w-4 h-4 text-dash-muted" />
        : <Globe className="w-4 h-4 text-dash-muted" />;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
          Where your rooms are sold
        </p>
        {hub && (
          <span className="text-[10px] text-dash-muted">
            via {hub.name} · {hub.status}
            {hub.lastSyncAt ? ` · synced ${relativeTime(hub.lastSyncAt)}` : ''}
          </span>
        )}
        {hub && (
          <PermissionButton permission="channels.write" size="sm" variant="secondary"
            className="ml-auto" icon={<RefreshCw className="w-3.5 h-3.5" />}
            disabled={refresh.isPending}
            onClick={async () => {
              try {
                const res = await refresh.mutateAsync(hub.id);
                toast.push({
                  kind: 'ok',
                  title: `${res.summary.confirmed} confirmed · ${res.summary.likely} likely live`,
                  body: `${res.summary.total} channels available through ${hub.name}`,
                });
              } catch (e) { toast.fail(e); }
            }}>
            Re-check
          </PermissionButton>
        )}
      </div>

      {live.length === 0 && (
        <Card tone="peach" className="mb-2">
          <p className="text-[12px] font-bold">No OTA is confirmed as selling yet.</p>
          <p className="text-[11px] text-dash-muted mt-1">
            {CHANNEL_HUB_TITLE} does not publish which OTAs a property is connected to, so this fills in
            as bookings arrive. If you know one is live, mark it below.
          </p>
        </Card>
      )}

      <div className="space-y-2">
        {live.map((o) => (
          <Card key={o.code}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {icon(o.state)}
                  <p className="text-[14px] font-bold">{o.name}</p>
                  <Pill tone={tone(o.state) as any}>{o.state}</Pill>
                  {o.rateCode && <Pill tone="grey">rate {o.rateCode}</Pill>}
                </div>
                {/* The reason, in words. A state without one is a claim. */}
                <p className="text-[11px] text-dash-muted">{o.because}</p>
                {o.lastBookingAt && (
                  <p className="text-[11px] text-dash-muted mt-0.5">
                    Last booking {relativeTime(o.lastBookingAt)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {o.bookings > 0 && (
                  <div className="text-right">
                    <p className="text-[16px] font-black tabular-nums">{o.bookings}</p>
                    <p className="text-[10px] text-dash-muted">booking{o.bookings === 1 ? '' : 's'}</p>
                  </div>
                )}
                <Toggle
                  checked={o.state === 'confirmed' || o.declared}
                  disabled={o.state === 'confirmed'}
                  label={o.state === 'confirmed' ? 'Selling' : 'Mark live'}
                  onChange={async (v) => {
                    try { await declare.mutateAsync({ code: o.code, live: v }); }
                    catch (e) { toast.fail(e); }
                  }}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {rest.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setShowAll((v) => !v)}
            className="text-[11px] underline hover:no-underline text-dash-muted">
            {showAll ? 'Hide' : `Show ${rest.length} more channel${rest.length === 1 ? '' : 's'} `
              + `${hub?.name ?? CHANNEL_HUB} can distribute to`}
          </button>
          {showAll && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
              {rest.map((o) => (
                <button
                  key={o.code}
                  onClick={async () => {
                    try {
                      await declare.mutateAsync({ code: o.code, live: true });
                      toast.push({ kind: 'ok', title: `${o.name} marked live` });
                    } catch (e) { toast.fail(e); }
                  }}
                  className="px-3 py-2 rounded-xl bg-white border border-black/10 text-left
                             hover:bg-dash-bg transition-colors"
                  title={`Mark ${o.name} as selling`}
                >
                  <p className="text-[12px] font-bold truncate">{o.name}</p>
                  <p className="text-[10px] text-dash-muted">available</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
