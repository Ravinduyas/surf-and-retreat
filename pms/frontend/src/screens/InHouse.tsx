import { useState, useMemo } from 'react';
import { Search, ArrowRightLeft, DollarSign, LogOut, CalendarClock } from 'lucide-react';
import { StayDatesModal } from './StayDates';
import { useNav } from '../nav';
import { useFrontDesk, useFreeRooms, useMoveRoom } from '../queries';
import { useAuthStore } from '../stores';
import { Card, Pill, Button, SectionHeader, DataGrid, Modal, Field, Select, type GridCol } from '../ui';
import { QueryState, useToast, PermissionButton, statusTone } from '../components';
import { money, shortDate, nightsBetween } from '../format';
import type { FrontDeskRow } from '../types';

export function InHouseScreen() {
  const { navigate } = useNav();
  const toast = useToast();
  const property = useAuthStore((s) => s.property);
  const frontDesk = useFrontDesk();
  const moveRoom = useMoveRoom();

  const [search, setSearch] = useState('');
  const [moveTarget, setMoveTarget] = useState<FrontDeskRow | null>(null);
  const [stayTarget, setStayTarget] = useState<FrontDeskRow | null>(null);
  const [targetRoomId, setTargetRoomId] = useState('');
  const [keepRate, setKeepRate] = useState('true');

  const freeRooms = useFreeRooms(
    property?.businessDate ?? '',
    moveTarget?.departure ?? '',
    undefined,
    moveTarget?.id,
    !!moveTarget,
  );

  const cols: GridCol<FrontDeskRow>[] = useMemo(() => [
    {
      key: 'room', header: 'Room', width: '8%',
      render: (r) => <span className="font-black text-[13px]">{r.room ?? '—'}</span>,
    },
    {
      key: 'guest', header: 'Guest', width: '24%',
      render: (r) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold truncate">{r.guest}</span>
            {r.vip && <Pill tone="yellow" solid>VIP</Pill>}
          </div>
          <p className="text-[10px] text-dash-muted">{r.confirmation} · {r.roomType}</p>
        </div>
      ),
    },
    {
      key: 'stay', header: 'Stay',
      render: (r) => (
        <div>
          <p className="font-semibold">{shortDate(r.arrival)} → {shortDate(r.departure)}</p>
          <p className="text-[10px] text-dash-muted">
            {r.adults}A{r.children ? ` ${r.children}C` : ''} · {r.rateCode}
          </p>
        </div>
      ),
    },
    {
      key: 'nightsLeft', header: 'Nights left', align: 'center',
      render: (r) => {
        const left = Math.max(0, nightsBetween(property?.businessDate ?? r.arrival, r.departure));
        return (
          <Pill tone={left === 0 ? 'peach' : 'grey'}>
            {left === 0 ? 'Departing today' : `${left} left`}
          </Pill>
        );
      },
    },
    {
      key: 'balance', header: 'Balance', align: 'right',
      render: (r) => (
        <span className={`tabular-nums font-bold ${r.balanceMinor > 0 ? 'text-status-bad' : ''}`}>
          {money(r.balanceMinor)}
        </span>
      ),
    },
    {
      key: 'actions', header: '', align: 'right', width: '1%',
      render: (r) => (
        <div className="flex items-center gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
          <PermissionButton permission="reservations.write" size="sm" variant="secondary"
            icon={<CalendarClock className="w-3 h-3" />}
            onClick={() => setStayTarget(r)}>
            Extend
          </PermissionButton>
          <PermissionButton permission="frontdesk.write" size="sm" variant="secondary"
            icon={<ArrowRightLeft className="w-3 h-3" />}
            onClick={() => { setMoveTarget(r); setTargetRoomId(''); }}>
            Move
          </PermissionButton>
          <Button size="sm" variant="secondary" icon={<DollarSign className="w-3 h-3" />}
            onClick={() => navigate('guest-dashboard', { reservationId: r.id })}>
            Folio
          </Button>
          <PermissionButton permission="frontdesk.write" size="sm" icon={<LogOut className="w-3 h-3" />}
            onClick={() => navigate('check-out', { reservationId: r.id })}>
            Check out
          </PermissionButton>
        </div>
      ),
    },
  ], [property?.businessDate]);

  return (
    <div>
      <SectionHeader eyebrow={`Business date ${property?.businessDate ?? ''}`} title="In-house guests" />

      <QueryState query={frontDesk} loadingRows={5}>
        {(data) => {
          const q = search.trim().toLowerCase();
          const rows = q
            ? data.inHouse.filter((r) =>
              r.guest.toLowerCase().includes(q)
              || (r.room ?? '').toLowerCase().includes(q)
              || r.confirmation.toLowerCase().includes(q))
            : data.inHouse;

          const guests = data.inHouse.reduce((s, r) => s + r.adults + r.children, 0);
          const owing = data.inHouse.filter((r) => r.balanceMinor > 0);
          const owed = owing.reduce((s, r) => s + r.balanceMinor, 0);
          const departingToday = data.inHouse.filter((r) => r.departure === data.date).length;

          return (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Card tone="mint"><Metric label="Rooms occupied" value={String(data.inHouse.length)} /></Card>
                <Card tone="sky"><Metric label="Guests in-house" value={String(guests)} /></Card>
                <Card tone="yellow"><Metric label="Departing today" value={String(departingToday)} /></Card>
                <Card tone={owed > 0 ? 'peach' : 'plain'}>
                  <Metric label="Outstanding" value={money(owed)} sub={`${owing.length} folio${owing.length === 1 ? '' : 's'}`} />
                </Card>
              </div>

              <div className="relative mb-4">
                <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-dash-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by guest, room or confirmation…"
                  className="w-full bg-white border border-black/10 rounded-full pl-9 pr-4 py-2 text-[12px] outline-none focus:border-black/30"
                />
              </div>

              <DataGrid
                rows={rows}
                cols={cols}
                onRowClick={(r) => navigate('guest-dashboard', { reservationId: r.id })}
                emptyTitle="Nobody is in-house"
              />
            </>
          );
        }}
      </QueryState>

      <Modal
        open={!!moveTarget}
        onClose={() => setMoveTarget(null)}
        title={`Move ${moveTarget?.guest ?? ''} from room ${moveTarget?.room ?? ''}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMoveTarget(null)}>Cancel</Button>
            <Button
              disabled={!targetRoomId || moveRoom.isPending}
              onClick={async () => {
                if (!moveTarget || !targetRoomId) return;
                try {
                  await moveRoom.mutateAsync({
                    id: moveTarget.id,
                    body: { roomId: targetRoomId, keepRate: keepRate === 'true', reason: 'Guest room move' },
                  });
                  toast.success(`${moveTarget.guest} moved`);
                  setMoveTarget(null);
                } catch (e) {
                  toast.fail(e, 'Room move failed');
                }
              }}
            >
              {moveRoom.isPending ? 'Moving…' : 'Move guest'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-[12px] text-dash-muted">
            Nights from today onwards move to the new room. Already-posted nights are untouched.
          </p>
          <Field label="New room" required hint="Only rooms free for the rest of the stay are listed">
            <Select
              value={targetRoomId}
              onChange={setTargetRoomId}
              options={[
                { label: freeRooms.isLoading ? 'Loading…' : 'Select a room', value: '' },
                ...(freeRooms.data?.rooms ?? []).map((r) => ({
                  label: `${r.number} · ${r.roomType} · ${r.status}`,
                  value: r.id,
                })),
              ]}
            />
          </Field>
          {freeRooms.data && freeRooms.data.rooms.length === 0 && (
            <p className="text-[11px] text-status-bad font-semibold">
              No room is free for the whole remaining stay.
            </p>
          )}
          <Field label="Rate" hint="A different room type can be re-priced or kept at the original rate">
            <Select
              value={keepRate}
              onChange={setKeepRate}
              options={[
                { label: 'Keep the current rate', value: 'true' },
                { label: 'Re-price at the new room type', value: 'false' },
              ]}
            />
          </Field>
        </div>
      </Modal>

      <StayDatesModal
        open={!!stayTarget}
        onClose={() => setStayTarget(null)}
        reservation={stayTarget && {
          id: stayTarget.id, confirmation: stayTarget.confirmation, guest: stayTarget.guest,
          arrival: stayTarget.arrival, departure: stayTarget.departure,
          room: stayTarget.room, status: stayTarget.status,
        }}
      />
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-2">{label}</p>
      <p className="text-[24px] font-black leading-none">{value}</p>
      {sub && <p className="text-[10px] text-dash-muted mt-1.5">{sub}</p>}
    </>
  );
}
