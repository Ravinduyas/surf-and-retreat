// Shared building blocks for live-data screens: loading and error states,
// permission gates, toasts, confirmation dialogs and money inputs.
import {
  createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, X, Lock, Inbox, RefreshCw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ApiError, OfflineRefusal, QueuedOffline } from './api';
import { usePermission } from './stores';
import { fromMinor, toMinor, money } from './format';
import { Button, EmptyState } from './ui';

// ─── Query state ─────────────────────────────────────────────
export function Loading({ label = 'Loading…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="py-6" role="status" aria-live="polite">
      <p className="sr-only">{label}</p>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-11 rounded-xl bg-black/[0.04] animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof ApiError
    ? error.message
    : error instanceof Error ? error.message : 'Something went wrong';
  const details = error instanceof ApiError ? error.details : undefined;
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-status-bad mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-status-bad">{message}</p>
          {Array.isArray(details?.violations) && details.violations.length > 0 && (
            <ul className="mt-2 space-y-1">
              {details.violations.map((v: any, i: number) => (
                <li key={i} className="text-[11px] text-dash-muted">· {v.message}</li>
              ))}
            </ul>
          )}
          {Array.isArray(details?.shortfall) && details.shortfall.length > 0 && (
            <p className="mt-2 text-[11px] text-dash-muted">
              Sold out on {details.shortfall.map((s: any) => s.date).join(', ')}
            </p>
          )}
          {Array.isArray(details?.issues) && details.issues.length > 0 && (
            <ul className="mt-2 space-y-1">
              {details.issues.map((v: any, i: number) => (
                <li key={i} className="text-[11px] text-dash-muted">· {v.message}</li>
              ))}
            </ul>
          )}
          {typeof details?.balanceMinor === 'number' && (
            <p className="mt-2 text-[11px] text-dash-muted">
              Outstanding balance: <span className="font-bold">{money(details.balanceMinor)}</span>
            </p>
          )}
        </div>
        {onRetry && (
          <button onClick={onRetry} className="text-[11px] font-bold text-status-bad hover:underline flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Renders the right thing for a query: skeleton, error, empty state or data.
 * Screens use this so a failed fetch is never silently shown as "no records".
 */
export function QueryState<T>({
  query, children, empty, emptyHint, loadingRows = 4, isEmpty,
}: {
  query: { isLoading: boolean; isError: boolean; error: unknown; data: T | undefined; refetch?: () => void };
  children: (data: T) => ReactNode;
  empty?: string;
  emptyHint?: string;
  loadingRows?: number;
  isEmpty?: (data: T) => boolean;
}) {
  if (query.isLoading) return <Loading rows={loadingRows} />;
  if (query.isError) return <ErrorNote error={query.error} onRetry={query.refetch} />;
  if (query.data === undefined) return <Loading rows={loadingRows} />;
  const emptyCheck = isEmpty
    ? isEmpty(query.data)
    : Array.isArray(query.data) && query.data.length === 0;
  if (emptyCheck && empty) {
    return <EmptyState title={empty} hint={emptyHint} icon={<Inbox className="w-6 h-6" />} />;
  }
  return <>{children(query.data)}</>;
}

// ─── Permissions ─────────────────────────────────────────────
export function RequirePermission({
  permission, children, fallback,
}: {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const allowed = usePermission(permission);
  if (allowed) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-dash-bg flex items-center justify-center mb-3 text-dash-muted">
        <Lock className="w-5 h-5" />
      </div>
      <p className="font-bold text-[13px] mb-1">You do not have access to this</p>
      <p className="text-[11px] text-dash-muted max-w-sm">
        This area needs the <span className="font-mono">{permission}</span> permission.
        Ask an administrator to change your role.
      </p>
    </div>
  );
}

/** Disables an action for roles that cannot perform it, with an explanation. */
export function PermissionButton({
  permission, children, ...rest
}: {
  permission: string;
  children?: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'yellow';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const allowed = usePermission(permission);
  return (
    <span title={allowed ? undefined : `Requires ${permission}`}>
      <Button {...rest} disabled={rest.disabled || !allowed}>{children}</Button>
    </span>
  );
}

// ─── Toasts ──────────────────────────────────────────────────
type Toast = { id: number; kind: 'ok' | 'warn' | 'error'; title: string; body?: string };
const ToastCtx = createContext<{
  push: (t: Omit<Toast, 'id'>) => void;
  success: (title: string, body?: string) => void;
  fail: (error: unknown, fallback?: string) => void;
}>({ push: () => {}, success: () => {}, fail: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), t.kind === 'error' ? 9000 : 4500);
  }, []);

  const value = useMemo(() => ({
    push,
    success: (title: string, body?: string) => push({ kind: 'ok', title, body }),
    fail: (error: unknown, fallback = 'Action failed') => {
      // A change that was safely queued is not a failure, and calling it one
      // teaches people to distrust the queue. It is also not a success — the
      // wording says exactly where it is: on this device, not on the server.
      if (error instanceof QueuedOffline) {
        push({
          kind: 'warn',
          title: 'Saved on this device',
          body: `${error.description} — it will sync when you are back online.`,
        });
        return;
      }
      // A refusal carries its own reason as a sentence. Showing a generic
      // "action failed" over the top of it would throw away the useful part.
      if (error instanceof OfflineRefusal) {
        push({ kind: 'error', title: 'Not possible offline', body: error.message });
        return;
      }
      const message = error instanceof ApiError ? error.message
        : error instanceof Error ? error.message : fallback;
      const details = error instanceof ApiError ? error.details : undefined;
      const extra = Array.isArray(details?.violations) && details.violations.length
        ? details.violations.map((v: any) => v.message).join(' · ')
        : Array.isArray(details?.shortfall) && details.shortfall.length
          ? `Sold out on ${details.shortfall.map((s: any) => s.date).join(', ')}`
          : undefined;
      push({ kind: 'error', title: message, body: extra });
    },
  }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      {/* A fixed 340px column is wider than the safe area on a 360px phone, so
          below `sm` the stack spans the viewport with a margin either side
          instead. It also sits higher there, to clear the floating quick bar
          rather than land on top of it. */}
      <div className="fixed bottom-24 sm:bottom-20 left-4 right-4 sm:left-auto sm:right-5 z-[60] flex flex-col gap-2 sm:w-[340px] pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 20, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.98 }}
              className={`pointer-events-auto panel px-4 py-3 flex items-start gap-3 shadow-xl ${
                t.kind === 'error' ? 'border-red-200' : t.kind === 'warn' ? 'border-amber-200' : ''
              }`}
            >
              {t.kind === 'ok' && <CheckCircle2 className="w-4 h-4 text-status-ok mt-0.5 shrink-0" />}
              {t.kind === 'warn' && <AlertTriangle className="w-4 h-4 text-status-warn mt-0.5 shrink-0" />}
              {t.kind === 'error' && <AlertTriangle className="w-4 h-4 text-status-bad mt-0.5 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold leading-snug">{t.title}</p>
                {t.body && <p className="text-[11px] text-dash-muted mt-0.5 leading-snug">{t.body}</p>}
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="text-dash-muted hover:text-black shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

// ─── Confirmation ────────────────────────────────────────────
export function ConfirmDialog({
  open, title, body, confirmLabel = 'Confirm', danger, onConfirm, onCancel, busy,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  // Escape cancels. A confirmation is the dialog people most want out of
  // quickly, and it is the one where reaching for the mouse to dismiss a
  // question you did not mean to open is most irritating.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="bg-white rounded-[1.5rem] sm:rounded-[2rem] border border-black/5 shadow-2xl w-full max-w-md dialog-max-h flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="px-5 sm:px-6 py-5 overflow-y-auto scroll-thin">
          <h3 className="font-bold tracking-tight mb-2">{title}</h3>
          {body && <div className="text-[12px] text-dash-muted leading-relaxed">{body}</div>}
        </div>
        {/* `flex-wrap` because a long confirm label — "Post and close the day" —
            beside Cancel is wider than a phone, and a Confirm button that has
            slid off the edge is a dialog you cannot answer. */}
        <div className="px-5 sm:px-6 py-4 border-t subtle-divider flex flex-wrap justify-end gap-2 shrink-0">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Inputs ──────────────────────────────────────────────────
/** Money input that edits decimals but reports integer minor units. */
export function MoneyInput({
  valueMinor, onChange, placeholder, className = '', disabled,
}: {
  valueMinor: number;
  onChange: (minor: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(() => fromMinor(valueMinor));
  const [focused, setFocused] = useState(false);
  const display = focused ? text : fromMinor(valueMinor);
  return (
    <input
      inputMode="decimal"
      disabled={disabled}
      value={display}
      placeholder={placeholder}
      onFocus={() => { setText(fromMinor(valueMinor)); setFocused(true); }}
      onBlur={() => { setFocused(false); onChange(toMinor(text)); }}
      onChange={(e) => { setText(e.target.value); onChange(toMinor(e.target.value)); }}
      className={`w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] text-right tabular-nums focus:border-black/40 transition-colors disabled:opacity-50 ${className}`}
    />
  );
}

export function NumberInput({
  value, onChange, min, max, className = '', disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      disabled={disabled}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (!Number.isFinite(n)) return;
        let v = Math.round(n);
        if (min !== undefined) v = Math.max(min, v);
        if (max !== undefined) v = Math.min(max, v);
        onChange(v);
      }}
      className={`w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] focus:border-black/40 transition-colors disabled:opacity-50 ${className}`}
    />
  );
}

export function DateInput({
  value, onChange, min, max, className = '', disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="date"
      value={value ?? ''}
      min={min}
      max={max}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] focus:border-black/40 transition-colors disabled:opacity-50 ${className}`}
    />
  );
}

export function Toggle({
  checked, onChange, label, disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 disabled:opacity-50"
    >
      <span className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${checked ? 'bg-black' : 'bg-black/15'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      {label && <span className="text-[12px] font-semibold">{label}</span>}
    </button>
  );
}

// ─── Passwords ───────────────────────────────────────────────
/**
 * The rules the server actually enforces, so the form never accepts something
 * the API will then reject.
 */
export function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < 8) problems.push('At least 8 characters');
  if (!/[a-zA-Z]/.test(password)) problems.push('At least one letter');
  if (!/[0-9]/.test(password)) problems.push('At least one number');
  return problems;
}

/** Advisory strength on top of the hard rules — length and variety. */
function passwordScore(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return Math.min(4, Math.max(1, score - 1));
}

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const problems = passwordProblems(password);
  const score = problems.length ? 1 : passwordScore(password);
  const labels = ['Too weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
  const tones = ['bg-status-bad', 'bg-status-bad', 'bg-status-warn', 'bg-status-ok', 'bg-status-ok'];
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${i < score ? tones[score] : 'bg-black/[0.08]'}`}
          />
        ))}
      </div>
      <p className={`text-[10px] mt-1 font-semibold ${problems.length ? 'text-status-bad' : 'text-dash-muted'}`}>
        {problems.length ? `Needs: ${problems.join(' · ')}` : labels[score]}
      </p>
    </div>
  );
}

// ─── Status helpers ──────────────────────────────────────────
export function statusTone(status: string): 'grey' | 'mint' | 'yellow' | 'peach' | 'sky' | 'red' | 'purple' {
  switch (status) {
    case 'Checked-in': case 'connected': case 'done': case 'inspected': case 'healthy':
    case 'Vacant Inspected': case 'paid': case 'resolved':
      return 'mint';
    case 'Confirmed': case 'Guaranteed': case 'Occupied Clean':
      return 'sky';
    case 'Tentative': case 'pending': case 'queued': case 'in-progress': case 'degraded':
    case 'Vacant Dirty': case 'Occupied Dirty': case 'issued':
      return 'yellow';
    case 'Cancelled': case 'No-show': case 'error': case 'failed': case 'down':
    case 'Out of Order':
      return 'red';
    case 'Checked-out': case 'closed': case 'Vacant Clean':
      return 'grey';
    case 'Out of Service': case 'paused': case 'not-configured': case 'skipped':
      return 'peach';
    default:
      return 'grey';
  }
}

export function OccupancyBar({ bp, className = '' }: { bp: number; className?: string }) {
  const pctValue = Math.min(100, Math.max(0, bp / 100));
  const tone = pctValue >= 90 ? 'bg-status-bad' : pctValue >= 70 ? 'bg-status-warn' : 'bg-status-ok';
  return (
    <div className={`h-1.5 rounded-full bg-black/[0.06] overflow-hidden ${className}`}>
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${pctValue}%` }} />
    </div>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-dash-sky/40 border border-black/5 p-3 flex items-start gap-2.5">
      <Info className="w-3.5 h-3.5 text-status-info mt-0.5 shrink-0" />
      <p className="text-[11px] text-dash-text leading-relaxed">{children}</p>
    </div>
  );
}

export function WarnNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-dash-peach/50 border border-black/5 p-3 flex items-start gap-2.5">
      <AlertTriangle className="w-3.5 h-3.5 text-status-warn mt-0.5 shrink-0" />
      <p className="text-[11px] text-dash-text leading-relaxed">{children}</p>
    </div>
  );
}
