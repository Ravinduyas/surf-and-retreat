// The sign-in system: credentials → optional second factor → property.
// Also hosts the forgotten-password request and the reset-link screen, since
// both are reached while signed out.
import { useState, useEffect, useRef, type FormEvent } from 'react';
import {
  Eye, EyeOff, LogIn, AlertTriangle, ShieldCheck, ArrowLeft, KeyRound, Check,
  Lock, Clock, LifeBuoy,
} from 'lucide-react';
import { useAuthStore } from '../stores';
import { api, API_BASE, ApiError } from '../api';
import { PasswordStrength, passwordProblems } from '../components';

type Mode = 'credentials' | 'mfa' | 'forgot' | 'reset';

export function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const completeMfa = useAuthStore((s) => s.completeMfa);
  const busy = useAuthStore((s) => s.busy);
  const storeError = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  // A reset link drops the user straight into the reset form.
  const resetTokenFromUrl = (() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const match = hash.match(/reset-password\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  })();

  const [mode, setMode] = useState<Mode>(resetTokenFromUrl ? 'reset' : 'credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lockedMinutes, setLockedMinutes] = useState<number | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  // Second factor
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [challengeUser, setChallengeUser] = useState<{ name: string; email: string } | null>(null);
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryLeft, setRecoveryLeft] = useState<number | null>(null);

  const message = error ?? storeError;

  function resetFeedback() {
    setError(null);
    setNotice(null);
    setLockedMinutes(null);
    setAttemptsLeft(null);
    clearError();
  }

  async function submitCredentials(e: FormEvent) {
    e.preventDefault();
    resetFeedback();
    if (!email.trim() || !password) {
      setError('Enter your email and password');
      return;
    }
    try {
      const result = await login(email.trim(), password, remember);
      if (result.mfaRequired) {
        setChallengeToken(result.challengeToken!);
        setChallengeUser(result.user ?? null);
        setRecoveryLeft(result.recoveryCodesRemaining ?? null);
        setPassword('');
        setMode('mfa');
      }
      // Otherwise the store has already switched the app into its ready state.
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.code === 'locked') setLockedMinutes(err.details?.minutes ?? null);
        if (typeof err.details?.remainingAttempts === 'number') {
          setAttemptsLeft(err.details.remainingAttempts);
        }
      } else {
        setError(err instanceof Error ? err.message : 'Sign-in failed');
      }
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    resetFeedback();
    if (!challengeToken) return;
    try {
      await completeMfa(challengeToken, code.trim(), remember);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code was not accepted');
      if (err instanceof ApiError && err.code === 'challenge_expired') {
        setMode('credentials');
        setChallengeToken(null);
        setCode('');
      }
    }
  }

  return (
    <div className="min-h-screen bg-dash-bg flex items-center justify-center p-4">
      <div className="w-full max-w-[900px] grid md:grid-cols-2 gap-4">
        <BrandPanel />

        <div className="panel p-8 flex flex-col justify-center min-h-[520px]">
          <div className="md:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center">
              <div className="w-4 h-4 border-[2.5px] border-dash-yellow rounded-full border-t-transparent" />
            </div>
            <p className="text-[14px] font-black tracking-tight">
              helio<span className="text-status-warn">.</span>pms
            </p>
          </div>

          {mode === 'credentials' && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1.5">Sign in</p>
              <h2 className="text-[22px] font-bold tracking-tight mb-6">Welcome back</h2>

              <form onSubmit={submitCredentials} className="space-y-4">
                <Labelled label="Email">
                  <input
                    type="email"
                    autoComplete="username"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@property.com"
                    className={inputCls}
                  />
                </Labelled>

                <Labelled label="Password">
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyUp={(e) => setCapsLock(e.getModifierState?.('CapsLock') ?? false)}
                      placeholder="••••••••"
                      className={`${inputCls} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-dash-muted hover:text-black"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {capsLock && (
                    <p className="text-[11px] text-status-warn font-semibold mt-1.5 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" /> Caps Lock is on
                    </p>
                  )}
                </Labelled>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="w-3.5 h-3.5 accent-black"
                    />
                    <span className="text-[11px] font-semibold text-dash-muted">Keep me signed in</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => { resetFeedback(); setMode('forgot'); }}
                    className="text-[11px] font-bold text-dash-muted hover:text-black"
                  >
                    Forgotten your password?
                  </button>
                </div>

                {message && (
                  <Alert tone={lockedMinutes ? 'lock' : 'error'}>
                    <p className="font-semibold">{message}</p>
                    {lockedMinutes !== null && (
                      <p className="mt-1 opacity-80">
                        Try again in {lockedMinutes} minute{lockedMinutes === 1 ? '' : 's'}, or ask an
                        administrator to unlock the account.
                      </p>
                    )}
                    {attemptsLeft !== null && attemptsLeft > 0 && (
                      <p className="mt-1 opacity-80">
                        {attemptsLeft} attempt{attemptsLeft === 1 ? '' : 's'} left before the account locks.
                      </p>
                    )}
                  </Alert>
                )}

                <button type="submit" disabled={busy} className={primaryBtn}>
                  {busy ? 'Signing in…' : <><LogIn className="w-4 h-4" /> Sign in</>}
                </button>
              </form>

              <p className="text-[10px] text-dash-muted mt-6 leading-relaxed">
                Connected to <span className="font-mono">{API_BASE}</span>. Sessions last 12 hours,
                or 14 days if you choose to stay signed in.
              </p>
            </>
          )}

          {mode === 'mfa' && (
            <MfaStep
              user={challengeUser}
              code={code}
              setCode={setCode}
              useRecovery={useRecovery}
              setUseRecovery={setUseRecovery}
              recoveryLeft={recoveryLeft}
              busy={busy}
              message={message}
              onSubmit={submitCode}
              onBack={() => { resetFeedback(); setMode('credentials'); setChallengeToken(null); setCode(''); }}
            />
          )}

          {mode === 'forgot' && (
            <ForgotStep
              onBack={() => { resetFeedback(); setMode('credentials'); }}
              notice={notice}
              setNotice={setNotice}
            />
          )}

          {mode === 'reset' && (
            <ResetStep
              token={resetTokenFromUrl ?? ''}
              onDone={() => {
                window.location.hash = '#/dashboard';
                setMode('credentials');
                setNotice('Your password has been changed — sign in with it now.');
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Second factor ───────────────────────────────────────────
function MfaStep({
  user, code, setCode, useRecovery, setUseRecovery, recoveryLeft, busy, message, onSubmit, onBack,
}: {
  user: { name: string; email: string } | null;
  code: string;
  setCode: (v: string) => void;
  useRecovery: boolean;
  setUseRecovery: (v: boolean) => void;
  recoveryLeft: number | null;
  busy: boolean;
  message: string | null;
  onSubmit: (e: FormEvent) => void;
  onBack: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, [useRecovery]);

  return (
    <>
      <button onClick={onBack} className="text-[11px] font-bold text-dash-muted hover:text-black flex items-center gap-1.5 mb-5">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      <div className="w-10 h-10 rounded-xl bg-dash-mint flex items-center justify-center mb-4">
        <ShieldCheck className="w-5 h-5 text-status-ok" />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1.5">
        Two-factor authentication
      </p>
      <h2 className="text-[22px] font-bold tracking-tight mb-2">
        {useRecovery ? 'Use a recovery code' : 'Enter your code'}
      </h2>
      <p className="text-[12px] text-dash-muted mb-6">
        {useRecovery
          ? 'Each recovery code works once. Using one does not turn two-factor off.'
          : `Open your authenticator app and enter the 6-digit code for ${user?.email ?? 'your account'}.`}
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(useRecovery
            ? e.target.value.toUpperCase()
            : e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode={useRecovery ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          placeholder={useRecovery ? 'XXXXX-XXXXX' : '000000'}
          className={`${inputCls} text-center tracking-[0.4em] text-[18px] font-bold ${useRecovery ? 'tracking-[0.2em] text-[15px]' : ''}`}
        />

        {message && <Alert tone="error"><p className="font-semibold">{message}</p></Alert>}

        <button type="submit" disabled={busy || code.length < (useRecovery ? 6 : 6)} className={primaryBtn}>
          {busy ? 'Checking…' : <><Check className="w-4 h-4" /> Verify and sign in</>}
        </button>
      </form>

      <button
        onClick={() => { setUseRecovery(!useRecovery); setCode(''); }}
        className="text-[11px] font-bold text-dash-muted hover:text-black mt-5 flex items-center gap-1.5"
      >
        <LifeBuoy className="w-3.5 h-3.5" />
        {useRecovery ? 'Use your authenticator app instead' : 'Lost your phone? Use a recovery code'}
      </button>
      {useRecovery && recoveryLeft !== null && (
        <p className="text-[10px] text-dash-muted mt-2">
          {recoveryLeft} unused recovery code{recoveryLeft === 1 ? '' : 's'} left on this account.
        </p>
      )}
    </>
  );
}

// ─── Forgotten password ──────────────────────────────────────
function ForgotStep({
  onBack, notice, setNotice,
}: {
  onBack: () => void;
  notice: string | null;
  setNotice: (v: string | null) => void;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ message: string }>('/api/auth/forgot-password', { email: email.trim() });
      setNotice(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the request');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={onBack} className="text-[11px] font-bold text-dash-muted hover:text-black flex items-center gap-1.5 mb-5">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
      </button>

      <div className="w-10 h-10 rounded-xl bg-dash-yellow flex items-center justify-center mb-4">
        <KeyRound className="w-5 h-5" />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1.5">Account recovery</p>
      <h2 className="text-[22px] font-bold tracking-tight mb-2">Forgotten your password?</h2>
      <p className="text-[12px] text-dash-muted mb-6">
        Tell us the address on the account and an administrator will be able to issue you a reset link.
      </p>

      {notice ? (
        <Alert tone="ok">
          <p className="font-semibold">Request sent</p>
          <p className="mt-1 opacity-80">{notice}</p>
        </Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Labelled label="Email">
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@property.com"
              className={inputCls}
            />
          </Labelled>
          {error && <Alert tone="error"><p className="font-semibold">{error}</p></Alert>}
          <button type="submit" disabled={busy || !email.trim()} className={primaryBtn}>
            {busy ? 'Sending…' : 'Request a reset'}
          </button>
        </form>
      )}

      <p className="text-[10px] text-dash-muted mt-6 leading-relaxed">
        No email provider is configured on this installation, so reset links are handed over by an
        administrator rather than emailed. That is deliberate — nothing claims to have sent a message
        it did not send.
      </p>
    </>
  );
}

// ─── Reset with a token ──────────────────────────────────────
function ResetStep({ token, onDone }: { token: string; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const problems = passwordProblems(password);
  const valid = problems.length === 0 && password === confirm;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/auth/reset-password', { token, newPassword: password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the password');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <>
        <div className="w-10 h-10 rounded-xl bg-dash-mint flex items-center justify-center mb-4">
          <Check className="w-5 h-5 text-status-ok" />
        </div>
        <h2 className="text-[22px] font-bold tracking-tight mb-2">Password changed</h2>
        <p className="text-[12px] text-dash-muted mb-6">
          Every existing session on this account has been signed out. Sign in with your new password.
        </p>
        <button onClick={onDone} className={primaryBtn}>Go to sign in</button>
      </>
    );
  }

  return (
    <>
      <div className="w-10 h-10 rounded-xl bg-dash-yellow flex items-center justify-center mb-4">
        <Lock className="w-5 h-5" />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1.5">Account recovery</p>
      <h2 className="text-[22px] font-bold tracking-tight mb-2">Choose a new password</h2>
      <p className="text-[12px] text-dash-muted mb-6">
        This link works once and expires an hour after it was issued.
      </p>

      <form onSubmit={submit} className="space-y-4">
        <Labelled label="New password">
          <input type="password" autoFocus value={password}
            onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          <PasswordStrength password={password} />
        </Labelled>
        <Labelled label="Confirm new password">
          <input type="password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
        </Labelled>
        {confirm && password !== confirm && (
          <p className="text-[11px] text-status-bad font-semibold">Passwords do not match.</p>
        )}
        {error && <Alert tone="error"><p className="font-semibold">{error}</p></Alert>}
        <button type="submit" disabled={busy || !valid} className={primaryBtn}>
          {busy ? 'Saving…' : 'Set new password'}
        </button>
      </form>
    </>
  );
}

// ─── Shared pieces ───────────────────────────────────────────
export const inputCls =
  'w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] focus:border-black/40 transition-colors outline-none';

const primaryBtn =
  'w-full inline-flex items-center justify-center gap-2 bg-black text-white rounded-full py-3 text-[13px] font-bold hover:bg-black/85 transition-colors disabled:opacity-40';

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

function Alert({ tone, children }: { tone: 'error' | 'ok' | 'lock'; children: React.ReactNode }) {
  const styles = {
    error: 'border-red-100 bg-red-50/70 text-status-bad',
    lock: 'border-amber-200 bg-amber-50/70 text-status-warn',
    ok: 'border-emerald-100 bg-emerald-50/60 text-status-ok',
  }[tone];
  const Icon = tone === 'ok' ? Check : tone === 'lock' ? Clock : AlertTriangle;
  return (
    <div className={`rounded-xl border px-3.5 py-2.5 flex items-start gap-2.5 ${styles}`}>
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <div className="text-[11px] leading-relaxed">{children}</div>
    </div>
  );
}

function BrandPanel() {
  return (
    <div className="hidden md:flex flex-col justify-between panel-dark p-8">
      <div>
        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
            <div className="w-4 h-4 border-[2.5px] border-black rounded-full border-t-transparent" />
          </div>
          <p className="text-[15px] font-black tracking-tight">
            helio<span className="text-dash-yellow">.</span>pms
          </p>
        </div>
        <h1 className="text-[30px] font-black leading-[1.1] tracking-tight mb-4">
          Run the whole property from one place.
        </h1>
        <p className="text-[13px] text-white/60 leading-relaxed max-w-sm">
          Reservations, front desk, housekeeping, cashiering, the night audit and channel
          distribution — all reading and writing the same live data.
        </p>
      </div>
      <div className="space-y-2.5">
        {[
          'Two-factor authentication on any account',
          'Role-based permissions enforced on the server',
          'Every sign-in and elevated action recorded',
        ].map((line) => (
          <div key={line} className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-dash-yellow mt-1.5 shrink-0" />
            <p className="text-[12px] text-white/70 leading-snug">{line}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
