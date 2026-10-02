import { useEffect, type ReactNode } from 'react';
import { Check, ChevronRight } from 'lucide-react';

// ─── Card ────────────────────────────────────────────────────────────────────
type CardTone =
  | 'plain' | 'pink' | 'purple' | 'yellow' | 'grey' | 'mint' | 'sky'
  | 'peach' | 'lilac' | 'cream' | 'dark' | 'red';

const TONE_BG: Record<CardTone, string> = {
  plain: 'bg-white',
  pink: 'bg-dash-pink',
  purple: 'bg-dash-purple',
  yellow: 'bg-dash-yellow',
  grey: 'bg-dash-grey',
  mint: 'bg-dash-mint',
  sky: 'bg-dash-sky',
  peach: 'bg-dash-peach',
  lilac: 'bg-dash-lilac',
  cream: 'bg-dash-cream',
  dark: 'bg-black text-white',
  red: 'bg-red-100 text-status-bad',
};

export function Card({
  tone = 'plain',
  className = '',
  children,
  onClick,
  padded = true,
}: {
  tone?: CardTone;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  padded?: boolean;
}) {
  // `min-w-0` because a card is almost always a grid or flex child, and those
  // default to `min-width: auto` — "never narrower than my content". A card
  // holding a 648px table therefore stayed 648px wide on a 390px phone and
  // stretched its whole column, so the table's own scroll wrapper never got the
  // chance to scroll. With this, the card shrinks and the table scrolls inside it.
  return (
    <div
      onClick={onClick}
      className={`${TONE_BG[tone]} rounded-task border border-black/5 min-w-0 ${padded ? 'p-5' : ''} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
export function StatCard({
  label, value, delta, tone = 'plain', icon, suffix,
}: {
  label: string;
  value: string | number;
  delta?: { value: string; positive?: boolean };
  tone?: CardTone;
  icon?: ReactNode;
  suffix?: string;
}) {
  return (
    <Card tone={tone}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">{label}</p>
        {icon && <div className="opacity-60">{icon}</div>}
      </div>
      <div className="flex items-end gap-1.5">
        <p className="text-[26px] font-black leading-none tracking-tight">{value}</p>
        {suffix && <p className="text-xs font-bold text-dash-muted mb-1">{suffix}</p>}
      </div>
      {delta && (
        <p className={`text-[11px] font-semibold mt-2 ${delta.positive ? 'text-status-ok' : 'text-status-bad'}`}>
          {delta.positive ? '▲' : '▼'} {delta.value}
        </p>
      )}
    </Card>
  );
}

// ─── Pill / Badge ────────────────────────────────────────────────────────────
export function Pill({
  children, tone = 'grey', solid = false, className = '',
}: {
  children: ReactNode;
  tone?: CardTone;
  solid?: boolean;
  className?: string;
}) {
  const cls = solid
    ? `${TONE_BG[tone]} ${tone === 'dark' ? 'text-white' : 'text-black'}`
    : 'bg-white border border-black/10';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${cls} ${className}`}>
      {children}
    </span>
  );
}

export function Badge({
  children, color = 'grey',
}: {
  children: ReactNode;
  color?: 'grey' | 'pink' | 'purple' | 'yellow' | 'mint' | 'peach' | 'sky' | 'lilac' | 'red';
}) {
  const map: Record<string, string> = {
    grey: 'bg-dash-grey text-dash-text',
    pink: 'bg-dash-pink text-dash-text',
    purple: 'bg-dash-purple text-dash-text',
    yellow: 'bg-dash-yellow text-dash-text',
    mint: 'bg-dash-mint text-status-ok',
    peach: 'bg-dash-peach text-status-warn',
    sky: 'bg-dash-sky text-status-info',
    lilac: 'bg-dash-lilac text-dash-text',
    red: 'bg-red-100 text-status-bad',
  };
  return (
    <span className={`inline-flex items-center px-2 py-[3px] rounded-md text-[10px] font-bold uppercase tracking-wide ${map[color]}`}>
      {children}
    </span>
  );
}

