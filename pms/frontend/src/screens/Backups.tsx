// Backup status and history. Restoring is deliberately not offered here — it
// has to happen with the API stopped, so it lives in a command-line script that
// can enforce that.
import { useState } from 'react';
import {
  DatabaseBackup, ShieldCheck, ShieldAlert, Play, RefreshCw, Trash2, Clock, HardDrive,
} from 'lucide-react';
import { useBackups, useRunBackup, useVerifyBackup, useDeleteBackup } from '../queries';
import { Card, Pill, Button, Modal } from '../ui';
import { QueryState, useToast, PermissionButton, ConfirmDialog, WarnNote, InfoNote } from '../components';
import { relativeTime, timestamp, bytes } from '../format';

export function BackupsTab() {
  const toast = useToast();
  const backups = useBackups();
  const runBackup = useRunBackup();
  const verify = useVerifyBackup();
  const remove = useDeleteBackup();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);

  return (
    <QueryState query={backups} loadingRows={5}>
      {(data) => {
        const s = data.status;
        const tone = s.health === 'healthy' ? 'mint'
          : s.health === 'degraded' ? 'yellow' : 'peach';
        const headline = s.health === 'healthy' ? 'Your data is protected'
          : s.health === 'never-run' ? 'No backup has ever been taken'
            : s.health === 'stale' ? 'The last backup is out of date'
              : 'Backups are running but some have failed';

        return (
          <div className="space-y-3">
            <Card tone={tone}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center shrink-0">
                    {s.health === 'healthy'
                      ? <ShieldCheck className="w-5 h-5 text-status-ok" />
                      : <ShieldAlert className="w-5 h-5 text-status-warn" />}
                  </div>
                  <div>
                    <p className="text-[15px] font-bold mb-1">{headline}</p>
                    <p className="text-[12px] text-dash-muted leading-relaxed max-w-xl">
                      {s.lastGood
                        ? <>Last verified backup {relativeTime(s.lastGood.at)} — {bytes(s.lastGood.sizeBytes)},
                          taken in {s.lastGood.durationMs}ms. </>
                        : <>Nothing has been snapshotted yet. </>}
                      {s.scheduleEnabled
                        ? <>Automatic backups run every {s.intervalHours} hours and after every night audit.</>
                        : <span className="text-status-bad font-semibold">
                          Automatic backups are switched off — only manual snapshots will be taken.
                        </span>}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setRestoreOpen(true)}>How to restore</Button>
                  <PermissionButton
                    permission="admin.users"
                    icon={<Play className="w-3.5 h-3.5" />}
                    disabled={runBackup.isPending}
                    onClick={async () => {
                      try {
                        const r: any = await runBackup.mutateAsync();
                        if (r.status === 'verified') {
                          toast.success('Backup taken and verified',
                            `${bytes(r.sizeBytes)} in ${r.durationMs}ms`);
                        } else {
                          toast.push({ kind: 'error', title: 'Backup failed verification', body: r.error });
                        }
                      } catch (e) { toast.fail(e, 'Backup failed'); }
                    }}
                  >
                    {runBackup.isPending ? 'Backing up…' : 'Back up now'}
                  </PermissionButton>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-black/5">
                <Stat label="Snapshots kept" value={String(s.snapshotsOnDisk)} />
                <Stat label="Space used" value={bytes(s.totalBytes)} />
                <Stat label="Database size" value={bytes(s.sourceBytes)} />
                <Stat label="Age of newest"
                  value={s.ageHours === null ? '—' : s.ageHours < 1 ? 'under an hour' : `${s.ageHours}h`} />
              </div>
            </Card>

            {s.needsAttention && (
              <WarnNote>
                {!s.lastGood
                  ? 'There is no verified backup of this property. Take one now.'
                  : s.stale
                    ? `The newest verified backup is ${s.ageHours} hours old, past the ${s.staleAfterHours}-hour limit.`
                    : 'Automatic backups are disabled. Set HELIO_BACKUP_ENABLED=true and restart the API.'}
              </WarnNote>
            )}

            <Card>
              <div className="flex items-center gap-2 mb-1">
                <HardDrive className="w-4 h-4 text-dash-muted" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                  Where backups are written
                </p>
              </div>
              <code className="text-[11px] font-mono text-dash-muted break-all">{s.directory}</code>
              <p className="text-[11px] text-dash-muted mt-2 leading-relaxed">
                Retention: the newest {s.retention.last} always, then one a day for {s.retention.daily} days,
                one a week for {s.retention.weekly} weeks, one a month for {s.retention.monthly} months.
                Copy this directory somewhere off this machine — a backup on the same disk does not survive
                the disk failing.
              </p>
            </Card>

            <Card>
              <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
                Snapshots
              </p>
              {data.backups.length === 0 ? (
                <p className="text-[12px] text-dash-muted py-8 text-center">No snapshots yet.</p>
              ) : (
                <div className="overflow-x-auto scroll-thin">
                  <table className="w-full min-w-[46rem] text-[12px]">
                    <thead>
                      <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                        <th className="pb-2">Taken</th>
                        <th className="pb-2">Reason</th>
                        <th className="pb-2">Size</th>
                        <th className="pb-2">Took</th>
                        <th className="pb-2">Contents</th>
                        <th className="pb-2">State</th>
                        <th className="pb-2 text-right" />
                      </tr>
                    </thead>
                    <tbody>
                      {data.backups.map((b) => (
                        <tr key={b.id} className="border-b border-black/[0.03]">
                          <td className="py-2.5 whitespace-nowrap">
                            <span className="font-semibold">{relativeTime(b.at)}</span>
                            <p className="text-[10px] text-dash-muted">{timestamp(b.at)}</p>
                          </td>
                          <td className="py-2.5"><Pill tone="grey">{b.reason}</Pill></td>
                          <td className="py-2.5 tabular-nums">{bytes(b.sizeBytes)}</td>
                          <td className="py-2.5 text-dash-muted tabular-nums">{b.durationMs}ms</td>
                          <td className="py-2.5 text-[10px] text-dash-muted">
                            {b.rowChecks
                              ? `${b.rowChecks.reservations} res · ${b.rowChecks.folio_lines} lines`
                              : '—'}
                          </td>
                          <td className="py-2.5">
                            {b.status === 'verified'
                              ? <Pill tone="mint">verified</Pill>
                              : <Pill tone="red" >{b.status}</Pill>}
                            {b.error && <p className="text-[10px] text-status-bad mt-0.5">{b.error}</p>}
                            {!b.onDisk && <p className="text-[10px] text-status-warn mt-0.5">file missing</p>}
                          </td>
                          <td className="py-2.5 text-right whitespace-nowrap">
                            <PermissionButton permission="admin.users" size="sm" variant="ghost"
                              icon={<RefreshCw className="w-3 h-3" />}
                              disabled={verify.isPending}
                              onClick={async () => {
                                try {
                                  const r: any = await verify.mutateAsync({ id: b.id });
                                  if (r.status === 'verified') toast.success('Backup re-verified — still good');
                                  else toast.push({ kind: 'error', title: 'Verification failed', body: r.error });
                                } catch (e) { toast.fail(e); }
                              }} />
                            <PermissionButton permission="admin.users" size="sm" variant="ghost"
                              icon={<Trash2 className="w-3 h-3" />}
                              onClick={() => setDeleteId(b.id)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {data.orphanedFiles.length > 0 && (
                <p className="text-[11px] text-dash-muted mt-3">
                  {data.orphanedFiles.length} file(s) in the backup directory are not tracked here.
                  They will be adopted the next time the API restarts.
                </p>
              )}
            </Card>

            <Modal open={restoreOpen} onClose={() => setRestoreOpen(false)} title="Restoring from a backup"
              footer={<div className="flex justify-end"><Button onClick={() => setRestoreOpen(false)}>Close</Button></div>}>
              <div className="space-y-4">
                <InfoNote>
                  Restoring cannot be done from this screen. The database file has to be swapped while the
                  API is stopped — doing it under a running server corrupts both copies. The command below
                  enforces that.
                </InfoNote>
                <div>
                  <p className="text-[11px] font-bold mb-1.5">1 · See what is available</p>
                  <code className="block text-[11px] font-mono bg-dash-bg p-3 rounded-xl">
                    cd backend && npm run restore
                  </code>
                </div>
                <div>
                  <p className="text-[11px] font-bold mb-1.5">2 · Check what a restore would do (safe)</p>
                  <code className="block text-[11px] font-mono bg-dash-bg p-3 rounded-xl break-all">
                    npm run restore -- {data.backups[0]?.filename ?? '<filename>'}
                  </code>
                </div>
                <div>
                  <p className="text-[11px] font-bold mb-1.5">3 · Stop the API, then restore</p>
                  <code className="block text-[11px] font-mono bg-dash-bg p-3 rounded-xl break-all">
                    npm run restore -- {data.backups[0]?.filename ?? '<filename>'} --yes
                  </code>
                </div>
                <p className="text-[11px] text-dash-muted leading-relaxed">
                  The command verifies the backup before touching anything, warns you if it holds less data
                  than the live database, and saves a copy of the current database first — so a restore made
                  in error is itself reversible.
                </p>
              </div>
            </Modal>

            <ConfirmDialog
              open={!!deleteId}
              title="Delete this snapshot?"
              body="The file is removed from disk. If it is your only verified backup, the property is left unprotected until the next one runs."
              confirmLabel="Delete"
              danger
              busy={remove.isPending}
              onCancel={() => setDeleteId(null)}
              onConfirm={async () => {
                if (!deleteId) return;
                try {
                  await remove.mutateAsync({ id: deleteId });
                  toast.success('Snapshot deleted');
                } catch (e) { toast.fail(e); }
                setDeleteId(null);
              }}
            />
          </div>
        );
      }}
    </QueryState>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1">{label}</p>
      <p className="text-[15px] font-black tabular-nums">{value}</p>
    </div>
  );
}
