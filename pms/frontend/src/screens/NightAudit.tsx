import { useState } from 'react';
import { Moon, Play, CheckCircle2, AlertTriangle, FileText, History } from 'lucide-react';
import { useNav } from '../nav';
import { useAuditPreflight, useRunNightAudit, useAuditHistory, useAuditReport } from '../queries';
import { useAuthStore } from '../stores';
import { Card, Pill, Button, SectionHeader, Tabs } from '../ui';
import { QueryState, useToast, ConfirmDialog, PermissionButton, Toggle } from '../components';
import { money, longDate, timestamp, pct, addDays } from '../format';

export function NightAuditScreen() {
  const { navigate } = useNav();
  const toast = useToast();
  const property = useAuthStore((s) => s.property);
  const preflight = useAuditPreflight();
  const history = useAuditHistory();
  const runAudit = useRunNightAudit();

  const [tab, setTab] = useState<'run' | 'report' | 'history'>('run');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [force, setForce] = useState(false);
  const [chargeNoShows, setChargeNoShows] = useState(true);
  const [reportDate, setReportDate] = useState(addDays(property?.businessDate ?? '', -1));

  const report = useAuditReport(reportDate);

  return (
    <div>
      <SectionHeader
        eyebrow={`Business date ${property?.businessDate ?? ''}`}
        title="Night audit"
        action={
          <Tabs
            tabs={[
              { value: 'run', label: 'Run audit' },
              { value: 'report', label: 'Daily report' },
              { value: 'history', label: 'History' },
            ]}
            active={tab}
            onChange={setTab}
          />
        }
      />

      {tab === 'run' && (
        <QueryState query={preflight} loadingRows={5}>
          {(p) => {
            const blockers = p.issues.filter((i) => i.severity === 'block');
            const warnings = p.issues.filter((i) => i.severity === 'warn');
            return (
              <div className="grid lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2 space-y-3">
                  <Card tone={blockers.length ? 'peach' : 'mint'}>
                    <div className="flex items-start gap-3">
                      {blockers.length
                        ? <AlertTriangle className="w-5 h-5 text-status-warn mt-0.5 shrink-0" />
                        : <CheckCircle2 className="w-5 h-5 text-status-ok mt-0.5 shrink-0" />}
                      <div>
                        <p className="text-[14px] font-bold mb-1">
                          {blockers.length
                            ? `${blockers.length} item${blockers.length > 1 ? 's' : ''} must be resolved first`
                            : 'Ready to close the day'}
                        </p>
                        <p className="text-[12px] text-dash-muted">
                          Closing <span className="font-bold">{longDate(p.businessDate)}</span> and opening{' '}
                          <span className="font-bold">{longDate(p.nextDate)}</span>.
                        </p>
                      </div>
                    </div>
                  </Card>

                  {p.issues.length > 0 && (
                    <Card>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
                        Pre-flight checks
                      </p>
                      <div className="space-y-3">
                        {p.issues.map((issue) => (
                          <div key={issue.kind} className="rounded-2xl border border-black/5 p-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <Pill tone={issue.severity === 'block' ? 'red' : 'yellow'}>
                                {issue.severity === 'block' ? 'Blocks the audit' : 'Warning'}
                              </Pill>
                              <p className="text-[12px] font-bold">{issue.message}</p>
                            </div>
                            <div className="space-y-0.5 pl-1">
                              {issue.items.slice(0, 8).map((item) => (
                                <button
                                  key={item.id}
                                  onClick={() => {
                                    if (issue.kind === 'pending-departure' || issue.kind === 'unassigned-in-house') {
                                      navigate('guest-dashboard', { reservationId: item.id });
                                    } else if (issue.kind === 'pending-arrival') {
                                      navigate('check-in', { reservationId: item.id });
                                    } else if (issue.kind === 'open-shift') {
                                      navigate('cashier');
                                    }
                                  }}
                                  className="block text-[11px] text-dash-muted hover:text-black hover:underline text-left"
                                >
                                  · {item.label}
                                </button>
                              ))}
                              {issue.items.length > 8 && (
                                <p className="text-[11px] text-dash-muted">…and {issue.items.length - 8} more</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  <Card>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
                      What the audit will do
                    </p>
                    <ol className="space-y-2.5 text-[12px]">
                      <Step n={1} title="Process no-shows"
                        detail={`${p.issues.find((i) => i.kind === 'pending-arrival')?.count ?? 0} arrival(s) that never checked in are marked no-show and their rooms released`} />
                      <Step n={2} title="Post room charges & taxes"
                        detail={`${p.counts.roomsToPost} occupied room night(s) posted to guest folios with their taxes`} />
                      <Step n={3} title="Freeze statistics"
                        detail="Occupancy, ADR and RevPAR for the day are calculated and stored" />
                      <Step n={4} title="Roll housekeeping"
                        detail="Every occupied clean room becomes dirty for the new day" />
                      <Step n={5} title="Release expired group blocks"
                        detail="Groups past their cutoff release unsold rooms back to inventory" />
                      <Step n={6} title="Advance the business date"
                        detail={`The property moves to ${p.nextDate} and tomorrow's task sheet is built`} />
                    </ol>
                    <p className="text-[11px] text-dash-muted mt-4 leading-relaxed">
                      The whole run is a single database transaction — if any step fails, nothing is committed
                      and the business date stays where it is.
                    </p>
                  </Card>
                </div>

                <div className="space-y-3">
                  <Card tone="dark">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-3">Tonight</p>
                    <div className="space-y-2">
                      <DarkRow label="In-house" value={String(p.counts.inHouse)} />
                      <DarkRow label="Arrivals today" value={String(p.counts.arrivals)} />
                      <DarkRow label="Departures today" value={String(p.counts.departures)} />
                      <DarkRow label="Room nights to post" value={String(p.counts.roomsToPost)} strong />
                    </div>
                  </Card>

                  <Card>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">Options</p>
                    <div className="space-y-3">
                      <Toggle checked={chargeNoShows} onChange={setChargeNoShows}
                        label="Charge no-shows the first night" />
                      {blockers.length > 0 && (
                        <Toggle checked={force} onChange={setForce}
                          label="Override blocking items" />
                      )}
                      {force && (
                        <p className="text-[11px] text-status-bad leading-relaxed">
                          Overriding is recorded against your user in the audit trail. In-house guests past
                          their departure date will keep accruing room charges.
                        </p>
                      )}
                    </div>
                    <PermissionButton
                      permission="nightaudit.run"
                      className="w-full mt-4"
                      icon={<Play className="w-3.5 h-3.5" />}
                      disabled={runAudit.isPending || (blockers.length > 0 && !force)}
                      onClick={() => setConfirmOpen(true)}
                    >
                      {runAudit.isPending ? 'Running audit…' : 'Run night audit'}
                    </PermissionButton>
                    {blockers.length > 0 && !force && (
                      <p className="text-[11px] text-dash-muted mt-2 text-center">
                        Resolve the blocking items, or enable the override.
                      </p>
                    )}
                  </Card>
                </div>
              </div>
            );
          }}
        </QueryState>
      )}

      {tab === 'report' && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="bg-white border border-black/10 rounded-xl px-4 py-2 text-[12px] outline-none focus:border-black/40"
            />
            <p className="text-[11px] text-dash-muted">Manager's report for the selected business date</p>
          </div>
          <QueryState query={report} loadingRows={6}>
            {(r) => (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card tone="yellow"><Metric label="Occupancy" value={pct(r.stats?.occupancy_bp ?? 0, 1)}
                    sub={`${r.stats?.rooms_sold ?? 0} of ${(r.stats?.rooms_total ?? 0) - (r.stats?.rooms_ooo ?? 0)}`} /></Card>
                  <Card tone="mint"><Metric label="ADR" value={money(r.stats?.adr_minor ?? 0)} /></Card>
                  <Card tone="sky"><Metric label="RevPAR" value={money(r.stats?.revpar_minor ?? 0)} /></Card>
                  <Card><Metric label="Room revenue" value={money(r.stats?.room_revenue_minor ?? 0)} /></Card>
                </div>

                <div className="grid lg:grid-cols-2 gap-3">
                  <Card>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
                      Revenue by transaction code
                    </p>
                    {r.revenueByCode.length === 0 && <p className="text-[12px] text-dash-muted">Nothing posted.</p>}
                    <div className="overflow-x-auto scroll-thin">
                      <table className="w-full min-w-[30rem] text-[12px]">
                        <tbody>
                          {r.revenueByCode.map((row: any) => (
                            <tr key={`${row.code}-${row.kind}`} className="border-b border-black/[0.03]">
                              <td className="py-2 font-mono text-[10px]">{row.code}</td>
                              <td className="py-2 text-dash-muted">{row.kind}</td>
                              <td className="py-2 text-right text-dash-muted">{row.lines}</td>
                              <td className="py-2 text-right tabular-nums font-bold">{money(row.totalMinor)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  <Card>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
                      Payments by method
                    </p>
                    {r.paymentsByMethod.length === 0 && <p className="text-[12px] text-dash-muted">No payments taken.</p>}
                    <table className="w-full text-[12px]">
                      <tbody>
                        {r.paymentsByMethod.map((row: any) => (
                          <tr key={row.method} className="border-b border-black/[0.03]">
                            <td className="py-2 font-semibold">{row.method}</td>
                            <td className="py-2 text-right text-dash-muted">{row.count}</td>
                            <td className="py-2 text-right tabular-nums font-bold">{money(row.totalMinor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mt-5 mb-3">
                      Production by source
                    </p>
                    <table className="w-full text-[12px]">
                      <tbody>
                        {r.productionBySource.map((row: any) => (
                          <tr key={row.source} className="border-b border-black/[0.03]">
                            <td className="py-2 font-semibold">{row.source}</td>
                            <td className="py-2 text-right text-dash-muted">{row.reservations} res</td>
                            <td className="py-2 text-right tabular-nums font-bold">{money(row.revenueMinor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                </div>

                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
                    Day statistics
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <Stat label="Rooms sold" value={String(r.stats?.rooms_sold ?? 0)} />
                    <Stat label="Out of order" value={String(r.stats?.rooms_ooo ?? 0)} />
                    <Stat label="Arrivals" value={String(r.stats?.arrivals ?? 0)} />
                    <Stat label="Departures" value={String(r.stats?.departures ?? 0)} />
                    <Stat label="No-shows" value={String(r.stats?.no_shows ?? 0)} />
                    <Stat label="Cancellations" value={String(r.stats?.cancellations ?? 0)} />
                    <Stat label="Other revenue" value={money(r.stats?.other_revenue_minor ?? 0)} />
                    <Stat label="Tax collected" value={money(r.stats?.tax_minor ?? 0)} />
                    <Stat label="Payments" value={money(r.stats?.payments_minor ?? 0)} />
                  </div>
                </Card>
              </div>
            )}
          </QueryState>
        </>
      )}

      {tab === 'history' && (
        <QueryState query={history} loadingRows={4} empty="No audits have been run yet">
          {(rows) => (
            <div className="space-y-2">
              {rows.map((h: any) => (
                <Card key={h.id}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Moon className="w-3.5 h-3.5 text-dash-muted" />
                        <p className="text-[13px] font-bold">{longDate(h.businessDate)}</p>
                        <Pill tone={h.status === 'completed' ? 'mint' : h.status === 'failed' ? 'red' : 'yellow'}>
                          {h.status}
                        </Pill>
                      </div>
                      <p className="text-[11px] text-dash-muted">
                        Run by {h.user} · started {timestamp(h.startedAt)}
                        {h.finishedAt ? ` · finished ${timestamp(h.finishedAt)}` : ''}
                      </p>
                      {h.summary && (
                        <div className="flex flex-wrap gap-4 mt-2 text-[11px]">
                          <span><span className="font-bold">{h.summary.roomChargesPosted}</span> room charges</span>
                          <span><span className="font-bold">{money(h.summary.roomRevenueMinor)}</span> room revenue</span>
                          <span><span className="font-bold">{money(h.summary.taxPostedMinor)}</span> tax</span>
                          <span><span className="font-bold">{h.summary.noShows}</span> no-shows</span>
                        </div>
                      )}
                      {h.summary?.warnings?.length > 0 && (
                        <div className="mt-2 space-y-0.5">
                          {h.summary.warnings.map((w: string, i: number) => (
                            <p key={i} className="text-[11px] text-status-warn">· {w}</p>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" icon={<FileText className="w-3 h-3" />}
                      onClick={() => { setReportDate(h.businessDate); setTab('report'); }}>
                      Report
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </QueryState>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={`Close ${longDate(preflight.data?.businessDate ?? '')}?`}
        body={
          <div className="space-y-2">
            <p>
              Room charges will be posted, statistics frozen and the business date advanced to{' '}
              <span className="font-bold">{longDate(preflight.data?.nextDate ?? '')}</span>.
            </p>
            <p>This cannot be undone from the app.</p>
          </div>
        }
        confirmLabel="Run night audit"
        busy={runAudit.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          try {
            const res = await runAudit.mutateAsync({
              force,
              noShowChargePolicy: chargeNoShows ? 'first-night' : 'none',
            });
            toast.success(
              `Business date is now ${res.newBusinessDate}`,
              `${res.roomChargesPosted} room charge(s) · ${money(res.roomRevenueMinor)} revenue · ${res.noShows} no-show(s)`,
            );
            setConfirmOpen(false);
            setForce(false);
          } catch (e) {
            toast.fail(e, 'Night audit failed');
            setConfirmOpen(false);
          }
        }}
      />
    </div>
  );
}

function Step({ n, title, detail }: { n: number; title: string; detail: string }) {
  return (
    <li className="flex gap-3">
      <span className="w-5 h-5 rounded-full bg-black text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <div>
        <p className="font-bold">{title}</p>
        <p className="text-[11px] text-dash-muted">{detail}</p>
      </div>
    </li>
  );
}

function DarkRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-white/50">{label}</span>
      <span className={`text-[12px] tabular-nums ${strong ? 'font-black' : 'font-bold'}`}>{value}</span>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1">{label}</p>
      <p className="text-[15px] font-bold tabular-nums">{value}</p>
    </div>
  );
}