// ─── Status Dot ──────────────────────────────────────────────────────────────
export function StatusDot({ tone = 'ok', pulse = false }: { tone?: 'ok' | 'warn' | 'bad' | 'info' | 'mute'; pulse?: boolean }) {
  const map = {
    ok: 'bg-status-ok',
    warn: 'bg-status-warn',
    bad: 'bg-status-bad',
    info: 'bg-status-info',
    mute: 'bg-dash-muted',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${map[tone]} ${pulse ? 'pulse-dot' : ''}`} />;
}

// ─── Button ──────────────────────────────────────────────────────────────────
export function Button({
  children, onClick, variant = 'primary', size = 'md', icon, disabled = false, className = '', type = 'button',
  title,
}: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'yellow';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
  /**
   * Tooltip, and the accessible name when the button is icon-only.
   * A bare chevron says nothing to a screen reader, or to anyone who has not
   * used the screen before.
   */
  title?: string;
}) {
  const variants = {
    primary: 'bg-black text-white hover:bg-black/85',
    secondary: 'bg-white border border-black/10 hover:bg-dash-bg',
    ghost: 'hover:bg-black/5',
    danger: 'bg-red-50 text-status-bad border border-red-100 hover:bg-red-100',
    yellow: 'bg-dash-yellow text-black hover:brightness-95',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-[11px] gap-1.5',
    md: 'px-4 py-2 text-[12px] gap-2',
    lg: 'px-5 py-2.5 text-[13px] gap-2',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title && !children ? title : undefined}
      className={`inline-flex items-center justify-center font-bold rounded-full transition-colors ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

// ─── Field (input) ───────────────────────────────────────────────────────────
export function Field({
  label, required, children, hint, className = '',
}: {
  label?: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="block text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1.5">
          {label} {required && <span className="text-status-bad">*</span>}
        </span>
      )}
      {children}
      {hint && <span className="block text-[10px] text-dash-muted mt-1">{hint}</span>}
    </label>
  );
}

