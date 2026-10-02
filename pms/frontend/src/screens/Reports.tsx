import { useState } from 'react';
import { Download, TrendingUp, BarChart3, Clock, Wallet } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import {
  useKpis, useProduction, usePace, usePickup, useRevenueBreakdown, useDailyStats, useOutstanding,
} from '../queries';
import { useAuthStore } from '../stores';
import { Card, Pill, Button, SectionHeader, Tabs, Field, Select } from '../ui';
import { QueryState, DateInput, OccupancyBar } from '../components';
import { money, moneyShort, pct, longDate, addDays } from '../format';

const SERIES_COLORS = ['#111111', '#FFD84D', '#9BD1C4', '#C9B6E4', '#F6C6A8', '#A8C8F0', '#E9A8C8'];

export function ReportsScreen() {
  const property = useAuthStore((s) => s.property);
  const today = property?.businessDate ?? new Date().toISOString().slice(0, 10);

  const [tab, setTab] = useState<'performance' | 'production' | 'pace' | 'revenue' | 'ledger'>('performance');
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);
  const [dimension, setDimension] = useState('source');

  const kpis = useKpis(from, to);
  const production = useProduction(from, to, dimension);
  const pace = usePace(from, to);
  const pickup = usePickup(from, to);
  const revenue = useRevenueBreakdown(from, to);
  const dailyStats = useDailyStats(from, to);
  const outstanding = useOutstanding();

  function preset(days: number, future = false) {
    if (future) { setFrom(today); setTo(addDays(today, days)); }
    else { setFrom(addDays(today, -days)); setTo(today); }
  }

  function exportCsv(name: string, rows: Record<string, unknown>[]) {
    if (!rows.length) return;
    const header = Object.keys(rows[0]);
    const csv = [
      header.join(','),
      ...rows.map((r) => header.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Business intelligence"
        title="Reports"
        action={
          <Tabs
            tabs={[
              { value: 'performance', label: 'Performance' },
              { value: 'production', label: 'Production' },
              { value: 'pace', label: 'Pace & pickup' },
              { value: 'revenue', label: 'Revenue' },
              { value: 'ledger', label: 'Open balances' },
            ]}
            active={tab}
            onChange={setTab}
          />
        }
      />

      <Card className="mb-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="w-full sm:w-[150px]"><Field label="From"><DateInput value={from} onChange={setFrom} /></Field></div>
          <div className="w-full sm:w-[150px]"><Field label="To"><DateInput value={to} onChange={setTo} /></Field></div>
          <div className="flex gap-1.5 pb-0.5">
            <Button size="sm" variant="secondary" onClick={() => preset(6)}>Last 7d</Button>
            <Button size="sm" variant="secondary" onClick={() => preset(29)}>Last 30d</Button>
            <Button size="sm" variant="secondary" onClick={() => preset(89)}>Last 90d</Button>
            <Button size="sm" variant="secondary" onClick={() => preset(30, true)}>Next 30d</Button>
          </div>
          {tab === 'production' && (
            <div className="w-full sm:w-[180px] ml-auto">
              <Field label="Group by">
                <Select value={dimension} onChange={setDimension} options={[
                  { label: 'Source', value: 'source' },
                  { label: 'Channel', value: 'channel' },
                  { label: 'Market segment', value: 'segment' },
                  { label: 'Rate plan', value: 'rate_plan' },
                  { label: 'Room type', value: 'room_type' },
                  { label: 'Company', value: 'company' },
                ]} />
              </Field>
            </div>
          )}
        </div>
      </Card>

      {tab === 'performance' && (
        <QueryState query={kpis} loadingRows={6}>
          {(k) => {
            const chart = k.series.map((p) => ({
              date: p.date.slice(5),
              occupancy: Math.round(p.occupancyBp / 100),
              adr: p.adrMinor / 100,
              revpar: p.revparMinor / 100,
              actual: p.actual,
            }));
            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  <Card tone="yellow"><Metric label="Occupancy" value={pct(k.occupancyBp, 1)} /></Card>
                  <Card tone="mint"><Metric label="ADR" value={money(k.adrMinor)} /></Card>
                  <Card tone="sky"><Metric label="RevPAR" value={money(k.revparMinor)} /></Card>
                  <Card><Metric label="Room nights" value={String(k.roomsSold)} sub={`of ${k.roomsAvailable}`} /></Card>
                  <Card tone="cream"><Metric label="Room revenue" value={money(k.roomRevenueMinor)} /></Card>
                </div>

                <Card className="mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                      Occupancy, ADR &amp; RevPAR
                    </p>
                    <Button size="sm" variant="ghost" icon={<Download className="w-3 h-3" />}
                      onClick={() => exportCsv('performance', k.series.map((p) => ({
                        date: p.date, roomsAvailable: p.roomsAvailable, roomsSold: p.roomsSold,
                        occupancyPct: (p.occupancyBp / 100).toFixed(2),
                        adr: (p.adrMinor / 100).toFixed(2), revpar: (p.revparMinor / 100).toFixed(2),
                        roomRevenue: (p.roomRevenueMinor / 100).toFixed(2), actual: p.actual,
                      })))}>
                      Export
                    </Button>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chart} margin={{ top: 6, right: 10, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="2 4" stroke="rgba(0,0,0,0.06)" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', fontSize: 11 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line yAxisId="left" type="monotone" dataKey="occupancy" name="Occupancy %" stroke="#111" strokeWidth={2} dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="adr" name="ADR" stroke="#9BD1C4" strokeWidth={2} dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="revpar" name="RevPAR" stroke="#FFD84D" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[10px] text-dash-muted mt-2">
                    Closed days use the statistics frozen by the night audit; today and future dates are
                    calculated live from the reservation ledger.
                  </p>
                </Card>

                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
                    Closed-day statistics
                  </p>
                  <QueryState query={dailyStats} loadingRows={4} empty="No closed days in this range">
                    {(rows) => (
                      <div className="overflow-x-auto scroll-thin">
                        <table className="w-full min-w-[68rem] text-[12px]">
                          <thead>
                            <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                              <th className="pb-2">Date</th>
                              <th className="pb-2 text-right">Sold</th>
                              <th className="pb-2 text-right">OOO</th>
                              <th className="pb-2">Occupancy</th>
                              <th className="pb-2 text-right">ADR</th>
                              <th className="pb-2 text-right">RevPAR</th>
                              <th className="pb-2 text-right">Room rev</th>
                              <th className="pb-2 text-right">Other</th>
                              <th className="pb-2 text-right">Arr</th>
                              <th className="pb-2 text-right">Dep</th>
                              <th className="pb-2 text-right">No-show</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((s) => (
                              <tr key={s.date} className="border-b border-black/[0.03]">
                                <td className="py-2 font-semibold whitespace-nowrap">{longDate(s.date)}</td>
                                <td className="py-2 text-right">{s.roomsSold}</td>
                                <td className="py-2 text-right text-dash-muted">{s.roomsOoo}</td>
                                <td className="py-2 w-[120px]">
                                  <div className="flex items-center gap-2">
                                    <OccupancyBar bp={s.occupancyBp} className="flex-1" />
                                    <span className="text-[10px] tabular-nums w-9 text-right">{pct(s.occupancyBp, 0)}</span>
                                  </div>
                                </td>
                                <td className="py-2 text-right tabular-nums">{moneyShort(s.adrMinor)}</td>
                                <td className="py-2 text-right tabular-nums">{moneyShort(s.revparMinor)}</td>
                                <td className="py-2 text-right tabular-nums font-bold">{moneyShort(s.roomRevenueMinor)}</td>
                                <td className="py-2 text-right tabular-nums text-dash-muted">{moneyShort(s.otherRevenueMinor)}</td>
                                <td className="py-2 text-right text-dash-muted">{s.arrivals}</td>
                                <td className="py-2 text-right text-dash-muted">{s.departures}</td>
                                <td className="py-2 text-right text-dash-muted">{s.noShows}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </QueryState>
                </Card>
              </>
            );
          }}
        </QueryState>
      )}

      {tab === 'production' && (
        <QueryState query={production} loadingRows={5}
          isEmpty={(d) => d.rows.length === 0}
          empty="No production in this range">
          {(p) => {
            const total = p.rows.reduce((s, r) => s + r.revenueMinor, 0);
            return (
              <div className="grid lg:grid-cols-3 gap-3">
                <Card className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                      Revenue by {dimension.replace('_', ' ')}
                    </p>
                    <Button size="sm" variant="ghost" icon={<Download className="w-3 h-3" />}
                      onClick={() => exportCsv(`production-${dimension}`, p.rows.map((r) => ({
                        dimension: r.dimension, reservations: r.reservations, roomNights: r.roomNights,
                        revenue: (r.revenueMinor / 100).toFixed(2), adr: (r.adrMinor / 100).toFixed(2),
                        commission: (r.commissionMinor / 100).toFixed(2),
                      })))}>
                      Export
                    </Button>
                  </div>
                  <div className="overflow-x-auto scroll-thin">
                    <table className="w-full min-w-[46rem] text-[12px]">
                      <thead>
                        <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                          <th className="pb-2">{dimension.replace('_', ' ')}</th>
                          <th className="pb-2 text-right">Reservations</th>
                          <th className="pb-2 text-right">Room nights</th>
                          <th className="pb-2 text-right">ADR</th>
                          <th className="pb-2 text-right">Commission</th>
                          <th className="pb-2 text-right">Revenue</th>
                          <th className="pb-2 text-right">Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.rows.map((r) => (
                          <tr key={r.dimension} className="border-b border-black/[0.03]">
                            <td className="py-2.5 font-semibold">{r.dimension}</td>
                            <td className="py-2.5 text-right">{r.reservations}</td>
                            <td className="py-2.5 text-right">{r.roomNights}</td>
                            <td className="py-2.5 text-right tabular-nums">{money(r.adrMinor)}</td>
                            <td className="py-2.5 text-right tabular-nums text-dash-muted">{money(r.commissionMinor)}</td>
                            <td className="py-2.5 text-right tabular-nums font-bold">{money(r.revenueMinor)}</td>
                            <td className="py-2.5 text-right text-dash-muted">
                              {total ? `${Math.round((r.revenueMinor / total) * 100)}%` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">Mix</p>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={p.rows.map((r) => ({ name: r.dimension, value: r.revenueMinor / 100 }))}
                          dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}
                        >
                          {p.rows.map((_, i) => (
                            <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', fontSize: 11 }}
                          formatter={(v: any) => money(Math.round(Number(v) * 100))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 mt-2">
                    {p.rows.slice(0, 7).map((r, i) => (
                      <div key={r.dimension} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                        <span className="text-[11px] flex-1 truncate">{r.dimension}</span>
                        <span className="text-[11px] font-bold tabular-nums">{moneyShort(r.revenueMinor)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            );
          }}
        </QueryState>
      )}

      {tab === 'pace' && (
        <div className="grid lg:grid-cols-2 gap-3">
          <Card>
            <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
              Booking pace by lead time
            </p>
            <QueryState query={pace} loadingRows={4} isEmpty={(d: any) => !d?.buckets?.length}>
              {(p: any) => (
                <>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={p.buckets.map((b: any) => ({
                          label: b.leadDaysTo > 900 ? `${b.leadDaysFrom}+` : `${b.leadDaysFrom}-${b.leadDaysTo}`,
                          nights: b.roomNights,
                          revenue: b.revenueMinor / 100,
                        }))}
                        margin={{ top: 6, right: 6, left: -18, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="2 4" stroke="rgba(0,0,0,0.06)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', fontSize: 11 }} />
                        <Bar dataKey="nights" name="Room nights" fill="#111" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[10px] text-dash-muted mt-2">
                    Days between the booking being made and the night stayed.
                  </p>
                </>
              )}
            </QueryState>
          </Card>

          <Card>
            <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
              Same period last year
            </p>
            <QueryState query={pickup} loadingRows={4} isEmpty={(d: any) => !d?.rows?.length}>
              {(p: any) => (
                <div className="max-h-[300px] overflow-auto scroll-thin">
                  <table className="w-full min-w-[34rem] text-[12px]">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                        <th className="pb-2">Date</th>
                        <th className="pb-2 text-right">Sold</th>
                        <th className="pb-2 text-right">LY</th>
                        <th className="pb-2 text-right">Δ rooms</th>
                        <th className="pb-2 text-right">Δ revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.rows.map((r: any) => (
                        <tr key={r.date} className="border-b border-black/[0.03]">
                          <td className="py-2 whitespace-nowrap">{longDate(r.date)}</td>
                          <td className="py-2 text-right font-semibold">{r.roomsSold}</td>
                          <td className="py-2 text-right text-dash-muted">{r.lyRoomsSold}</td>
                          <td className={`py-2 text-right font-bold ${r.varianceRooms > 0 ? 'text-status-ok' : r.varianceRooms < 0 ? 'text-status-bad' : 'text-dash-muted'}`}>
                            {r.varianceRooms > 0 ? '+' : ''}{r.varianceRooms}
                          </td>
                          <td className={`py-2 text-right tabular-nums ${r.varianceRevenueMinor > 0 ? 'text-status-ok' : r.varianceRevenueMinor < 0 ? 'text-status-bad' : 'text-dash-muted'}`}>
                            {moneyShort(r.varianceRevenueMinor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </QueryState>
          </Card>
        </div>
      )}

      {tab === 'revenue' && (
        <QueryState query={revenue} loadingRows={5} isEmpty={(d: any) => !d?.rows?.length}
          empty="Nothing posted in this range">
          {(r: any) => {
            const charges = r.rows.filter((x: any) => x.kind === 'charge');
            const taxes = r.rows.filter((x: any) => x.kind === 'tax');
            const payments = r.rows.filter((x: any) => x.kind === 'payment');
            const sum = (rows: any[]) => rows.reduce((s, x) => s + x.totalMinor, 0);
            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <Card tone="mint"><Metric label="Charges" value={money(sum(charges))} /></Card>
                  <Card tone="sky"><Metric label="Taxes" value={money(sum(taxes))} /></Card>
                  <Card tone="yellow"><Metric label="Payments" value={money(Math.abs(sum(payments)))} /></Card>
                  <Card><Metric label="Postings" value={String(r.rows.reduce((s: number, x: any) => s + x.lines, 0))} /></Card>
                </div>
                <Card>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                      By transaction code
                    </p>
                    <Button size="sm" variant="ghost" icon={<Download className="w-3 h-3" />}
                      onClick={() => exportCsv('revenue', r.rows.map((x: any) => ({
                        code: x.code, name: x.name, category: x.category, kind: x.kind,
                        lines: x.lines, total: (x.totalMinor / 100).toFixed(2),
                      })))}>
                      Export
                    </Button>
                  </div>
                  <div className="overflow-x-auto scroll-thin">
                    <table className="w-full min-w-[40rem] text-[12px]">
                      <thead>
                        <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                          <th className="pb-2">Code</th>
                          <th className="pb-2">Name</th>
                          <th className="pb-2">Category</th>
                          <th className="pb-2">Kind</th>
                          <th className="pb-2 text-right">Postings</th>
                          <th className="pb-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.rows.map((x: any) => (
                          <tr key={`${x.code}-${x.kind}`} className="border-b border-black/[0.03]">
                            <td className="py-2 font-mono text-[10px]">{x.code}</td>
                            <td className="py-2 font-semibold">{x.name}</td>
                            <td className="py-2 text-dash-muted">{x.category}</td>
                            <td className="py-2"><Pill tone={x.kind === 'payment' ? 'mint' : x.kind === 'tax' ? 'sky' : 'grey'}>{x.kind}</Pill></td>
                            <td className="py-2 text-right text-dash-muted">{x.lines}</td>
                            <td className="py-2 text-right tabular-nums font-bold">{money(x.totalMinor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            );
          }}
        </QueryState>
      )}

      {tab === 'ledger' && (
        <QueryState query={outstanding} loadingRows={4} empty="Every folio is settled">
          {(rows: any[]) => {
            const total = rows.reduce((s, r) => s + r.balanceMinor, 0);
            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  <Card tone={total > 0 ? 'peach' : 'mint'}><Metric label="Total outstanding" value={money(total)} /></Card>
                  <Card><Metric label="Folios with a balance" value={String(rows.length)} /></Card>
                  <Card><Metric label="In-house balances"
                    value={money(rows.filter((r) => r.reservationStatus === 'Checked-in').reduce((s, r) => s + r.balanceMinor, 0))} /></Card>
                </div>
                <Card>
                  <div className="overflow-x-auto scroll-thin">
                    <table className="w-full min-w-[40rem] text-[12px]">
                      <thead>
                        <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                          <th className="pb-2">Folio</th>
                          <th className="pb-2">Guest</th>
                          <th className="pb-2">Room</th>
                          <th className="pb-2">Reservation</th>
                          <th className="pb-2">Dates</th>
                          <th className="pb-2 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.folioId} className="border-b border-black/[0.03]">
                            <td className="py-2 font-mono text-[11px]">{r.number}</td>
                            <td className="py-2 font-semibold">{r.guest ?? r.name}</td>
                            <td className="py-2">{r.room ?? '—'}</td>
                            <td className="py-2 text-dash-muted">{r.reservationStatus ?? r.folioStatus}</td>
                            <td className="py-2 text-dash-muted whitespace-nowrap">
                              {r.arrival ? `${r.arrival} → ${r.departure}` : '—'}
                            </td>
                            <td className={`py-2 text-right tabular-nums font-bold ${r.balanceMinor > 0 ? 'text-status-bad' : 'text-status-info'}`}>
                              {money(r.balanceMinor)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            );
          }}
        </QueryState>
      )}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-2">{label}</p>
      <p className="text-[22px] font-black leading-none tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-dash-muted mt-1.5">{sub}</p>}
    </>
  );
}
