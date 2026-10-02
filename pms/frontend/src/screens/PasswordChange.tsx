// Shown when an administrator has issued a temporary password. Nothing else in
// the app is reachable until it has been replaced.
import { useState, type FormEvent } from 'react';
import { KeyRound, AlertTriangle, LogOut } from 'lucide-react';
import { api, ApiError } from '../api';
import { useAuthStore } from '../stores';
import { PasswordStrength, passwordProblems } from '../components';

export function PasswordChangeScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const passwordChanged = useAuthStore((s) => s.passwordChanged);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problems = passwordProblems(next);
  const valid = current.length > 0 && problems.length === 0 && next === confirm;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/auth/change-password', {
        currentPassword: current, newPassword: next, signOutOthers: true,
      });
      await passwordChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change the password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-dash-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center">
              <div className="w-4 h-4 border-[2.5px] border-dash-yellow rounded-full border-t-transparent" />
            </div>
            <div>
              <p className="text-[13px] font-black tracking-tight leading-none">
                helio<span className="text-status-warn">.</span>pms
              </p>
              <p className="text-[10px] text-dash-muted mt-0.5">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="text-[11px] font-bold text-dash-muted hover:text-black flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>

        <div className="panel p-8">
          <div className="w-10 h-10 rounded-xl bg-dash-yellow flex items-center justify-center mb-4">
            <KeyRound className="w-5 h-5" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1.5">
            One more step
          </p>
          <h1 className="text-[22px] font-bold tracking-tight mb-2">Choose your own password</h1>
          <p className="text-[12px] text-dash-muted mb-6">
            You are signed in with a temporary password set by an administrator. Replace it before
            you carry on — they cannot see the one you choose.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <Field label="Temporary password">
              <input type="password" autoFocus autoComplete="current-password"
                value={current} onChange={(e) => setCurrent(e.target.value)} className={input} />
            </Field>
            <Field label="New password">
              <input type="password" autoComplete="new-password"
                value={next} onChange={(e) => setNext(e.target.value)} className={input} />
              <PasswordStrength password={next} />
            </Field>
            <Field label="Confirm new password">
              <input type="password" autoComplete="new-password"
                value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
            </Field>
            {confirm && next !== confirm && (
              <p className="text-[11px] text-status-bad font-semibold">Passwords do not match.</p>
            )}

            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50/70 px-3.5 py-2.5 flex items-start gap-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-status-bad mt-0.5 shrink-0" />
                <p className="text-[11px] font-semibold text-status-bad">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !valid}
              className="w-full inline-flex items-center justify-center gap-2 bg-black text-white rounded-full py-3 text-[13px] font-bold hover:bg-black/85 transition-colors disabled:opacity-40"
            >
              {busy ? 'Saving…' : 'Set my password and continue'}
            </button>
          </form>

          <p className="text-[10px] text-dash-muted mt-5 leading-relaxed">
            Any other device signed in as you will be signed out.
          </p>
        </div>
      </div>
    </div>
  );
}

const input =
  'w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] focus:border-black/40 transition-colors outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
