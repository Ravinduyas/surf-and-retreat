import { useState, useMemo } from 'react';
import {
  Sparkles, Wrench, Search, AlertTriangle, Ban, Plus, ClipboardList, Package,
} from 'lucide-react';
import {
  useHkBoard, useHkTasks, useSetRoomStatus, useGenerateHkTasks, useUpdateHkTask,
  useWorkOrders, useCreateWorkOrder, useUpdateWorkOrder, useRoomBlocks, useBlockRoom,
  useReleaseBlock, useLostFound, useCreateLostFound, useUpdateLostFound, useUsers, useHkForecast,
} from '../queries';
import { useAuthStore } from '../stores';
import { Card, Pill, Button, SectionHeader, Tabs, Field, Select, TextInput, Modal } from '../ui';
import { QueryState, useToast, PermissionButton, statusTone, DateInput, ConfirmDialog } from '../components';
import { relativeTime, longDate, addDays } from '../format';
import type { BoardRoom, RoomStatus } from '../types';

const STATUS_ORDER: RoomStatus[] = [
  'Vacant Inspected', 'Vacant Clean', 'Vacant Dirty',
  'Occupied Clean', 'Occupied Dirty', 'Out of Order', 'Out of Service',
];

export function HousekeepingScreen() {
  const toast = useToast();
  const property = useAuthStore((s) => s.property);
  const [tab, setTab] = useState<'board' | 'tasks' | 'maintenance' | 'blocks' | 'lostfound'>('board');
  const [date, setDate] = useState(property?.businessDate ?? '');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [floorFilter, setFloorFilter] = useState('');

  const board = useHkBoard(date || undefined);
  const tasks = useHkTasks(date || undefined);
  const forecast = useHkForecast(date || undefined);
  const workOrders = useWorkOrders();
  const blocks = useRoomBlocks();
  const lostFound = useLostFound();
  const users = useUsers();

  const setStatus = useSetRoomStatus();
  const generate = useGenerateHkTasks();
  const updateTask = useUpdateHkTask();
  const createWorkOrder = useCreateWorkOrder();
  const updateWorkOrder = useUpdateWorkOrder();
  const blockRoom = useBlockRoom();
  const releaseBlock = useReleaseBlock();
  const createLostFound = useCreateLostFound();
  const updateLostFound = useUpdateLostFound();

  const [statusTarget, setStatusTarget] = useState<BoardRoom | null>(null);
  const [newStatus, setNewStatus] = useState<string>('Vacant Clean');
  const [woOpen, setWoOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [lfOpen, setLfOpen] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<string | null>(null);

  const [woTitle, setWoTitle] = useState('');
  const [woRoom, setWoRoom] = useState('');
  const [woCategory, setWoCategory] = useState('maintenance');
  const [woPriority, setWoPriority] = useState('normal');
  const [woDescription, setWoDescription] = useState('');

  const [blockRoomId, setBlockRoomId] = useState('');
  const [blockKind, setBlockKind] = useState<'OOO' | 'OOS'>('OOO');
  const [blockFrom, setBlockFrom] = useState(property?.businessDate ?? '');
  const [blockTo, setBlockTo] = useState(addDays(property?.businessDate ?? '', 1));
  const [blockReason, setBlockReason] = useState('');

  const [lfDescription, setLfDescription] = useState('');
  const [lfRoom, setLfRoom] = useState('');
  const [lfStorage, setLfStorage] = useState('');

  const floors = useMemo(() => {
    const set = new Set((board.data?.rooms ?? []).map((r) => r.floor));
    return [...set].sort((a, b) => a - b);
  }, [board.data]);

  return (
    <div>
      <SectionHeader
        eyebrow={`Business date ${property?.businessDate ?? ''}`}
        title="Housekeeping & maintenance"
        action={
          <div className="flex gap-2">
            <PermissionButton permission="housekeeping.write" variant="secondary"
              icon={<ClipboardList className="w-3.5 h-3.5" />}
              disabled={generate.isPending}
              onClick={async () => {
                try {
                  const res = await generate.mutateAsync({ date: date || undefined });
                  toast.success(res.created > 0
                    ? `${res.created} task(s) created for ${res.date}`
                    : `Task sheet for ${res.date} is already complete`);
                } catch (e) { toast.fail(e); }
              }}>
              Build task sheet
            </PermissionButton>
            <PermissionButton permission="housekeeping.write" icon={<Wrench className="w-3.5 h-3.5" />}
              onClick={() => setWoOpen(true)}>
              Work order
            </PermissionButton>
          </div>
        }
      />

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Tabs
          tabs={[
            { value: 'board', label: 'Room board' },
            { value: 'tasks', label: 'Task sheet', count: tasks.data?.length },
            { value: 'maintenance', label: 'Work orders', count: workOrders.data?.filter((w) => w.status !== 'closed' && w.status !== 'resolved').length },
            { value: 'blocks', label: 'Out of order', count: blocks.data?.length },
            { value: 'lostfound', label: 'Lost & found' },
          ]}
          active={tab}
          onChange={setTab}
        />
        <div className="w-full sm:w-[150px]">
          <DateInput value={date} onChange={setDate} />
        </div>
      </div>

      {tab === 'board' && (
        <QueryState query={board} loadingRows={6}>
          {(data) => {
            const counts = STATUS_ORDER.map((s) => ({
              status: s, n: data.rooms.filter((r) => r.status === s).length,
            }));
            const discrepancies = data.rooms.filter((r) => r.discrepancy);
            const q = search.trim().toLowerCase();
            const rooms = data.rooms
              .filter((r) => !statusFilter || r.status === statusFilter)
              .filter((r) => !floorFilter || String(r.floor) === floorFilter)
              .filter((r) => !q || r.number.toLowerCase().includes(q) || (r.guest ?? '').toLowerCase().includes(q));

            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
                  {counts.map((c) => (
                    <button
                      key={c.status}
                      onClick={() => setStatusFilter(statusFilter === c.status ? '' : c.status)}
                      className={`p-3 rounded-2xl border text-left transition-colors ${
                        statusFilter === c.status ? 'border-black bg-dash-bg' : 'border-black/5 hover:bg-dash-bg'
                      }`}
                    >
                      <p className="text-[20px] font-black leading-none">{c.n}</p>
                      <p className="text-[9px] font-bold uppercase tracking-wide text-dash-muted mt-1.5 leading-tight">
                        {c.status}
                      </p>
                    </button>
                  ))}
                </div>

                {discrepancies.length > 0 && (
                  <Card tone="peach" className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-status-warn" />
                      <p className="text-[12px] font-bold">
                        {discrepancies.length} discrepanc{discrepancies.length === 1 ? 'y' : 'ies'} between the front
                        office and housekeeping
                      </p>
                    </div>
                    <div className="space-y-1">
                      {discrepancies.map((r) => (
                        <p key={r.id} className="text-[11px]">
                          <span className="font-bold">Room {r.number}</span> — {r.discrepancy}
                        </p>
                      ))}
                    </div>
                  </Card>
                )}

                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-dash-muted" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Room or guest…"
                      className="w-full bg-white border border-black/10 rounded-full pl-9 pr-4 py-2 text-[12px] outline-none focus:border-black/30"
                    />
                  </div>
                  <div className="w-full sm:w-[130px]">
                    <Select value={floorFilter} onChange={setFloorFilter} options={[
                      { label: 'All floors', value: '' },
                      ...floors.map((f) => ({ label: `Floor ${f}`, value: String(f) })),
                    ]} />
                  </div>
                  {(statusFilter || floorFilter || search) && (
                    <Button size="sm" variant="ghost"
                      onClick={() => { setStatusFilter(''); setFloorFilter(''); setSearch(''); }}>
                      Clear
                    </Button>
                  )}
                </div>

                {rooms.length === 0 ? (
                  <p className="text-[12px] text-dash-muted py-10 text-center">
                    {data.rooms.length === 0
                      ? 'No rooms configured yet — add them in Configuration.'
                      : 'No rooms match these filters.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {rooms.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => { setStatusTarget(r); setNewStatus(r.status); }}
                        className={`p-3 rounded-2xl border text-left transition-colors hover:shadow-sm ${
                          r.discrepancy ? 'border-status-warn bg-dash-peach/30' : 'border-black/5 bg-white hover:bg-dash-bg'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1.5">
                          <p className="text-[15px] font-black leading-none">{r.number}</p>
                          {r.openWorkOrders > 0 && (
                            <span title={`${r.openWorkOrders} open work order(s)`}>
                              <Wrench className="w-3 h-3 text-status-warn" />
                            </span>
                          )}
                        </div>
                        <Pill tone={statusTone(r.status)}>{r.status.replace('Vacant ', 'V. ').replace('Occupied ', 'O. ')}</Pill>
                        <p className="text-[9px] text-dash-muted mt-1.5 truncate">{r.roomType}</p>
                        {r.guest && <p className="text-[10px] font-semibold truncate mt-0.5">{r.guest}</p>}
                        {r.departing && <p className="text-[9px] text-status-warn font-bold mt-0.5">Departing</p>}
                        {r.arriving && !r.occupied && (
                          <p className="text-[9px] text-status-info font-bold mt-0.5">Arriving: {r.arrivalGuest}</p>
                        )}
                        {r.blocked && (
                          <p className="text-[9px] text-status-bad font-bold mt-0.5">
                            {r.blocked.kind} to {r.blocked.to}
                          </p>
                        )}
                        {r.task && (
                          <p className="text-[9px] text-dash-muted mt-1">
                            {r.task.type} · {r.task.status}{r.task.assignee ? ` · ${r.task.assignee}` : ''}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            );
          }}
        </QueryState>
      )}

      {tab === 'tasks' && (
        <>
          {forecast.data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Card tone="yellow"><Metric label="Departure cleans" value={String(forecast.data.departureCleans)} /></Card>
              <Card tone="sky"><Metric label="Stayover cleans" value={String(forecast.data.stayoverCleans)} /></Card>
              <Card tone="mint"><Metric label="Arrivals to prep" value={String(forecast.data.arrivals)} /></Card>
              <Card><Metric label="Credits tomorrow" value={String(forecast.data.totalCredits)} /></Card>
            </div>
          )}
          <QueryState query={tasks} loadingRows={5}
            empty="No tasks for this date"
            emptyHint="Use “Build task sheet” to generate today's cleans from the reservation ledger.">
            {(rows) => (
              <Card>
                <div className="overflow-x-auto scroll-thin">
                  <table className="w-full min-w-[40rem] text-[12px]">
                    <thead>
                      <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                        <th className="pb-2">Room</th>
                        <th className="pb-2">Type</th>
                        <th className="pb-2">Room status</th>
                        <th className="pb-2">Assignee</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((t) => (
                        <tr key={t.id} className="border-b border-black/[0.03]">
                          <td className="py-2.5 font-black">{t.room}</td>
                          <td className="py-2.5">
                            <Pill tone={t.type === 'departure' ? 'peach' : 'grey'}>{t.type}</Pill>
                          </td>
                          <td className="py-2.5 text-dash-muted">{t.roomStatus}</td>
                          <td className="py-2.5">
                            <select
                              value={t.assigneeId ?? ''}
                              onChange={async (e) => {
                                try {
                                  await updateTask.mutateAsync({ id: t.id, body: { assigneeId: e.target.value || null } });
                                } catch (err) { toast.fail(err); }
                              }}
                              className="bg-transparent text-[11px] font-semibold outline-none"
                            >
                              <option value="">Unassigned</option>
                              {(users.data ?? []).filter((u) => u.active).map((u) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5"><Pill tone={statusTone(t.status)}>{t.status}</Pill></td>
                          <td className="py-2.5 text-right whitespace-nowrap">
                            {t.status === 'pending' && (
                              <PermissionButton permission="housekeeping.write" size="sm" variant="ghost"
                                onClick={() => updateTask.mutate({ id: t.id, body: { status: 'in-progress' } })}>
                                Start
                              </PermissionButton>
                            )}
                            {t.status === 'in-progress' && (
                              <PermissionButton permission="housekeeping.write" size="sm" variant="secondary"
                                onClick={() => updateTask.mutate({ id: t.id, body: { status: 'done' } })}>
                                Finish
                              </PermissionButton>
                            )}
                            {t.status === 'done' && (
                              <PermissionButton permission="housekeeping.write" size="sm" variant="secondary"
                                onClick={() => updateTask.mutate({ id: t.id, body: { status: 'inspected' } })}>
                                Inspect
                              </PermissionButton>
                            )}
                            {t.status === 'inspected' && <Pill tone="mint">Inspected</Pill>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </QueryState>
        </>
      )}

      {tab === 'maintenance' && (
        <QueryState query={workOrders} loadingRows={4} empty="No work orders">
          {(rows) => (
            <div className="space-y-2">
              {rows.map((w) => (
                <Card key={w.id}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-[13px] font-bold">{w.title}</p>
                        <Pill tone={w.priority === 'high' ? 'red' : w.priority === 'low' ? 'grey' : 'yellow'}>
                          {w.priority}
                        </Pill>
                        <Pill tone={statusTone(w.status)}>{w.status}</Pill>
                        {w.blocksRoom && <Pill tone="peach">Blocks the room</Pill>}
                      </div>
                      <p className="text-[11px] text-dash-muted">
                        {w.room ? `Room ${w.room}` : w.location ?? 'Property'} · {w.category} ·
                        reported by {w.reportedBy} {relativeTime(w.createdAt)}
                      </p>
                      {w.description && <p className="text-[12px] mt-2">{w.description}</p>}
                      {w.resolution && (
                        <p className="text-[11px] text-status-ok mt-2">Resolution: {w.resolution}</p>
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {w.status !== 'resolved' && w.status !== 'closed' && (
                        <>
                          {w.status === 'open' && (
                            <PermissionButton permission="housekeeping.write" size="sm" variant="secondary"
                              onClick={() => updateWorkOrder.mutate({ id: w.id, body: { status: 'in-progress' } })}>
                              Start
                            </PermissionButton>
                          )}
                          <PermissionButton permission="housekeeping.write" size="sm"
                            onClick={async () => {
                              const resolution = window.prompt('How was it resolved?');
                              if (!resolution) return;
                              try {
                                await updateWorkOrder.mutateAsync({ id: w.id, body: { status: 'resolved', resolution } });
                                toast.success('Work order resolved');
                              } catch (e) { toast.fail(e); }
                            }}>
                            Resolve
                          </PermissionButton>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </QueryState>
      )}

      {tab === 'blocks' && (
        <>
          <div className="flex justify-end mb-3">
            <PermissionButton permission="housekeeping.write" icon={<Ban className="w-3.5 h-3.5" />}
              onClick={() => setBlockOpen(true)}>
              Take a room out of order
            </PermissionButton>
          </div>
          <QueryState query={blocks} loadingRows={3} empty="No rooms are out of order">
            {(rows) => (
              <Card>
                <div className="overflow-x-auto scroll-thin">
                  <table className="w-full min-w-[46rem] text-[12px]">
                    <thead>
                      <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                        <th className="pb-2">Room</th>
                        <th className="pb-2">Kind</th>
                        <th className="pb-2">From</th>
                        <th className="pb-2">To</th>
                        <th className="pb-2">Reason</th>
                        <th className="pb-2">By</th>
                        <th className="pb-2 text-right" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((b) => (
                        <tr key={b.id} className="border-b border-black/[0.03]">
                          <td className="py-2.5 font-black">{b.room}</td>
                          <td className="py-2.5">
                            <Pill tone={b.kind === 'OOO' ? 'red' : 'peach'}>{b.kind}</Pill>
                          </td>
                          <td className="py-2.5">{longDate(b.fromDate)}</td>
                          <td className="py-2.5">{longDate(b.toDate)}</td>
                          <td className="py-2.5 text-dash-muted">{b.reason}</td>
                          <td className="py-2.5 text-dash-muted">{b.createdBy}</td>
                          <td className="py-2.5 text-right">
                            <PermissionButton permission="housekeeping.write" size="sm" variant="ghost"
                              onClick={() => setReleaseTarget(b.id)}>
                              Release
                            </PermissionButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-dash-muted mt-3">
                  Out of order removes the room from the occupancy denominator; out of service keeps it in the
                  denominator but stops it being sold.
                </p>
              </Card>
            )}
          </QueryState>
        </>
      )}

      {tab === 'lostfound' && (
        <>
          <div className="flex justify-end mb-3">
            <PermissionButton permission="housekeeping.write" icon={<Package className="w-3.5 h-3.5" />}
              onClick={() => setLfOpen(true)}>
              Log an item
            </PermissionButton>
          </div>
          <QueryState query={lostFound} loadingRows={3} empty="Nothing in lost & found">
            {(rows) => (
              <div className="space-y-2">
                {rows.map((l) => (
                  <Card key={l.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[13px] font-bold">{l.description}</p>
                        <p className="text-[11px] text-dash-muted mt-0.5">
                          {l.room ? `Room ${l.room} · ` : ''}found {longDate(l.foundOn)} by {l.foundBy}
                          {l.storageRef ? ` · stored at ${l.storageRef}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Pill tone={l.status === 'returned' ? 'mint' : l.status === 'disposed' ? 'grey' : 'yellow'}>
                          {l.status}
                        </Pill>
                        {l.status === 'stored' && (
                          <PermissionButton permission="housekeeping.write" size="sm" variant="secondary"
                            onClick={() => updateLostFound.mutate({ id: l.id, body: { status: 'returned' } })}>
                            Returned
                          </PermissionButton>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </QueryState>
        </>
      )}

      {/* ── Modals ── */}
      <Modal open={!!statusTarget} onClose={() => setStatusTarget(null)}
        title={`Room ${statusTarget?.number ?? ''}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStatusTarget(null)}>Cancel</Button>
            <PermissionButton permission="housekeeping.write"
              disabled={setStatus.isPending}
              onClick={async () => {
                if (!statusTarget) return;
                try {
                  await setStatus.mutateAsync({ roomId: statusTarget.id, status: newStatus });
                  toast.success(`Room ${statusTarget.number} → ${newStatus}`);
                  setStatusTarget(null);
                } catch (e) { toast.fail(e); }
              }}>
              Update status
            </PermissionButton>
          </div>
        }>
        {statusTarget && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <Detail label="Room type" value={statusTarget.roomType} />
              <Detail label="Floor" value={String(statusTarget.floor)} />
              <Detail label="Current status" value={statusTarget.status} />
              <Detail label="Last cleaned" value={relativeTime(statusTarget.lastCleaned)} />
              {statusTarget.guest && <Detail label="Guest" value={statusTarget.guest} />}
              {statusTarget.attendant && <Detail label="Attendant" value={statusTarget.attendant} />}
            </div>
            {statusTarget.discrepancy && (
              <div className="rounded-xl bg-dash-peach/50 p-3">
                <p className="text-[11px]">{statusTarget.discrepancy}</p>
              </div>
            )}
            <Field label="New status">
              <Select value={newStatus} onChange={setNewStatus}
                options={STATUS_ORDER.map((s) => ({ label: s, value: s }))} />
            </Field>
            {statusTarget.occupied && newStatus.startsWith('Vacant') && (
              <p className="text-[11px] text-status-bad font-semibold">
                This room has an in-house guest — it cannot be marked vacant until they check out.
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal open={woOpen} onClose={() => setWoOpen(false)} title="Raise a work order"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setWoOpen(false)}>Cancel</Button>
            <Button disabled={!woTitle.trim() || createWorkOrder.isPending}
              onClick={async () => {
                try {
                  await createWorkOrder.mutateAsync({
                    title: woTitle.trim(),
                    roomId: woRoom || undefined,
                    category: woCategory,
                    priority: woPriority,
                    description: woDescription || undefined,
                  });
                  toast.success('Work order raised');
                  setWoOpen(false); setWoTitle(''); setWoDescription(''); setWoRoom('');
                } catch (e) { toast.fail(e); }
              }}>
              Raise work order
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <Field label="Title" required>
            <TextInput value={woTitle} onChange={setWoTitle} placeholder="e.g. Air conditioning not cooling" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Room">
              <Select value={woRoom} onChange={setWoRoom} options={[
                { label: 'Not room-specific', value: '' },
                ...(board.data?.rooms ?? []).map((r) => ({ label: `Room ${r.number}`, value: r.id })),
              ]} />
            </Field>
            <Field label="Category">
              <Select value={woCategory} onChange={setWoCategory} options={[
                { label: 'Maintenance', value: 'maintenance' },
                { label: 'Electrical', value: 'electrical' },
                { label: 'Plumbing', value: 'plumbing' },
                { label: 'HVAC', value: 'hvac' },
                { label: 'Furniture', value: 'furniture' },
                { label: 'IT / network', value: 'it' },
              ]} />
            </Field>
          </div>
          <Field label="Priority">
            <Select value={woPriority} onChange={setWoPriority} options={[
              { label: 'Low', value: 'low' }, { label: 'Normal', value: 'normal' }, { label: 'High', value: 'high' },
            ]} />
          </Field>
          <Field label="Description">
            <textarea value={woDescription} onChange={(e) => setWoDescription(e.target.value)} rows={3}
              className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-black/40" />
          </Field>
        </div>
      </Modal>

      <Modal open={blockOpen} onClose={() => setBlockOpen(false)} title="Take a room out of order"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBlockOpen(false)}>Cancel</Button>
            <Button disabled={!blockRoomId || !blockReason.trim() || blockRoom.isPending}
              onClick={async () => {
                try {
                  await blockRoom.mutateAsync({
                    roomId: blockRoomId, kind: blockKind,
                    fromDate: blockFrom, toDate: blockTo, reason: blockReason.trim(),
                  });
                  toast.success('Room blocked');
                  setBlockOpen(false); setBlockReason(''); setBlockRoomId('');
                } catch (e) { toast.fail(e, 'Could not block the room'); }
              }}>
              Block room
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <Field label="Room" required>
            <Select value={blockRoomId} onChange={setBlockRoomId} options={[
              { label: 'Select a room', value: '' },
              ...(board.data?.rooms ?? []).map((r) => ({
                label: `${r.number} · ${r.roomType} · ${r.status}`, value: r.id,
              })),
            ]} />
          </Field>
          <Field label="Kind" hint="Out of order leaves the occupancy denominator; out of service stays in it">
            <Select value={blockKind} onChange={(v) => setBlockKind(v as 'OOO' | 'OOS')} options={[
              { label: 'Out of order (OOO)', value: 'OOO' },
              { label: 'Out of service (OOS)', value: 'OOS' },
            ]} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" required><DateInput value={blockFrom} onChange={setBlockFrom} /></Field>
            <Field label="To" required hint="Exclusive — the room returns on this date">
              <DateInput value={blockTo} onChange={setBlockTo} min={blockFrom} />
            </Field>
          </div>
          <Field label="Reason" required>
            <TextInput value={blockReason} onChange={setBlockReason} placeholder="e.g. bathroom refurbishment" />
          </Field>
          <p className="text-[11px] text-dash-muted">
            Blocking is refused if the room has reservations inside the window — move them first.
          </p>
        </div>
      </Modal>

      <Modal open={lfOpen} onClose={() => setLfOpen(false)} title="Log a lost & found item"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setLfOpen(false)}>Cancel</Button>
            <Button disabled={!lfDescription.trim() || createLostFound.isPending}
              onClick={async () => {
                try {
                  await createLostFound.mutateAsync({
                    description: lfDescription.trim(),
                    roomId: lfRoom || undefined,
                    storageRef: lfStorage || undefined,
                    foundOn: date || undefined,
                  });
                  toast.success('Item logged');
                  setLfOpen(false); setLfDescription(''); setLfStorage(''); setLfRoom('');
                } catch (e) { toast.fail(e); }
              }}>
              Log item
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <Field label="Description" required>
            <TextInput value={lfDescription} onChange={setLfDescription} placeholder="e.g. black leather wallet" />
          </Field>
          <Field label="Found in room">
            <Select value={lfRoom} onChange={setLfRoom} options={[
              { label: 'Not room-specific', value: '' },
              ...(board.data?.rooms ?? []).map((r) => ({ label: `Room ${r.number}`, value: r.id })),
            ]} />
          </Field>
          <Field label="Storage reference">
            <TextInput value={lfStorage} onChange={setLfStorage} placeholder="e.g. LF box 3" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!releaseTarget}
        title="Release this room block?"
        body="The room returns to sellable inventory and becomes Vacant Dirty."
        confirmLabel="Release"
        busy={releaseBlock.isPending}
        onCancel={() => setReleaseTarget(null)}
        onConfirm={async () => {
          if (!releaseTarget) return;
          try {
            await releaseBlock.mutateAsync({ id: releaseTarget });
            toast.success('Room released');
          } catch (e) { toast.fail(e); }
          setReleaseTarget(null);
        }}
      />
    </div>
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
      <p className="text-[12px] font-semibold">{value}</p>
    </div>
  );
}
