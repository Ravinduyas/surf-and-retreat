// First-run wizard. A fresh install has no property, no rooms and no users,
// so this is the only way in — and everything it creates is the operator's own
// real data, not a sample estate.
import { useState } from 'react';
import { Building2, UserCog, ArrowRight, ArrowLeft, Check, AlertTriangle } from 'lucide-react';
import { api, ApiError } from '../api';
import { useAuthStore } from '../stores';
import { today } from '../format';
import { WizardSteps } from '../ui';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'LKR', 'INR', 'AUD', 'CAD', 'SGD', 'AED', 'JPY', 'THB', 'MYR', 'ZAR', 'NZD'];
const TIMEZONES = [
  'UTC', 'Asia/Colombo', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Bangkok',
  'Asia/Tokyo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Australia/Sydney',
];

export function SetupScreen() {
  const adopt = useAuthStore((s) => s.adoptSession);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [property, setProperty] = useState({
    code: '',
    name: '',
    legalName: '',
    kind: 'hotel',
    city: '',
    country: '',
    currency: 'USD',
    timezone: 'UTC',
    businessDate: today(),
    checkInTime: '14:00',
    checkOutTime: '11:00',
    phone: '',
    email: '',
    taxId: '',
  });

  const [admin, setAdmin] = useState({ name: '', email: '', password: '', confirm: '' });

  const propertyValid = property.code.trim().length >= 2 && property.name.trim().length >= 2;
  const adminValid =
    admin.name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email) &&
    admin.password.length >= 8 &&
    /[a-zA-Z]/.test(admin.password) && /[0-9]/.test(admin.password) &&
    admin.password === admin.confirm;

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{
        token: string; user: any; property: any;
      }>('/api/setup/bootstrap', {
        property: {
          ...property,
          legalName: property.legalName || undefined,
          city: property.city || undefined,
          country: property.country || undefined,
          phone: property.phone || undefined,
          email: property.email || undefined,
          taxId: property.taxId || undefined,
        },
        admin: { name: admin.name.trim(), email: admin.email.trim(), password: admin.password },
      });
      adopt({ token: res.token, user: res.user, property: res.property, properties: [res.property] });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Setup failed');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-dash-bg flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
            <div className="w-4 h-4 border-[2.5px] border-dash-yellow rounded-full border-t-transparent" />
          </div>
          <div>
            <p className="text-[14px] font-black tracking-tight leading-none">
              helio<span className="text-status-warn">.</span>pms
            </p>
            <p className="text-[10px] text-dash-muted mt-0.5">First-time setup</p>
          </div>
        </div>

        <div className="panel p-8">
          <div className="mb-7">
            <WizardSteps steps={['Property', 'Administrator', 'Confirm']} current={step} />
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-100 bg-red-50/70 px-4 py-3 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-status-bad mt-0.5 shrink-0" />
              <p className="text-[12px] font-semibold text-status-bad">{error}</p>
            </div>
          )}

          {step === 0 && (
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <Building2 className="w-4 h-4 text-dash-muted" />
                <h2 className="text-[18px] font-bold tracking-tight">Tell us about the property</h2>
              </div>
              <p className="text-[12px] text-dash-muted mb-6">
                This becomes the operating entity: its currency, its timezone and the business date
                the night audit will roll.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Property code" required hint="Short code used on confirmation numbers, e.g. GRAND">
                  <input
                    value={property.code}
                    onChange={(e) => setProperty({ ...property, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                    placeholder="GRAND"
                    className={inputCls}
                  />
                </Field>
                <Field label="Property name" required>
                  <input
                    value={property.name}
                    onChange={(e) => setProperty({ ...property, name: e.target.value })}
                    placeholder="The Grand Hotel"
                    className={inputCls}
                  />
                </Field>
                <Field label="Legal / billing name">
                  <input
                    value={property.legalName}
                    onChange={(e) => setProperty({ ...property, legalName: e.target.value })}
                    placeholder="Grand Hospitality (Pvt) Ltd"
                    className={inputCls}
                  />
                </Field>
                <Field label="Property type">
                  <select
                    value={property.kind}
                    onChange={(e) => setProperty({ ...property, kind: e.target.value })}
                    className={inputCls}
                  >
                    <option value="hotel">Hotel</option>
                    <option value="hostel">Hostel</option>
                    <option value="mixed">Mixed — rooms and dorm beds</option>
                  </select>
                </Field>
                <Field label="City">
                  <input value={property.city} onChange={(e) => setProperty({ ...property, city: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Country">
                  <input value={property.country} onChange={(e) => setProperty({ ...property, country: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Currency" required hint="All money is held and reported in this currency">
                  <select
                    value={property.currency}
                    onChange={(e) => setProperty({ ...property, currency: e.target.value })}
                    className={inputCls}
                  >
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Timezone">
                  <select
                    value={property.timezone}
                    onChange={(e) => setProperty({ ...property, timezone: e.target.value })}
                    className={inputCls}
                  >
                    {TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}
                  </select>
                </Field>
                <Field label="Opening business date" required hint="The first day the system will operate; the night audit moves it forward">
                  <input
                    type="date"
                    value={property.businessDate}
                    onChange={(e) => setProperty({ ...property, businessDate: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Check-in time">
                    <input type="time" value={property.checkInTime} onChange={(e) => setProperty({ ...property, checkInTime: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Check-out time">
                    <input type="time" value={property.checkOutTime} onChange={(e) => setProperty({ ...property, checkOutTime: e.target.value })} className={inputCls} />
                  </Field>
                </div>
                <Field label="Phone">
                  <input value={property.phone} onChange={(e) => setProperty({ ...property, phone: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Reservations email">
                  <input value={property.email} onChange={(e) => setProperty({ ...property, email: e.target.value })} className={inputCls} />
                </Field>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <UserCog className="w-4 h-4 text-dash-muted" />
                <h2 className="text-[18px] font-bold tracking-tight">Create the administrator account</h2>
              </div>
              <p className="text-[12px] text-dash-muted mb-6">
                This account can do everything, including creating the rest of your team in
                Administration → Users.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Full name" required>
                  <input value={admin.name} onChange={(e) => setAdmin({ ...admin, name: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Email" required hint="Used to sign in">
                  <input type="email" value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Password" required hint="At least 8 characters, with letters and numbers">
                  <input type="password" value={admin.password} onChange={(e) => setAdmin({ ...admin, password: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Confirm password" required>
                  <input type="password" value={admin.confirm} onChange={(e) => setAdmin({ ...admin, confirm: e.target.value })} className={inputCls} />
                </Field>
              </div>
              {admin.confirm && admin.password !== admin.confirm && (
                <p className="text-[11px] text-status-bad font-semibold mt-3">Passwords do not match.</p>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-[18px] font-bold tracking-tight mb-1">Ready to create</h2>
              <p className="text-[12px] text-dash-muted mb-6">
                We'll create the property, your administrator account and the standard chart of
                transaction codes. Nothing else is pre-filled — you'll add room types, rooms, rate
                plans and taxes next, in Configuration.
              </p>

              <div className="grid md:grid-cols-2 gap-3">
                <Summary title="Property" rows={[
                  ['Name', property.name],
                  ['Code', property.code],
                  ['Type', property.kind],
                  ['Location', [property.city, property.country].filter(Boolean).join(', ') || '—'],
                  ['Currency', property.currency],
                  ['Timezone', property.timezone],
                  ['Business date', property.businessDate],
                  ['Check-in / out', `${property.checkInTime} / ${property.checkOutTime}`],
                ]} />
                <Summary title="Administrator" rows={[
                  ['Name', admin.name],
                  ['Email', admin.email],
                  ['Role', 'System Administrator'],
                ]} />
              </div>

              <div className="mt-5 rounded-2xl bg-dash-sky/40 border border-black/5 p-4">
                <p className="text-[11px] font-bold mb-1.5">What happens next</p>
                <ol className="text-[11px] text-dash-muted space-y-1 list-decimal list-inside leading-relaxed">
                  <li>Configuration → Room types: define what you sell (rooms and/or dorm beds)</li>
                  <li>Configuration → Rooms: add your floor plan (there's a bulk builder)</li>
                  <li>Configuration → Taxes: add VAT, service charge and city tax</li>
                  <li>Rates &amp; Inventory: create a rate plan and load prices</li>
                  <li>Channel Manager: connect it when you're ready to distribute</li>
                </ol>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-8 pt-5 border-t subtle-divider">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || busy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-bold text-dash-muted hover:text-black disabled:opacity-30"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>

            {step < 2 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={(step === 0 && !propertyValid) || (step === 1 && !adminValid)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-black text-white text-[12px] font-bold hover:bg-black/85 disabled:opacity-40"
              >
                Continue <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={finish}
                disabled={busy || !propertyValid || !adminValid}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-black text-white text-[12px] font-bold hover:bg-black/85 disabled:opacity-40"
              >
                {busy ? 'Creating…' : <><Check className="w-3.5 h-3.5" /> Create property</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] focus:border-black/40 transition-colors outline-none';

function Field({
  label, required, hint, children,
}: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1.5">
        {label} {required && <span className="text-status-bad">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[10px] text-dash-muted mt-1">{hint}</span>}
    </label>
  );
}

function Summary({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-2xl border border-black/5 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">{title}</p>
      <div className="space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] text-dash-muted">{k}</span>
            <span className="text-[11px] font-bold text-right">{v || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