export function TextInput({
  value, onChange, placeholder, type = 'text', className = '',
}: {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] focus:border-black/40 transition-colors ${className}`}
    />
  );
}

export function Select({
  value, onChange, options, className = '', disabled,
}: {
  value?: string;
  onChange?: (v: string) => void;
  options: { label: string; value: string }[];
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      className={`w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] focus:border-black/40 transition-colors disabled:opacity-50 ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────
export function Tabs<T extends string>({
  tabs, active, onChange,
}: {
  tabs: { value: T; label: string; count?: number }[];
  active: T;
  // Permissive on input so callers can pass `useState` setters or arrow fns interchangeably.
  onChange: (v: any) => void;
}) {
  // Scroll sideways rather than wrap. A tab is a short label by design, and
  // letting "Out of order" break over three lines made the strip taller than the
  // content it was filtering while still not fitting. `whitespace-nowrap` keeps
  // each tab one line; the row scrolls when there are more than fit.
  return (
    <div className="inline-flex max-w-full glass-pill rounded-full p-1 overflow-x-auto scroll-thin">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`px-3 sm:px-4 py-1.5 text-[11px] font-bold rounded-full transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
            active === t.value ? 'bg-black text-white' : 'text-dash-muted hover:text-black'
          }`}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={`px-1.5 rounded-full text-[10px] ${active === t.value ? 'bg-white/20' : 'bg-black/5'}`}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Wizard Steps Indicator ─────────────────────────────────────────────────
export function WizardSteps({
  steps, current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s} className="flex items-center gap-3">
            <div className={`flex items-center gap-2 ${active || done ? 'text-black' : 'text-dash-muted'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                done ? 'bg-black text-white' : active ? 'bg-dash-yellow text-black' : 'bg-dash-grey text-dash-muted'
              }`}>
                {done ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span className="text-[11px] font-bold">{s}</span>
            </div>
            {i < steps.length - 1 && <ChevronRight className="w-3 h-3 text-dash-muted" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────
export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="w-14 h-14 rounded-full bg-dash-bg flex items-center justify-center mb-4 text-dash-muted">{icon}</div>}
      <p className="font-bold mb-1">{title}</p>
      {hint && <p className="text-[12px] text-dash-muted max-w-sm">{hint}</p>}
    </div>
  );
}

// ─── Section header ─────────────────────────────────────────────────────────
export function SectionHeader({
  eyebrow, title, action, count, actionAlign = 'end',
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  count?: number | string;
  /**
   * Where the action sits against the title on a desktop.
   *
   * `end` (the default) puts a single button on the title's baseline, which is
   * what most screens want. `top` lifts it to the top of the row instead —
   * for a tall action like a tab strip, sitting on the baseline drags it below
   * the title and it stops reading as the screen's own navigation.
   */
  actionAlign?: 'end' | 'top';
}) {
  // Title and actions share a row on a desktop and stack on a phone. Side by
  // side in 390px they fought for the same space and both lost: "Housekeeping &
  // maintenance" ran under a "Build task sheet" button whose own label had
  // broken across three lines. Stacking gives each the full width instead of
  // splitting it between them.
  return (
    <div className={`flex flex-col gap-3 mb-5 sm:flex-row sm:justify-between ${
      actionAlign === 'top' ? 'sm:items-start' : 'sm:items-end'
    }`}>
      <div className="min-w-0">
        {eyebrow && <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1">{eyebrow}</p>}
        <div className="flex items-end gap-3">
          <h2 className="text-[18px] sm:text-[22px] font-bold tracking-tight">{title}</h2>
          {count !== undefined && (
            <span className="text-xs font-bold text-dash-muted mb-1">{count}</span>
          )}
        </div>
      </div>
      {/* `min-w-0` so a tab strip inside can scroll rather than stretch the row.
          `justify-end` keeps a short strip against the right edge rather than
          letting it drift back toward the title. */}
      {action && <div className="min-w-0 flex sm:justify-end">{action}</div>}
    </div>
  );
}

// ─── Data Grid ──────────────────────────────────────────────────────────────
export type GridCol<T> = {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => ReactNode;
};

export function DataGrid<T extends { id: string }>({
  rows, cols, onRowClick, emptyTitle = 'Nothing to show',
}: {
  rows: T[];
  cols: GridCol<T>[];
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} hint="Adjust filters or create a new entry." />;
  }
  return (
    <div className="overflow-x-auto scroll-thin -mx-2">
      <table className="w-full text-[12px] border-separate border-spacing-y-1.5 px-2">
        <thead>
          <tr className="text-left">
            {cols.map((c) => (
              <th
                key={c.key}
                className={`text-[10px] font-bold uppercase tracking-widest text-dash-muted px-3 pb-2 ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}`}
                style={{ width: c.width }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row)}
              // A row that opens a reservation is a control, and was reachable
              // only with a mouse: no tab stop, no Enter, nothing announced. The
              // attributes are applied only when the row actually does
              // something, so a read-only table keeps its plain semantics and
              // does not fill a screen reader with phantom buttons.
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? 'button' : undefined}
              onKeyDown={onRowClick
                ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    // Space scrolls the page otherwise, which moves the table
                    // out from under the row being activated.
                    e.preventDefault();
                    onRowClick(row);
                  }
                }
                : undefined}
              className={`bg-white border border-black/5 ${onRowClick ? 'cursor-pointer hover:bg-dash-bg' : ''}`}
            >
              {cols.map((c, i) => (
                <td
                  key={c.key}
                  className={`px-3 py-3 ${i === 0 ? 'rounded-l-xl' : ''} ${i === cols.length - 1 ? 'rounded-r-xl' : ''} ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}`}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────
export function Modal({
  open, onClose, title, children, footer, size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  // Escape closes it. Clicking the backdrop already did, which serves a mouse
  // and leaves a keyboard with nowhere to go but tabbing round to the × — and
  // every other dialog on the machine has taught the operator that Escape
  // works. Declared before the early return because hooks cannot run
  // conditionally; the listener is only attached while the dialog is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };
  // On a phone the 24px side padding was costing a tenth of the usable width on
  // every dialog, which is what pushed two-column forms inside them into one
  // squeezed column. It stays generous from `sm` up, where there is room for it.
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`bg-white rounded-[1.5rem] sm:rounded-[2rem] border border-black/5 shadow-2xl w-full ${widths[size]} dialog-max-h flex flex-col`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b subtle-divider flex items-center justify-between gap-3">
          <h3 className="font-bold tracking-tight min-w-0">{title}</h3>
          {/* 44px of tappable area — a bare `×` glyph is about 14px, which is
              below what a thumb can reliably hit. */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-dash-muted hover:text-black text-2xl leading-none shrink-0 -mr-1 w-11 h-11 sm:w-auto sm:h-auto flex items-center justify-center"
          >
            ×
          </button>
        </div>
        <div className="px-4 sm:px-6 py-4 sm:py-5 overflow-y-auto scroll-thin flex-1">{children}</div>
        {footer && <div className="px-4 sm:px-6 py-4 border-t subtle-divider bg-dash-bg/50 rounded-b-[1.5rem] sm:rounded-b-[2rem]">{footer}</div>}
      </div>
    </div>
  );
}
