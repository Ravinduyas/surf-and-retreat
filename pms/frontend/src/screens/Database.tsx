// Database health: size, settings, integrity history and maintenance.
//
// Everything here answers one question — is the file underneath this business
// sound? The numbers are secondary to the integrity result, which is the only
// thing on this screen that can tell you your data is wrong.
import { useState } from 'react';
import {
  Database, ShieldCheck, ShieldAlert, Activity, Gauge, Wrench, Zap, Layers,
} from 'lucide-react';
import { useDatabaseHealth, useIntegrityCheck, useMaintenance } from '../queries';
import { Card, Pill, Button } from '../ui';
import { QueryState, useToast, PermissionButton, ConfirmDialog, WarnNote } from '../components';
import { relativeTime, timestamp, bytes } from '../format';

export function DatabaseTab() {
  const toast = useToast();
  const query = useDatabaseHealth();
  const check = useIntegrityCheck();
  const maintain = useMaintenance();
  const [vacuumOpen, setVacuumOpen] = useState(false);

  async function runMaintenance(action: string, label: string) {
    try {
      const r: any = await maintain.mutateAsync({ action });
      toast.success(label, `${r.detail} · ${r.durationMs}ms`);
    } catch (e) { toast.fail(e, `${label} failed`); }
  }

  return (
    <QueryState query={query} loadingRows={5}>
      {(data) => {
        const h = data.health;
        const last = h.lastCheck;
        const sound = last?.ok !== false;

        return (
          <div className="space-y-3">
            <Card tone={!last ? 'grey' : sound ? 'mint' : 'peach'}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center shrink-0">
                    {sound
                      ? <ShieldCheck className="w-5 h-5 text-status-ok" />
                      : <ShieldAlert className="w-5 h-5 text-status-bad" />}
                  </div>
                  <div>
                    <p className="text-[15px] font-bold mb-1">
                      {!last ? 'The database has not been checked yet'
                        : sound ? 'The database is structurally sound'
                          : 'The database failed its integrity check'}
                    </p>
                    <p className="text-[12px] text-dash-muted leading-relaxed max-w-xl">
                      {last
                        ? <>Last checked {relativeTime(last.at)} by {last.triggeredBy} —
                          every page read in {last.durationMs}ms. </>
                        : <>Nothing has verified the file's structure. </>}
                      Checks run on startup and after every night audit; corruption is silent
                      until it produces a wrong number, so nothing else will tell you.
                    </p>
                  </div>
                </div>
                <PermissionButton
                  permission="admin.users"
                  icon={<Activity className="w-3.5 h-3.5" />}
                  disabled={check.isPending}
                  onClick={async () => {
                    try {
                      const r: any = await check.mutateAsync();
                      if (r.ok) toast.success('Integrity check passed', `Every page read in ${r.durationMs}ms`);
                      else {
                        toast.push({
                          kind: 'error', title: 'Integrity check FAILED',
                          body: r.integrity !== 'ok' ? r.integrity
                            : `${r.foreignKeyViolations.length} foreign key violation(s)`,
                        });
                      }
                    } catch (e) { toast.fail(e); }
                  }}
                >
                  {check.isPending ? 'Checking…' : 'Check now'}
                </PermissionButton>
              </div>

              {last && !last.ok && (
                <div className="mt-4 pt-4 border-t border-black/10">
                  <p className="text-[11px] font-bold text-status-bad mb-1">What SQLite reported</p>
                  <code className="block text-[11px] font-mono text-status-bad whitespace-pre-wrap">
                    {last.integrity}
                  </code>
                  {last.foreignKeyViolations.length > 0 && (
                    <p className="text-[11px] text-status-bad mt-2">
                      {last.foreignKeyViolations.length} row(s) reference records that no longer exist:{' '}
                      {last.foreignKeyViolations.slice(0, 5)
                        .map((v: any) => `${v.table}→${v.parent}`).join(', ')}
                    </p>
                  )}
                  <p className="text-[11px] text-dash-muted mt-2">
                    Restore from the most recent verified backup — see the Backups tab.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-black/5">
                <Stat label="Database size" value={bytes(h.fileBytes)} />
                <Stat label="Write-ahead log" value={bytes(h.walBytes)} />
                <Stat label="Reclaimable" value={`${h.freePercent}%`}
                  hint={bytes(h.freeBytes)} />
                <Stat label="Indexes" value={String(h.indexCount)} />
              </div>
            </Card>

            {(h.walOversized || h.needsVacuum || h.needsAnalyze) && (
              <WarnNote>
                {h.walOversized
                  ? 'The write-ahead log has grown larger than the database. Checkpoints are not '
                    + 'completing — run Checkpoint below.'
                  : h.needsVacuum
                    ? `${h.freePercent}% of this file is free space left by deleted rows. `
                      + 'Compact it with Vacuum.'
                    : 'The query planner has no statistics. Run Analyze — it takes milliseconds '
                      + 'and it is what keeps queries fast as the property fills up.'}
              </WarnNote>
            )}

            <div className="grid md:grid-cols-2 gap-3">
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <Gauge className="w-4 h-4 text-dash-muted" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                    Engine settings
                  </p>
                </div>
                <Setting label="Journal mode" value={h.journalMode}
                  good={h.journalMode === 'wal'}
                  note="WAL lets the front desk read while the night audit writes" />
                <Setting label="Synchronous" value={h.synchronous === 2 ? 'FULL' : String(h.synchronous)}
                  good={h.synchronous === 2}
                  note="FULL means a committed payment has reached the disk" />
                <Setting label="Foreign keys" value={h.foreignKeys ? 'enforced' : 'OFF'}
                  good={h.foreignKeys}
                  note="Enforced, not advisory — a folio cannot outlive its reservation" />
                <Setting label="Busy timeout" value={`${h.busyTimeoutMs} ms`}
                  good={h.busyTimeoutMs >= 5000}
                  note="How long a writer waits rather than failing outright" />
                <Setting label="Planner statistics" value={h.hasStatistics ? 'present' : 'none'}
                  good={h.hasStatistics}
                  note="ANALYZE results — without them the planner is guessing" />
                <Setting label="Schema version" value={h.schemaVersion} good
                  note={`${h.tableCount} tables · ${h.pageCount.toLocaleString()} pages of ${bytes(h.pageSize)}`} />
              </Card>

              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <Wrench className="w-4 h-4 text-dash-muted" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                    Maintenance
                  </p>
                </div>
                <p className="text-[11px] text-dash-muted mb-3 leading-relaxed">
                  Analyze and Checkpoint run nightly on their own. These are here for when you
                  want them sooner.
                </p>
                <div className="space-y-2">
                  <Action
                    icon={<Zap className="w-3.5 h-3.5" />}
                    title="Analyze"
                    body="Rebuild the statistics the query planner uses to pick indexes. Milliseconds, safe at any time."
                    busy={maintain.isPending}
                    onClick={() => runMaintenance('analyze', 'Statistics rebuilt')}
                  />
                  <Action
                    icon={<Layers className="w-3.5 h-3.5" />}
                    title="Checkpoint"
                    body="Move the write-ahead log into the database and reset it. Safe while the desk is working."
                    busy={maintain.isPending}
                    onClick={() => runMaintenance('checkpoint', 'WAL checkpointed')}
                  />
                  <Action
                    icon={<Database className="w-3.5 h-3.5" />}
                    title="Vacuum"
                    body={`Rewrite the file to reclaim ${bytes(h.freeBytes)} of free space. Locks the database while it runs — do it out of hours.`}
                    danger
                    busy={maintain.isPending}
                    onClick={() => setVacuumOpen(true)}
                  />
                </div>
              </Card>
            </div>

            <Card>
              <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
                Largest tables
              </p>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5">
                {h.tables.slice(0, 12).map((t: any) => (
                  <div key={t.name} className="flex items-baseline justify-between gap-3 text-[12px]">
                    <span className="font-mono text-[11px] truncate">{t.name}</span>
                    <span className="flex-1 border-b border-dotted border-black/10 min-w-[10px]" />
                    <span className="tabular-nums font-semibold">{t.rows.toLocaleString()}</span>
                    <span className="text-[10px] text-dash-muted w-14 text-right">
                      {t.indexes} {t.indexes === 1 ? 'index' : 'indexes'}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
                Check history
              </p>
              {data.checks.length === 0 ? (
                <p className="text-[12px] text-dash-muted py-6 text-center">
                  No checks recorded yet.
                </p>
              ) : (
                <div className="overflow-x-auto scroll-thin">
                  <table className="w-full min-w-[30rem] text-[12px]">
                    <thead>
                      <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                        <th className="pb-2">When</th>
                        <th className="pb-2">Triggered by</th>
                        <th className="pb-2">Took</th>
                        <th className="pb-2">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.checks.map((c: any) => (
                        <tr key={c.id} className="border-b border-black/[0.03]">
                          <td className="py-2.5 whitespace-nowrap">
                            <span className="font-semibold">{relativeTime(c.at)}</span>
                            <p className="text-[10px] text-dash-muted">{timestamp(c.at)}</p>
                          </td>
                          <td className="py-2.5"><Pill tone="grey">{c.triggeredBy}</Pill></td>
                          <td className="py-2.5 text-dash-muted tabular-nums">{c.durationMs}ms</td>
                          <td className="py-2.5">
                            {c.ok
                              ? <Pill tone="mint">passed</Pill>
                              : <Pill tone="red">FAILED</Pill>}
                            {!c.ok && (
                              <p className="text-[10px] text-status-bad mt-0.5">{c.integrity}</p>
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
              open={vacuumOpen}
              title="Vacuum the database?"
              body={`This rewrites the entire file to reclaim ${bytes(h.freeBytes)}. `
                + 'The database is locked for the duration — nobody can check a guest in while '
                + 'it runs. On a file this size that is seconds, but do it when the desk is quiet.'}
              confirmLabel="Vacuum"
              busy={maintain.isPending}
              onCancel={() => setVacuumOpen(false)}
              onConfirm={async () => {
                setVacuumOpen(false);
                await runMaintenance('vacuum', 'Database compacted');
              }}
            />
          </div>
        );
      }}
    </QueryState>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1">{label}</p>
      <p className="text-[15px] font-black tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-dash-muted">{hint}</p>}
    </div>
  );
}

function Setting({ label, value, good, note }:
{ label: string; value: string; good: boolean; note: string }) {
  return (
    <div className="py-2 border-b border-black/[0.03] last:border-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-semibold">{label}</span>
        <span className={`text-[12px] font-mono ${good ? 'text-status-ok' : 'text-status-warn'}`}>
          {value}
        </span>
      </div>
      <p className="text-[10px] text-dash-muted mt-0.5 leading-relaxed">{note}</p>
    </div>
  );
}

function Action({ icon, title, body, onClick, busy, danger }: {
  icon: React.ReactNode; title: string; body: string;
  onClick: () => void; busy: boolean; danger?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-dash-bg">
      <div className="flex-1">
        <p className="text-[12px] font-bold mb-0.5">{title}</p>
        <p className="text-[10px] text-dash-muted leading-relaxed">{body}</p>
      </div>
      <PermissionButton
        permission="admin.users"
        size="sm"
        variant={danger ? 'danger' : 'secondary'}
        icon={icon}
        disabled={busy}
        onClick={onClick}
      >
        Run
      </PermissionButton>
    </div>
  );
}
