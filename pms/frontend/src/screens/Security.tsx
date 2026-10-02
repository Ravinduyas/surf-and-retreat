// Security centre: two-factor enrolment, recovery codes, active sessions, the
// sign-in log, and the reset links administrators hand out.
import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  ShieldCheck, ShieldOff, Smartphone, Copy, Check, RefreshCw, LogOut, KeyRound,
  Link2, Monitor, AlertTriangle,
} from 'lucide-react';
import { api, ApiError } from '../api';
import { useAuthStore, usePermission } from '../stores';
import { Card, Pill, Button, Field, TextInput, Modal } from '../ui';
import {
  QueryState, useToast, PasswordStrength, passwordProblems, InfoNote, WarnNote,
} from '../components';
import { relativeTime, timestamp } from '../format';
import {
  useMfaStatus, useLoginActivity, useSessions, useRevokeSession, useResetRequests,
  useUsers, useChangePassword,
} from '../queries';

export function SecurityCentre() {
  return (
    <div className="space-y-3">
      <TwoFactorCard />
      <div className="grid lg:grid-cols-2 gap-3">
        <PasswordCard />
        <SessionsCard />
      </div>
      <ActivityCard />
      <ResetRequestsCard />
    </div>
  );
}

// ─── Two-factor authentication ───────────────────────────────
function TwoFactorCard() {
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const status = useMfaStatus();

  const [enrolling, setEnrolling] = useState<{
    secret: string; manualKey: string; otpauthUri: string;
  } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);

  // The QR is drawn locally from the otpauth URI — the secret never leaves
  // this machine to be turned into an image somewhere else.
  useEffect(() => {
    if (!enrolling) { setQr(null); return; }
    QRCode.toDataURL(enrolling.otpauthUri, { width: 220, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setQr(null));
  }, [enrolling]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ secret: string; manualKey: string; otpauthUri: string }>(
        '/api/auth/mfa/setup');
      setEnrolling(res);
      setCode('');
    } catch (e) {
      toast.fail(e, 'Could not start two-factor setup');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ recoveryCodes: string[] }>('/api/auth/mfa/enable', { code });
      setRecoveryCodes(res.recoveryCodes);
      setEnrolling(null);
      status.refetch();
      toast.success('Two-factor authentication is on');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That code was not accepted');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              status.data?.enabled ? 'bg-dash-mint' : 'bg-dash-grey'
            }`}>
              {status.data?.enabled
                ? <ShieldCheck className="w-5 h-5 text-status-ok" />
                : <ShieldOff className="w-5 h-5 text-dash-muted" />}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[14px] font-bold">Two-factor authentication</p>
                <Pill tone={status.data?.enabled ? 'mint' : 'grey'}>
                  {status.data?.enabled ? 'On' : 'Off'}
                </Pill>
              </div>
              <p className="text-[12px] text-dash-muted max-w-lg leading-relaxed">
                {status.data?.enabled
                  ? `Enabled ${status.data.enrolledAt ? relativeTime(status.data.enrolledAt) : ''}. `
                    + `Signing in needs a code from your authenticator app. `
                    + `${status.data.recoveryCodesRemaining} recovery code(s) left.`
                  : 'Add a second step to sign-in using any authenticator app — Google Authenticator, '
                    + '1Password, Authy or Microsoft Authenticator. Strongly recommended for accounts '
                    + 'that can change rates, void postings or run the night audit.'}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {status.data?.enabled ? (
              <>
                <Button variant="secondary" icon={<RefreshCw className="w-3.5 h-3.5" />}
                  onClick={() => { setPassword(''); setRegenOpen(true); }}>
                  New recovery codes
                </Button>
                <Button variant="danger" onClick={() => { setPassword(''); setDisableOpen(true); }}>
                  Turn off
                </Button>
              </>
            ) : (
              <Button icon={<Smartphone className="w-3.5 h-3.5" />} disabled={busy} onClick={start}>
                {busy ? 'Preparing…' : 'Set up'}
              </Button>
            )}
          </div>
        </div>

        {enrolling && (
          <div className="mt-5 pt-5 border-t subtle-divider grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
                1 · Scan this with your authenticator
              </p>
              <div className="bg-white border border-black/5 rounded-2xl p-4 inline-block">
                {qr
                  ? <img src={qr} alt="Two-factor QR code" width={200} height={200} />
                  : <div className="w-full sm:w-[200px] h-[200px] bg-black/[0.04] rounded-xl animate-pulse" />}
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mt-4 mb-2">
                Or type this key in by hand
              </p>
              <div className="flex items-center gap-2">
                <code className="text-[12px] font-mono bg-dash-bg px-3 py-2 rounded-lg flex-1 break-all">
                  {enrolling.manualKey}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(enrolling.secret);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="text-dash-muted hover:text-black shrink-0"
                  title="Copy the key"
                >
                  {copied ? <Check className="w-4 h-4 text-status-ok" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-dash-muted mt-2">
                Account: {user?.email} · 6 digits · refreshes every 30 seconds
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
                2 · Enter the code it shows
              </p>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-[20px] font-bold text-center tracking-[0.4em] outline-none focus:border-black/40"
              />
              {error && (
                <p className="text-[11px] text-status-bad font-semibold mt-2 flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{error}
                </p>
              )}
              <div className="flex gap-2 mt-4">
                <Button disabled={code.length !== 6 || busy} onClick={confirm}>
                  {busy ? 'Checking…' : 'Turn on two-factor'}
                </Button>
                <Button variant="ghost" onClick={() => setEnrolling(null)}>Cancel</Button>
              </div>
              <div className="mt-5">
                <InfoNote>
                  Nothing changes until a code from your app is accepted, so you cannot lock yourself
                  out by closing this halfway through.
                </InfoNote>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Recovery codes — shown once */}
      <Modal
        open={!!recoveryCodes}
        onClose={() => setRecoveryCodes(null)}
        title="Save your recovery codes"
        footer={
          <div className="flex justify-between items-center gap-2">
            <Button variant="secondary" icon={<Copy className="w-3.5 h-3.5" />}
              onClick={() => {
                navigator.clipboard?.writeText((recoveryCodes ?? []).join('\n'));
                toast.success('Recovery codes copied');
              }}>
              Copy all
            </Button>
            <Button onClick={() => setRecoveryCodes(null)}>I have saved them</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <WarnNote>
            This is the only time these are shown. Each one signs you in once if you lose your phone.
            Keep them somewhere safe and separate from your password.
          </WarnNote>
          <div className="grid grid-cols-2 gap-2">
            {(recoveryCodes ?? []).map((c) => (
              <code key={c} className="text-[13px] font-mono bg-dash-bg px-3 py-2 rounded-lg text-center tracking-wide">
                {c}
              </code>
            ))}
          </div>
        </div>
      </Modal>

      {/* Turn off */}
      <Modal
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        title="Turn off two-factor authentication?"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDisableOpen(false)}>Cancel</Button>
            <Button variant="danger" disabled={!password || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.post('/api/auth/mfa/disable', { password });
                  toast.success('Two-factor authentication turned off');
                  setDisableOpen(false);
                  status.refetch();
                } catch (e) { toast.fail(e); } finally { setBusy(false); }
              }}>
              Turn off
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-[12px] text-dash-muted">
            Sign-in will go back to email and password alone. Your recovery codes are destroyed.
          </p>
          <Field label="Confirm your password" required>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-black/40" />
          </Field>
        </div>
      </Modal>

      {/* Regenerate recovery codes */}
      <Modal
        open={regenOpen}
        onClose={() => setRegenOpen(false)}
        title="Generate new recovery codes"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRegenOpen(false)}>Cancel</Button>
            <Button disabled={!password || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const res = await api.post<{ recoveryCodes: string[] }>(
                    '/api/auth/mfa/recovery-codes', { password });
                  setRegenOpen(false);
                  setRecoveryCodes(res.recoveryCodes);
                  status.refetch();
                } catch (e) { toast.fail(e); } finally { setBusy(false); }
              }}>
              Generate
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-[12px] text-dash-muted">
            The codes you have now stop working immediately.
          </p>
          <Field label="Confirm your password" required>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-black/40" />
          </Field>
        </div>
      </Modal>
    </>
  );
}

// ─── Password ────────────────────────────────────────────────
function PasswordCard() {
  const toast = useToast();
  const changePassword = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const problems = passwordProblems(next);
  const valid = current.length > 0 && problems.length === 0 && next === confirm;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <KeyRound className="w-4 h-4 text-dash-muted" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">Your password</p>
      </div>
      <div className="space-y-4">
        <Field label="Current password" required>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className={input} />
        </Field>
        <Field label="New password" required>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} className={input} />
          <PasswordStrength password={next} />
        </Field>
        <Field label="Confirm new password" required>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
        </Field>
        {confirm && next !== confirm && (
          <p className="text-[11px] text-status-bad font-semibold">Passwords do not match.</p>
        )}
        <Button disabled={!valid || changePassword.isPending}
          onClick={async () => {
            try {
              const res = await changePassword.mutateAsync({ currentPassword: current, newPassword: next });
              toast.success('Password changed',
                res.otherSessionsRevoked ? 'Other devices have been signed out' : undefined);
              setCurrent(''); setNext(''); setConfirm('');
            } catch (e) { toast.fail(e); }
          }}>
          Change password
        </Button>
        <p className="text-[10px] text-dash-muted">
          Changing your password signs out every other device.
        </p>
      </div>
    </Card>
  );
}

// ─── Sessions ────────────────────────────────────────────────
function SessionsCard() {
  const toast = useToast();
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const canManage = usePermission('admin.users');

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-dash-muted" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
            Where you are signed in
          </p>
        </div>
        <Button size="sm" variant="secondary" icon={<LogOut className="w-3 h-3" />}
          onClick={async () => {
            try {
              await api.post('/api/auth/sign-out-everywhere');
              toast.success('Signed out on every other device');
              sessions.refetch();
            } catch (e) { toast.fail(e); }
          }}>
          Sign out everywhere else
        </Button>
      </div>

      {!canManage && (
        <p className="text-[12px] text-dash-muted">
          Use “Sign out everywhere else” if you think someone else has your password.
        </p>
      )}

      {canManage && (
        <QueryState query={sessions} loadingRows={3} empty="No active sessions">
          {(rows: any[]) => (
            <div className="space-y-2 max-h-[280px] overflow-y-auto scroll-thin">
              {rows.filter((s) => !s.revoked).map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-dash-bg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[12px] font-bold truncate">{s.user}</p>
                      {s.current && <Pill tone="sky">This device</Pill>}
                    </div>
                    <p className="text-[10px] text-dash-muted truncate">
                      {s.ip} · seen {relativeTime(s.lastSeenAt)} · expires {timestamp(s.expiresAt)}
                    </p>
                  </div>
                  {!s.current && (
                    <Button size="sm" variant="ghost"
                      onClick={async () => {
                        try {
                          await revoke.mutateAsync({ id: s.id });
                          toast.success('Session revoked');
                        } catch (e) { toast.fail(e); }
                      }}>
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </QueryState>
      )}
    </Card>
  );
}

// ─── Sign-in log ─────────────────────────────────────────────
function ActivityCard() {
  const canSeeAll = usePermission('admin.users');
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const activity = useLoginActivity(canSeeAll && scope === 'all' ? 'all' : undefined);

  const tone = (outcome: string) =>
    outcome === 'success' ? 'mint'
      : outcome === 'mfa-recovery' ? 'yellow'
        : outcome === 'locked' ? 'red' : 'peach';

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
          Sign-in activity
        </p>
        {canSeeAll && (
          <div className="flex gap-1.5">
            <Button size="sm" variant={scope === 'mine' ? 'primary' : 'secondary'}
              onClick={() => setScope('mine')}>My account</Button>
            <Button size="sm" variant={scope === 'all' ? 'primary' : 'secondary'}
              onClick={() => setScope('all')}>Everyone</Button>
          </div>
        )}
      </div>

      <QueryState query={activity} loadingRows={4} empty="Nothing recorded yet">
        {(rows: any[]) => (
          <div className="max-h-[320px] overflow-auto scroll-thin">
            <table className="w-full min-w-[30rem] text-[12px]">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                  <th className="pb-2">When</th>
                  {scope === 'all' && <th className="pb-2">Account</th>}
                  <th className="pb-2">Outcome</th>
                  <th className="pb-2">IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-black/[0.03]">
                    <td className="py-2 text-dash-muted whitespace-nowrap">{timestamp(r.ts)}</td>
                    {scope === 'all' && <td className="py-2 font-semibold">{r.email}</td>}
                    <td className="py-2"><Pill tone={tone(r.outcome) as any}>{r.outcome}</Pill></td>
                    <td className="py-2 font-mono text-[10px] text-dash-muted">{r.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
    </Card>
  );
}

// ─── Password reset requests ─────────────────────────────────
function ResetRequestsCard() {
  const toast = useToast();
  const canManage = usePermission('admin.users');
  const requests = useResetRequests(canManage);
  const users = useUsers();
  const [issued, setIssued] = useState<{ link: string; user: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!canManage) return null;

  async function issue(userId: string, name: string) {
    setBusy(true);
    try {
      const res = await api.post<{ token: string; expiresAt: string; user: { name: string } }>(
        `/api/auth/reset-links/${userId}`);
      const base = window.location.origin + window.location.pathname;
      setIssued({
        link: `${base}#/reset-password/${res.token}`,
        user: res.user.name ?? name,
        expiresAt: res.expiresAt,
      });
      requests.refetch();
    } catch (e) { toast.fail(e); } finally { setBusy(false); }
  }

  return (
    <>
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="w-4 h-4 text-dash-muted" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
            Password reset requests
          </p>
        </div>

        <QueryState query={requests} loadingRows={2}
          empty="No outstanding requests"
          emptyHint="When someone uses “Forgotten your password?” their request appears here.">
          {(rows: any[]) => (
            <div className="space-y-2 mb-4">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-dash-yellow/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold">{r.user}</p>
                    <p className="text-[10px] text-dash-muted">
                      {r.email} · asked {relativeTime(r.requestedAt)} from {r.ip}
                    </p>
                  </div>
                  <Button size="sm" disabled={busy}
                    onClick={() => {
                      const u = users.data?.find((x) => x.email === r.email);
                      if (u) issue(u.id, u.name);
                    }}>
                    Issue link
                  </Button>
                </div>
              ))}
            </div>
          )}
        </QueryState>

        <div className="pt-3 border-t subtle-divider">
          <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-2">
            Issue a link to anyone
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(users.data ?? []).filter((u) => u.active).map((u) => (
              <button key={u.id} disabled={busy} onClick={() => issue(u.id, u.name)}
                className="px-3 py-1.5 rounded-full border border-black/10 bg-white text-[11px] font-bold hover:bg-dash-bg disabled:opacity-50">
                {u.name}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Modal
        open={!!issued}
        onClose={() => setIssued(null)}
        title={`Reset link for ${issued?.user ?? ''}`}
        footer={
          <div className="flex justify-between items-center gap-2">
            <Button variant="secondary" icon={<Copy className="w-3.5 h-3.5" />}
              onClick={() => {
                navigator.clipboard?.writeText(issued?.link ?? '');
                toast.success('Link copied');
              }}>
              Copy link
            </Button>
            <Button onClick={() => setIssued(null)}>Done</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <WarnNote>
            Hand this to the person directly and confirm who they are first. It works once, sets a new
            password, and signs every one of their sessions out. It expires {' '}
            {issued ? timestamp(issued.expiresAt) : ''}.
          </WarnNote>
          <code className="block text-[11px] font-mono bg-dash-bg p-3 rounded-xl break-all">
            {issued?.link}
          </code>
        </div>
      </Modal>
    </>
  );
}

const input =
  'w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-black/40';
