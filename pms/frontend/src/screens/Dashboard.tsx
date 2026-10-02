import { useMemo } from 'react';
import {
  LogIn, LogOut, Bed, Sparkles, TrendingUp, AlertTriangle, Moon, Wrench,
  RadioTower, ArrowRight, Users,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar,
} from 'recharts';
import { useNav } from '../nav';
import { useDashboard } from '../queries';
import { useAuthStore } from '../stores';
import { Card, StatCard, Pill, Button, SectionHeader } from '../ui';
import { QueryState, OccupancyBar, statusTone } from '../components';
import { money, moneyShort, pct, dayName } from '../format';

export function DashboardScreen() {
  const { navigate } = useNav();
  const user = useAuthStore((s) => s.user);
  const property = useAuthStore((s) => s.property);
  const dashboard = useDashboard();

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }, []);

  return (
    <div>
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1">
            {property?.name} · business date {property?.businessDate}
          </p>
          <h1 className="text-[26px] font-bold tracking-tight">
            {greeting}, {user?.name.split(' ')[0]}
          </h1>
        </div>
        {/* Arrivals · Departures · Reports is wider than a small phone, so the
            row wraps instead of pushing Reports off the screen. */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" icon={<LogIn className="w-3.5 h-3.5" />} onClick={() => navigate('arrivals')}>
            Arrivals
          </Button>
          <Button variant="secondary" icon={<LogOut className="w-3.5 h-3.5" />} onClick={() => navigate('departures')}>
            Departures
          </Button>
          <Button icon={<TrendingUp className="w-3.5 h-3.5" />} onClick={() => navigate('reports')}>
            Reports
          </Button>
        </div>
      </div>

      <QueryState query={dashboard} loadingRows={6}>
        {(data) => {
          const s = data.snapshot;
          const alerts = data.alerts;
          const chartData = data.forecast7.map((p) => ({
            label: `${dayName(p.date)} ${p.date.slice(8)}`,
            occupancy: Math.round(p.occupancyBp / 100),
            revenue: p.roomRevenueMinor / 100,
            sold: p.roomsSold,
          }));

          const totalAlerts =
            alerts.unassignedArrivals + alerts.dirtyRooms + alerts.openWorkOrders
            + alerts.channelConflicts + alerts.nightAuditBlockers;

          const noInventory = s.rooms.physical === 0;

          return (
            <>
              {noInventory && (
                <Card tone="yellow" className="mb-3">
                  <p className="text-[13px] font-bold mb-1">This property has no rooms yet</p>
                  <p className="text-[11px] text-dash-muted mb-3">
                    Add room types and rooms in Configuration before taking reservations —
                    availability, rates and the night audit all build on them.
                  </p>
                  <Button size="sm" onClick={() => navigate('config')}>Open configuration</Button>
                </Card>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <StatCard
                  label="Occupancy tonight"
                  value={pct(s.occupancyBp, 0)}
                  suffix={`${s.rooms.sold}/${s.rooms.denominator}`}
                  tone="yellow"
                  icon={<Bed className="w-4 h-4" />}
                />
                <StatCard label="ADR" value={moneyShort(s.adrMinor)} tone="mint" icon={<TrendingUp className="w-4 h-4" />} />
                <StatCard label="RevPAR" value={moneyShort(s.revparMinor)} tone="sky" icon={<TrendingUp className="w-4 h-4" />} />
                <StatCard
                  label="In-house guests"
                  value={s.inHouseGuests}
                  suffix={`${s.inHouse} rooms`}
                  tone="lilac"
                  icon={<Users className="w-4 h-4" />}
                />
              </div>

              <div className="grid lg:grid-cols-3 gap-3 mb-3">
                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">Arrivals</p>
                  <div className="flex items-end gap-2 mb-2">
                    <p className="text-[26px] font-black leading-none">{s.arrivals.due}</p>
                    <p className="text-[11px] text-dash-muted mb-1">still to arrive</p>
                  </div>
                  <p className="text-[11px] text-dash-muted mb-3">{s.arrivals.done} of {s.arrivals.total} checked in</p>
                  <OccupancyBar bp={s.arrivals.total ? (s.arrivals.done / s.arrivals.total) * 10000 : 0} />
                  <button onClick={() => navigate('arrivals')} className="mt-3 text-[11px] font-bold flex items-center gap-1 hover:gap-2 transition-all">
                    Open arrivals <ArrowRight className="w-3 h-3" />
                  </button>
                </Card>

                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">Departures</p>
                  <div className="flex items-end gap-2 mb-2">
                    <p className="text-[26px] font-black leading-none">{s.departures.due}</p>
                    <p className="text-[11px] text-dash-muted mb-1">still to leave</p>
                  </div>
                  <p className="text-[11px] text-dash-muted mb-3">{s.departures.done} of {s.departures.total} checked out</p>
                  <OccupancyBar bp={s.departures.total ? (s.departures.done / s.departures.total) * 10000 : 0} />
                  <button onClick={() => navigate('departures')} className="mt-3 text-[11px] font-bold flex items-center gap-1 hover:gap-2 transition-all">
                    Open departures <ArrowRight className="w-3 h-3" />
                  </button>
                </Card>

                <Card tone="cream">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">Today's ledger</p>
                  <div className="space-y-2">
                    <Row label="Room revenue posted" value={money(s.roomRevenueMinor)} />
                    <Row label="Other revenue" value={money(s.otherRevenueMinor)} />
                    <Row label="Payments taken" value={money(s.paymentsMinor)} />
                    <Row label="In-house balances" value={money(s.outstandingBalanceMinor)} strong={s.outstandingBalanceMinor > 0} />
                  </div>
                  <button onClick={() => navigate('cashier')} className="mt-3 text-[11px] font-bold flex items-center gap-1 hover:gap-2 transition-all">
                    Open cashier <ArrowRight className="w-3 h-3" />
                  </button>
                </Card>
              </div>

              {totalAlerts > 0 && (
                <Card className="mb-3">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-status-warn" />
                    <p className="text-[12px] font-bold">Needs attention</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {alerts.unassignedArrivals > 0 && (
                      <AlertChip icon={<Bed className="w-3 h-3" />}
                        label={`${alerts.unassignedArrivals} arrival${alerts.unassignedArrivals > 1 ? 's' : ''} without a room`}
                        onClick={() => navigate('arrivals')} />
                    )}
                    {alerts.dirtyRooms > 0 && (
                      <AlertChip icon={<Sparkles className="w-3 h-3" />}
                        label={`${alerts.dirtyRooms} dirty room${alerts.dirtyRooms > 1 ? 's' : ''} to clean`}
                        onClick={() => navigate('housekeeping')} />
                    )}
                    {alerts.openWorkOrders > 0 && (
                      <AlertChip icon={<Wrench className="w-3 h-3" />}
                        label={`${alerts.openWorkOrders} open work order${alerts.openWorkOrders > 1 ? 's' : ''}`}
                        onClick={() => navigate('housekeeping')} />
                    )}
                    {alerts.channelConflicts > 0 && (
                      <AlertChip icon={<RadioTower className="w-3 h-3" />}
                        label={`${alerts.channelConflicts} channel booking${alerts.channelConflicts > 1 ? 's' : ''} unmapped`}
                        onClick={() => navigate('channel-manager')} />
                    )}
                    {alerts.nightAuditBlockers > 0 && (
                      <AlertChip icon={<Moon className="w-3 h-3" />}
                        label={`${alerts.nightAuditBlockers} night-audit blocker${alerts.nightAuditBlockers > 1 ? 's' : ''}`}
                        onClick={() => navigate('night-audit')} />
                    )}
                  </div>
                </Card>
              )}

              <div className="grid lg:grid-cols-3 gap-3 mb-3">
                <Card className="lg:col-span-2">
                  <SectionHeader eyebrow="Next 7 days" title="Occupancy & room revenue"
                    action={<Pill tone="grey">On the books</Pill>} />
                  <div className="h-[210px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                        <defs>
                          <linearGradient id="occFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#111" stopOpacity={0.18} />
                            <stop offset="100%" stopColor="#111" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 4" stroke="rgba(0,0,0,0.06)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                        <Tooltip contentStyle={{ borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', fontSize: 11 }}
                          formatter={(value: any) => [`${value}%`, 'Occupancy']} />
                        <Area type="monotone" dataKey="occupancy" stroke="#111" strokeWidth={2} fill="url(#occFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-[100px] mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="2 4" stroke="rgba(0,0,0,0.06)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', fontSize: 11 }}
                          formatter={(value: any) => [money(Math.round(Number(value) * 100)), 'Room revenue']} />
                        <Bar dataKey="revenue" fill="#FFD84D" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card>
                  <SectionHeader eyebrow="Housekeeping" title="Tomorrow" />
                  <div className="space-y-2.5">
                    <Row label="Departure cleans" value={String(data.housekeeping.departureCleans)} />
                    <Row label="Stayover cleans" value={String(data.housekeeping.stayoverCleans)} />
                    <Row label="Arrivals to prepare" value={String(data.housekeeping.arrivals)} />
                    <div className="border-t subtle-divider pt-2.5">
                      <Row label="Total credits" value={String(data.housekeeping.totalCredits)} strong />
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" className="mt-4 w-full"
                    icon={<Sparkles className="w-3 h-3" />} onClick={() => navigate('housekeeping')}>
                    Housekeeping board
                  </Button>
                </Card>
              </div>

              <div className="grid lg:grid-cols-2 gap-3">
                <Card>
                  <SectionHeader eyebrow="Front desk" title="Arriving today" count={data.topArrivals.length}
                    action={<Button size="sm" variant="ghost" onClick={() => navigate('arrivals')}>See all</Button>} />
                  {data.topArrivals.length === 0 && (
                    <p className="text-[12px] text-dash-muted py-6 text-center">No arrivals left today.</p>
                  )}
                  <div className="space-y-1.5">
                    {data.topArrivals.map((r) => (
                      <button key={r.id} onClick={() => navigate('check-in', { reservationId: r.id })}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-dash-bg text-left">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[12px] font-bold truncate">{r.guest}</p>
                            {r.vip && <Pill tone="yellow" solid>VIP</Pill>}
                          </div>
                          <p className="text-[10px] text-dash-muted">
                            {r.roomType} · {r.nights}n · {r.eta ? `ETA ${r.eta}` : 'no ETA'}
                            {r.room ? ` · room ${r.room}` : ' · unassigned'}
                          </p>
                        </div>
                        <Pill tone={statusTone(r.status)}>{r.status}</Pill>
                      </button>
                    ))}
                  </div>
                </Card>

                <Card>
                  <SectionHeader eyebrow="Front desk" title="Departing today" count={data.topDepartures.length}
                    action={<Button size="sm" variant="ghost" onClick={() => navigate('departures')}>See all</Button>} />
                  {data.topDepartures.length === 0 && (
                    <p className="text-[12px] text-dash-muted py-6 text-center">Everyone has checked out.</p>
                  )}
                  <div className="space-y-1.5">
                    {data.topDepartures.map((r) => (
                      <button key={r.id} onClick={() => navigate('check-out', { reservationId: r.id })}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-dash-bg text-left">
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold truncate">{r.guest}</p>
                          <p className="text-[10px] text-dash-muted">Room {r.room ?? '—'} · {r.confirmation}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-[12px] font-bold ${r.balanceMinor > 0 ? 'text-status-bad' : 'text-status-ok'}`}>
                            {money(r.balanceMinor)}
                          </p>
                          <p className="text-[9px] text-dash-muted">balance</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </Card>
              </div>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-dash-muted">{label}</span>
      <span className={`text-[12px] tabular-nums ${strong ? 'font-black' : 'font-bold'}`}>{value}</span>
    </div>
  );
}

function AlertChip({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-dash-peach/60 border border-black/5 text-[11px] font-bold hover:bg-dash-peach transition-colors">
      {icon}{label}<ArrowRight className="w-3 h-3" />
    </button>
  );
}
