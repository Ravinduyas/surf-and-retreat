import { useState, useMemo } from 'react';
import { Search, LogOut, DollarSign, Clock } from 'lucide-react';
import { useNav } from '../nav';
import { useFrontDesk, useCheckOut } from '../queries';
import { useAuthStore } from '../stores';
import { Card, Pill, Button, SectionHeader, Tabs, DataGrid, type GridCol } from '../ui';
import { QueryState, useToast, PermissionButton } from '../components';
import { money, shortDate, clock } from '../format';
import type { FrontDeskRow } from '../types';

export function DeparturesScreen() {
  const { navigate } = useNav();
  const toast = useToast();
  const property = useAuthStore((s) => s.property);
  const frontDesk = useFrontDesk();
  const checkOut = useCheckOut();

  const [tab, setTab] = useState<'due' | 'departed'>('due');
  const [search, setSearch] = useState('');

  async function settleAndGo(row: FrontDeskRow) {
    if (row.balanceMinor !== 0) {
      navigate('check-out', { reservationId: row.id });
      return;
    }
    try {
      await checkOut.mutateAsync({ id: row.id, body: {} });
      toast.success(`${row.guest} checked out`);
    } catch (e) {
      toast.fail(e, 'Check-out failed');
      navigate('check-out', { reservationId: row.id });
    }
  }

  const cols: GridCol<FrontDeskRow>[] = useMemo(() => [
    { key: 'room', header: 'Room', width: '8%', render: (r) => <span className="font-black text-[13px]">{r.room ?? '—'}</span> },
    {
      key: 'guest', header: 'Guest', width: '26%',
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
          <p className="text-[10px] text-dash-muted">{r.nights} night{r.nights > 1 ? 's' : ''}</p>
        </div>
      ),
    },
    {
      key: 'etd', header: 'ETD',
      render: (r) => <span className="text-dash-muted">{r.etd ?? property?.checkOutTime ?? '—'}</span>,
    },
    {
      key: 'balance', header: 'Balance', align: 'right',
      render: (r) => (
        <div>
          <p className={`tabular-nums font-bold ${r.balanceMinor > 0 ? 'text-status-bad' : r.balanceMinor < 0 ? 'text-status-info' : 'text-status-ok'}`}>
            {money(r.balanceMinor)}
          </p>
          {r.balanceMinor > 0 && <p className="text-[9px] text-status-bad">to settle</p>}
          {r.balanceMinor < 0 && <p className="text-[9px] text-status-info">refund due</p>}
        </div>
      ),
    },
    {
      key: 'actions', header: '', align: 'right', width: '1%',
      render: (r) => (
        <div className="flex items-center gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
          {tab === 'due' ? (
            <>
              <Button size="sm" variant="secondary" icon={<DollarSign className="w-3 h-3" />}
                onClick={() => navigate('guest-dashboard', { reservationId: r.id })}>
                Folio
              </Button>
              <PermissionButton permission="frontdesk.write" size="sm" icon={<LogOut className="w-3 h-3" />}
                disabled={checkOut.isPending}
                onClick={() => settleAndGo(r)}>
                {r.balanceMinor === 0 ? 'Check out' : 'Settle'}
              </PermissionButton>
            </>
          ) : (
            <span className="text-[10px] text-dash-muted flex items-center gap-1">
              <Clock className="w-3 h-3" /> {clock(r.etd)}
            </span>
          )}
        </div>
      ),
    },
  ], [tab, checkOut.isPending, property?.checkOutTime]);

  return (
    <div>
      <SectionHeader eyebrow={`Business date ${property?.businessDate ?? ''}`} title="Departures" />

      <QueryState query={frontDesk} loadingRows={5}>
        {(data) => {
          const q = search.trim().toLowerCase();
          const apply = (rows: FrontDeskRow[]) => q
            ? rows.filter((r) => r.guest.toLowerCase().includes(q) || (r.room ?? '').includes(q)
              || r.confirmation.toLowerCase().includes(q))
            : rows;

          const due = apply(data.departures);
          const departed = apply(data.departed);
          const rows = tab === 'due' ? due : departed;
          const owing = data.departures.filter((r) => r.balanceMinor > 0);
          const owed = owing.reduce((s, r) => s + r.balanceMinor, 0);
          const readyToGo = data.departures.filter((r) => r.balanceMinor === 0);

          return (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Card tone="yellow"><Metric label="Due to depart" value={String(data.departures.length)} /></Card>
                <Card tone="mint"><Metric label="Checked out" value={String(data.departed.length)} /></Card>
                <Card tone={owed > 0 ? 'peach' : 'plain'}>
                  <Metric label="To collect" value={money(owed)} sub={`${owing.length} folio${owing.length === 1 ? '' : 's'}`} />
                </Card>
                <Card><Metric label="Settled, ready to go" value={String(readyToGo.length)} /></Card>
              </div>

              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <Tabs
                  tabs={[
                    { value: 'due', label: 'Due to depart', count: due.length },
                    { value: 'departed', label: 'Checked out', count: departed.length },
                  ]}
                  active={tab}
                  onChange={setTab}
                />
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-dash-muted" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter by guest, room or confirmation…"
                    className="w-full bg-white border border-black/10 rounded-full pl-9 pr-4 py-2 text-[12px] outline-none focus:border-black/30"
                  />
                </div>
                {tab === 'due' && readyToGo.length > 0 && (
                  <PermissionButton
                    permission="frontdesk.write"
                    size="sm"
                    variant="secondary"
                    disabled={checkOut.isPending}
                    onClick={async () => {
                      let ok = 0; let failed = 0;
                      for (const r of readyToGo) {
                        try { await checkOut.mutateAsync({ id: r.id, body: {} }); ok++; } catch { failed++; }
                      }
                      if (failed === 0) toast.success(`${ok} guest${ok === 1 ? '' : 's'} checked out`);
                      else toast.push({ kind: 'warn', title: `${ok} checked out, ${failed} need attention` });
                    }}
                  >
                    Check out all settled ({readyToGo.length})
                  </PermissionButton>
                )}
              </div>

              <DataGrid
                rows={rows}
                cols={cols}
                onRowClick={(r) => navigate(tab === 'due' ? 'check-out' : 'guest-dashboard', { reservationId: r.id })}
                emptyTitle={tab === 'due' ? 'No departures outstanding' : 'Nobody has checked out yet today'}
              />
            </>
          );
        }}
      </QueryState>
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
