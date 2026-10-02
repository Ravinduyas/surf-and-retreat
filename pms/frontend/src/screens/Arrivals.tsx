import { useState, useMemo } from 'react';
import { LogIn, Search, Bed, UserPlus, AlertTriangle, Wand2, Check } from 'lucide-react';
import { useNav } from '../nav';
import { useFrontDesk, useAssignRoom, useCheckIn, useMarkNoShow } from '../queries';
import { ReportAfterNoShowModal } from './ChannelReport';
import { useAuthStore } from '../stores';
import { Card, Pill, Button, SectionHeader, Tabs, DataGrid, type GridCol } from '../ui';
import { QueryState, useToast, ConfirmDialog, PermissionButton } from '../components';
import { ConfirmBookingModal } from '../confirmbooking';
import { money, shortDate } from '../format';
import { statusTone } from '../components';
import type { FrontDeskRow } from '../types';

export function ArrivalsScreen() {
  const { navigate } = useNav();
  const toast = useToast();
  const property = useAuthStore((s) => s.property);
  const frontDesk = useFrontDesk();
  const assignRoom = useAssignRoom();
  const checkIn = useCheckIn();
  const noShow = useMarkNoShow();

  const [tab, setTab] = useState<'due' | 'arrived'>('due');
  const [search, setSearch] = useState('');
  const [noShowTarget, setNoShowTarget] = useState<FrontDeskRow | null>(null);
  const [reportTarget, setReportTarget] = useState<FrontDeskRow | null>(null);
  const [confirmId, setConfirmId] = useState<string | undefined>();

  const filter = (rows: FrontDeskRow[]) => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.guest.toLowerCase().includes(q)
      || r.confirmation.toLowerCase().includes(q)
      || (r.room ?? '').toLowerCase().includes(q));
  };

  async function autoAssign(row: FrontDeskRow) {
    try {
      await assignRoom.mutateAsync({ id: row.id, body: { auto: true } });
      toast.success(`Room assigned to ${row.guest}`);
    } catch (e) {
      toast.fail(e, 'Could not assign a room');
    }
  }

  async function quickCheckIn(row: FrontDeskRow) {
    try {
      const res = await checkIn.mutateAsync({ id: row.id, body: {} });
      toast.success(`${row.guest} checked into room ${res.room}`);
    } catch (e) {
      toast.fail(e, 'Check-in failed');
    }
  }

  const cols: GridCol<FrontDeskRow>[] = useMemo(() => [
    {
      key: 'guest', header: 'Guest', width: '24%',
      render: (r) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold truncate">{r.guest}</span>
            {r.vip && <Pill tone="yellow" solid>VIP</Pill>}
          </div>
          <p className="text-[10px] text-dash-muted">{r.confirmation} · {r.source}{r.channel ? ` · ${r.channel}` : ''}</p>
        </div>
      ),
    },
    {
      key: 'stay', header: 'Stay',
      render: (r) => (
        <div>
          <p className="font-semibold">{shortDate(r.arrival)} → {shortDate(r.departure)}</p>
          <p className="text-[10px] text-dash-muted">{r.nights} night{r.nights > 1 ? 's' : ''} · {r.adults}A{r.children ? ` ${r.children}C` : ''}</p>
        </div>
      ),
    },
    {
      key: 'roomType', header: 'Room type',
      render: (r) => <span className="font-semibold">{r.roomType}</span>,
    },
    {
      key: 'room', header: 'Room',
      render: (r) => r.room
        ? (
          <div>
            <span className="font-bold">{r.room}</span>
            {r.roomStatus && (
              <p className={`text-[10px] ${r.roomStatus === 'Vacant Dirty' ? 'text-status-warn' : 'text-dash-muted'}`}>
                {r.roomStatus}
              </p>
            )}
          </div>
        )
        : <Pill tone="peach">Unassigned</Pill>,
    },
    { key: 'eta', header: 'ETA', render: (r) => <span className="text-dash-muted">{r.eta ?? '—'}</span> },
    {
      key: 'balance', header: 'Balance', align: 'right',
      render: (r) => <span className="tabular-nums font-semibold">{money(r.balanceMinor)}</span>,
    },
    {
      key: 'actions', header: '', align: 'right', width: '1%',
      render: (r) => (
        <div className="flex items-center gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
          {tab === 'due' && (
            <>
              {!r.room && (
                <PermissionButton permission="frontdesk.write" size="sm" variant="secondary"
                  icon={<Wand2 className="w-3 h-3" />} onClick={() => autoAssign(r)}
                  disabled={assignRoom.isPending}>
                  Assign
                </PermissionButton>
              )}
              <PermissionButton permission="frontdesk.write" size="sm"
                icon={<LogIn className="w-3 h-3" />}
                onClick={() => navigate('check-in', { reservationId: r.id })}>
                Check in
              </PermissionButton>
            </>
          )}
          {tab === 'arrived' && (
            <Button size="sm" variant="secondary" onClick={() => navigate('guest-dashboard', { reservationId: r.id })}>
              Open
            </Button>
          )}
        </div>
      ),
    },
  ], [tab, assignRoom.isPending, checkIn.isPending]);

  return (
    <div>
      <SectionHeader
        eyebrow={`Business date ${property?.businessDate ?? ''}`}
        title="Arrivals"
        action={
          <div className="flex gap-2">
            <PermissionButton permission="frontdesk.write" variant="secondary"
              icon={<UserPlus className="w-3.5 h-3.5" />} onClick={() => navigate('new-reservation')}>
              Walk-in
            </PermissionButton>
          </div>
        }
      />

      <QueryState query={frontDesk} loadingRows={5}>
        {(data) => {
          const due = filter(data.arrivals);
          const arrived = filter(data.arrived);
          const rows = tab === 'due' ? due : arrived;
          const unassigned = data.arrivals.filter((r) => !r.room).length;
          const notReady = data.arrivals.filter((r) => r.roomStatus === 'Vacant Dirty').length;
          const toConfirm = data.awaitingConfirmation ?? [];

          return (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Card tone="yellow"><Metric label="Due to arrive" value={data.arrivals.length} /></Card>
                <Card tone="mint"><Metric label="Checked in" value={data.arrived.length} /></Card>
                <Card tone={unassigned ? 'peach' : 'plain'}><Metric label="No room assigned" value={unassigned} /></Card>
                <Card tone={notReady ? 'peach' : 'plain'}><Metric label="Room not ready" value={notReady} /></Card>
              </div>

              {/*
                Website bookings arriving today that nobody has accepted. They
                are deliberately not in "Due to arrive" — they have no room and
                cannot be checked in — but a guest turning up at the desk is not
                helped by the booking being invisible, so they are listed here
                with the one action that does apply.
              */}
              {toConfirm.length > 0 && (
                <Card tone="peach" className="mb-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <div>
                      <p className="text-[13px] font-bold mb-0.5">
                        {toConfirm.length} website booking{toConfirm.length === 1 ? '' : 's'} arriving
                        today still awaiting confirmation
                      </p>
                      <p className="text-[11px] text-dash-muted">
                        These hold no room yet. Confirm one to pick its room or beds — then it joins
                        the arrivals list and can be checked in.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {toConfirm.map((r) => (
                      <div key={r.id}
                        className="flex items-center justify-between gap-3 flex-wrap bg-white/70 rounded-xl px-3 py-2">
                        <div className="min-w-0">
                          <span className="text-[12px] font-bold">{r.guest}</span>
                          <span className="text-[10px] text-dash-muted ml-2">
                            {r.confirmation} · {r.roomType} · {shortDate(r.arrival)} →{' '}
                            {shortDate(r.departure)}
                          </span>
                        </div>
                        <PermissionButton
                          permission="reservations.write"
                          size="sm"
                          icon={<Check className="w-3 h-3" />}
                          onClick={() => setConfirmId(r.id)}
                        >
                          Confirm
                        </PermissionButton>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {notReady > 0 && (
                <div className="mb-4 rounded-2xl bg-dash-peach/50 border border-black/5 p-3 flex items-start gap-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-status-warn mt-0.5 shrink-0" />
                  <p className="text-[11px] leading-relaxed">
                    {notReady} arriving guest{notReady > 1 ? 's have' : ' has'} a room that housekeeping has not
                    released yet. Check-in will be blocked until the room is clean — mark it clean on the
                    <button onClick={() => navigate('housekeeping')} className="font-bold underline mx-1">housekeeping board</button>
                    or move the guest to another room.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <Tabs
                  tabs={[
                    { value: 'due', label: 'Due to arrive', count: due.length },
                    { value: 'arrived', label: 'Checked in', count: arrived.length },
                  ]}
                  active={tab}
                  onChange={setTab}
                />
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-dash-muted" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter by guest, confirmation or room…"
                    className="w-full bg-white border border-black/10 rounded-full pl-9 pr-4 py-2 text-[12px] outline-none focus:border-black/30"
                  />
                </div>
              </div>

              <DataGrid
                rows={rows}
                cols={cols}
                onRowClick={(r) => navigate(tab === 'due' ? 'check-in' : 'guest-dashboard', { reservationId: r.id })}
                emptyTitle={tab === 'due' ? 'No arrivals outstanding' : 'Nobody has checked in yet today'}
              />

              {tab === 'due' && due.length > 0 && (
                <div className="mt-4 flex justify-end">
                  <PermissionButton
                    permission="frontdesk.write"
                    variant="secondary"
                    size="sm"
                    icon={<Bed className="w-3 h-3" />}
                    disabled={assignRoom.isPending || unassigned === 0}
                    onClick={async () => {
                      const targets = data.arrivals.filter((r) => !r.room);
                      let ok = 0;
                      let failed = 0;
                      for (const t of targets) {
                        try {
                          await assignRoom.mutateAsync({ id: t.id, body: { auto: true } });
                          ok++;
                        } catch { failed++; }
                      }
                      if (failed === 0) toast.success(`${ok} room${ok === 1 ? '' : 's'} assigned`);
                      else toast.push({
                        kind: 'warn',
                        title: `${ok} assigned, ${failed} could not be`,
                        body: 'The remaining guests have no free room of their type — try a room move or an upgrade.',
                      });
                    }}
                  >
                    Auto-assign all unassigned ({unassigned})
                  </PermissionButton>
                </div>
              )}
            </>
          );
        }}
      </QueryState>

      <ConfirmBookingModal
        reservationId={confirmId}
        open={!!confirmId}
        onClose={() => setConfirmId(undefined)}
      />

      <ConfirmDialog
        open={!!noShowTarget}
        title={`Mark ${noShowTarget?.guest} as a no-show?`}
        body="The room is released back to inventory and the property's no-show charge is posted to the folio."
        confirmLabel="Mark no-show"
        danger
        busy={noShow.isPending}
        onCancel={() => setNoShowTarget(null)}
        onConfirm={async () => {
          if (!noShowTarget) return;
          try {
            await noShow.mutateAsync({ id: noShowTarget.id });
            toast.success(`${noShowTarget.guest} marked as a no-show`);
            // Marking it here is only the property's half. A booking that came
            // through an OTA has to be reported, or the channel keeps its
            // commission — so offer that immediately rather than leaving it to
            // be remembered.
            if (noShowTarget.channel) setReportTarget(noShowTarget);
          } catch (e) {
            toast.fail(e);
          }
          setNoShowTarget(null);
        }}
      />

      <ReportAfterNoShowModal
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        reservation={reportTarget && {
          id: reportTarget.id, confirmation: reportTarget.confirmation, guest: reportTarget.guest,
        }}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-2">{label}</p>
      <p className="text-[26px] font-black leading-none">{value}</p>
    </>
  );
}
