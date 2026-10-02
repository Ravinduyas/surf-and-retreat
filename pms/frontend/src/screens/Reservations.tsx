import { useState, useMemo } from 'react';
import { Search, Plus, Filter, Download, Check } from 'lucide-react';
import { useNav } from '../nav';
import { useReservations, useRoomTypes } from '../queries';
import { useAuthStore } from '../stores';
import { Card, Pill, Button, SectionHeader, DataGrid, Field, Select, type GridCol } from '../ui';
import { QueryState, PermissionButton, statusTone, DateInput } from '../components';
import { ConfirmBookingModal } from '../confirmbooking';
import { HostelworldBadge, hostelworldSplit } from '../hostelworld';
import { money, shortDate, addDays } from '../format';
import type { Reservation, ReservationStatus } from '../types';

const STATUSES: ReservationStatus[] = [
  'Tentative', 'Confirmed', 'Guaranteed', 'Checked-in', 'Checked-out', 'Cancelled', 'No-show',
];

export function ReservationsScreen() {
  const { navigate } = useNav();
  const property = useAuthStore((s) => s.property);
  const roomTypes = useRoomTypes();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [roomTypeId, setRoomTypeId] = useState('');
  const [arrivalFrom, setArrivalFrom] = useState('');
  const [arrivalTo, setArrivalTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  // Which booking the confirm dialog is open for, if any.
  const [confirmId, setConfirmId] = useState<string | undefined>();
  const [onlyPending, setOnlyPending] = useState(false);

  const filters = useMemo(() => ({
    search: search.trim() || undefined,
    status: status || undefined,
    roomTypeId: roomTypeId || undefined,
    arrivalFrom: arrivalFrom || undefined,
    arrivalTo: arrivalTo || undefined,
    limit: 500,
  }), [search, status, roomTypeId, arrivalFrom, arrivalTo]);

  const reservations = useReservations(filters);

  const cols: GridCol<Reservation>[] = [
    {
      key: 'guest', header: 'Guest', width: '22%',
      render: (r) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold truncate">{r.guest}</span>
            {r.vip && <Pill tone="yellow" solid>VIP</Pill>}
          </div>
          <p className="text-[10px] text-dash-muted font-mono">{r.confirmation}</p>
        </div>
      ),
    },
    {
      key: 'stay', header: 'Stay',
      render: (r) => (
        <div>
          <p className="font-semibold whitespace-nowrap">{shortDate(r.arrival)} → {shortDate(r.departure)}</p>
          <p className="text-[10px] text-dash-muted">{r.nights}n · {r.adults}A{r.children ? ` ${r.children}C` : ''}</p>
        </div>
      ),
    },
    {
      key: 'room', header: 'Room / type',
      render: (r) => (
        <div>
          <p className="font-semibold">{r.room ?? '—'}</p>
          <p className="text-[10px] text-dash-muted">{r.roomType}</p>
        </div>
      ),
    },
    {
      key: 'rate', header: 'Rate',
      render: (r) => (
        <div>
          <p className="font-semibold tabular-nums">{money(r.rateMinor)}</p>
          <p className="text-[10px] text-dash-muted font-mono">{r.rateCode}</p>
        </div>
      ),
    },
    {
      key: 'source', header: 'Source',
      render: (r) => (
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-semibold">{r.source}</p>
            {r.hostelworld && <HostelworldBadge compact />}
          </div>
          {(r.otaChannel || r.channel) && (
            <p className="text-[10px] text-dash-muted">
              {r.otaChannel && r.otaChannel !== r.channel ? `${r.otaChannel} · ${r.channel ?? ''}` : r.channel}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'total', header: 'Total', align: 'right',
      // A Hostelworld booking with the split on shows what the property
      // receives under the total, so the list answers "what is this worth to
      // us" without opening every booking.
      render: (r) => {
        const split = hostelworldSplit(r);
        return (
          <div>
            <p className="tabular-nums font-semibold">{money(r.totalMinor)}</p>
            {split && (
              <p className="text-[10px] tabular-nums whitespace-nowrap">
                <span className="text-orange-600">−{money(split.collectedMinor)} HW</span>
                <span className="text-dash-muted"> · </span>
                <span className="font-bold">{money(split.businessMinor)}</span>
              </p>
            )}
          </div>
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
      key: 'status', header: 'Status', align: 'right',
      // A website booking waiting on a person reads as its own thing rather
      // than as "Tentative". The status underneath is Tentative either way —
      // what a person needs to see is that this one is theirs to action.
      render: (r) => (r.awaitingConfirmation
        ? <Pill tone="yellow" solid>Awaiting confirmation</Pill>
        : <Pill tone={statusTone(r.status)}>{r.status}</Pill>),
    },
    {
      key: 'confirm', header: '', align: 'right', width: '1%',
      render: (r) => (r.awaitingConfirmation ? (
        // Stops the click reaching the row, which would navigate away to the
        // guest dashboard instead of opening the dialog.
        <span onClick={(e) => e.stopPropagation()}>
          <PermissionButton
            permission="reservations.write"
            size="sm"
            icon={<Check className="w-3 h-3" />}
            onClick={() => setConfirmId(r.id)}
          >
            Confirm
          </PermissionButton>
        </span>
      ) : null),
    },
  ];

  function exportCsv(rows: Reservation[]) {
    const header = [
      'Confirmation', 'Guest', 'Status', 'Arrival', 'Departure', 'Nights', 'Adults', 'Children',
      'Room', 'Room type', 'Rate plan', 'Total', 'Hostelworld collected', 'Business price',
      'Balance', 'Source', 'Channel', 'OTA',
    ];
    const lines = rows.map((r) => {
      const split = hostelworldSplit(r);
      return [
        r.confirmation, r.guest, r.status, r.arrival, r.departure, r.nights, r.adults, r.children,
        r.room ?? '', r.roomType, r.rateCode, (r.totalMinor / 100).toFixed(2),
        split ? (split.collectedMinor / 100).toFixed(2) : '',
        split ? (split.businessMinor / 100).toFixed(2) : '',
        (r.balanceMinor / 100).toFixed(2), r.source, r.channel ?? '', r.otaChannel ?? '',
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reservations-${property?.code ?? 'export'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const active = [status, roomTypeId, arrivalFrom, arrivalTo].filter(Boolean).length;

  return (
    <div>
      <SectionHeader
        eyebrow={`Business date ${property?.businessDate ?? ''}`}
        title="Reservations"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Filter className="w-3.5 h-3.5" />}
              onClick={() => setShowFilters((v) => !v)}>
              Filters{active ? ` (${active})` : ''}
            </Button>
            <PermissionButton permission="reservations.write" icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => navigate('new-reservation')}>
              New reservation
            </PermissionButton>
          </div>
        }
      />

      <div className="relative mb-4">
        <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-dash-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search guest, confirmation, email, phone, room or OTA reference…"
          className="w-full bg-white border border-black/10 rounded-full pl-9 pr-4 py-2.5 text-[12px] outline-none focus:border-black/30"
        />
      </div>

      {showFilters && (
        <Card className="mb-4">
          <div className="grid md:grid-cols-4 gap-3">
            <Field label="Status">
              <Select value={status} onChange={setStatus}
                options={[{ label: 'All statuses', value: '' }, ...STATUSES.map((s) => ({ label: s, value: s }))]} />
            </Field>
            <Field label="Room type">
              <Select value={roomTypeId} onChange={setRoomTypeId}
                options={[
                  { label: 'All room types', value: '' },
                  ...(roomTypes.data ?? []).map((rt) => ({ label: rt.name, value: rt.id })),
                ]} />
            </Field>
            <Field label="Arriving from">
              <DateInput value={arrivalFrom} onChange={setArrivalFrom} />
            </Field>
            <Field label="Arriving to">
              <DateInput value={arrivalTo} onChange={setArrivalTo} />
            </Field>
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="ghost"
              onClick={() => { setStatus(''); setRoomTypeId(''); setArrivalFrom(''); setArrivalTo(''); }}>
              Clear filters
            </Button>
            <Button size="sm" variant="ghost"
              onClick={() => {
                const today = property?.businessDate ?? '';
                setArrivalFrom(today); setArrivalTo(addDays(today, 30)); setStatus('');
              }}>
              Next 30 days
            </Button>
          </div>
        </Card>
      )}

      <QueryState query={reservations} loadingRows={8} empty="No reservations match these filters">
        {(rows) => {
          const pendingCount = rows.filter((r) => r.awaitingConfirmation).length;
          const shown = onlyPending ? rows.filter((r) => r.awaitingConfirmation) : rows;
          return (
            <>
              {pendingCount > 0 && (
                <Card tone="yellow" className="mb-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-[13px] font-bold mb-0.5">
                        {pendingCount} website booking{pendingCount === 1 ? '' : 's'} awaiting
                        confirmation
                      </p>
                      <p className="text-[11px] text-dash-muted">
                        These hold no inventory and cannot be checked in. Confirming one picks its
                        room or beds and closes the dates on the calendar.
                      </p>
                    </div>
                    <Button size="sm" variant={onlyPending ? 'primary' : 'secondary'}
                      onClick={() => setOnlyPending((v) => !v)}>
                      {onlyPending ? 'Show all reservations' : 'Show only these'}
                    </Button>
                  </div>
                </Card>
              )}

              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-dash-muted">
                  {shown.length} reservation{shown.length === 1 ? '' : 's'}
                  {rows.length === 500 && ' (showing the first 500 — narrow the filters)'}
                </p>
                <Button size="sm" variant="ghost" icon={<Download className="w-3 h-3" />}
                  onClick={() => exportCsv(shown)}>
                  Export CSV
                </Button>
              </div>
              <DataGrid
                rows={shown}
                cols={cols}
                onRowClick={(r) => navigate('guest-dashboard', { reservationId: r.id })}
                emptyTitle="No reservations match these filters"
              />
            </>
          );
        }}
      </QueryState>

      <ConfirmBookingModal
        reservationId={confirmId}
        open={!!confirmId}
        onClose={() => setConfirmId(undefined)}
      />
    </div>
  );
}
