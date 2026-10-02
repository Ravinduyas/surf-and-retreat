// ─────────────────────────────────────────────────────────────
// Configuration → Payments.
//
// Two decisions live here and they are not the same kind of decision.
//
// *What the property accepts* is housekeeping — add "Voucher", retire a card
// you no longer take. *What a card costs the guest* is pricing: it changes what
// somebody is charged, it is written into the audit trail as an elevated
// change, and it is off until a property deliberately turns it on. Plenty of
// places may not add one at all, and a surcharge switched on by default is a
// surcharge nobody decided to make.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { Plus, Trash2, Save, CreditCard, Banknote, Coins } from 'lucide-react';
import { usePaymentSettings, useSavePaymentSettings } from '../queries';
import { useAuthStore } from '../stores';
import { Card, Pill, Button, Field, Select, TextInput } from '../ui';
import {
  QueryState, useToast, PermissionButton, Toggle, InfoNote,
} from '../components';
import { money, bpToPercent, percentToBp } from '../format';
import type { PaymentMethod, PaymentMethodKind, PaymentSettings } from '../types';

const KINDS: { label: string; value: PaymentMethodKind }[] = [
  { label: 'Cash — asks what was handed over and works out change', value: 'cash' },
  { label: 'Card — carries the card fee', value: 'card' },
  { label: 'Bank transfer', value: 'transfer' },
  { label: 'Account / ledger', value: 'account' },
  { label: 'Other', value: 'other' },
];

/** A worked example, because a percentage is easier to sanity-check as money. */
const EXAMPLE_MINOR = 10_000;

/**
 * The currencies a front desk is plausibly handed.
 *
 * Deliberately the same list the property currency is chosen from: a guest
 * pays in the money of somewhere, and the somewheres a property sees are the
 * ones it might one day keep its own books in.
 */
const DESK_CURRENCIES = [
  'LKR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'AED', 'INR', 'MVR', 'SGD',
  'MYR', 'THB', 'IDR', 'JPY', 'CNY', 'HKD', 'NZD', 'ZAR', 'SEK', 'NOK', 'DKK',
];

export function PaymentSettingsTab() {
  const query = usePaymentSettings();
  const save = useSavePaymentSettings();
  const toast = useToast();
  const [draft, setDraft] = useState<PaymentSettings | null>(null);
  const propertyCurrency = useAuthStore((st) => st.property?.currency) ?? '';

  useEffect(() => {
    if (query.data && !draft) setDraft(structuredClone(query.data));
  }, [query.data, draft]);

  return (
    <QueryState query={query} loadingRows={5}>
      {() => {
        const d = draft;
        if (!d) return <div />;
        const set = (patch: Partial<PaymentSettings>) => setDraft({ ...d, ...patch });
        const setMethod = (i: number, patch: Partial<PaymentMethod>) => {
          const methods = d.methods.map((m, j) => (i === j ? { ...m, ...patch } : m));
          setDraft({ ...d, methods });
        };
        const exampleFee = Math.round((EXAMPLE_MINOR * d.cardSurchargeBp) / 10_000);

        return (
          <div className="space-y-3">
            {/* ── The card fee ── */}
            <Card>
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="w-4 h-4 text-dash-muted" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                  Card payment fee
                </p>
              </div>
              <p className="text-[11px] text-dash-muted leading-relaxed mb-4 max-w-2xl">
                A percentage added when a guest pays by card. It is posted to the folio as its own
                line, so the bill shows what was charged and why, and it appears in revenue rather
                than quietly reducing what the property took.
              </p>

              <div className="flex flex-wrap gap-6 mb-4">
                <Toggle
                  checked={d.cardSurchargeEnabled}
                  onChange={(v) => set({ cardSurchargeEnabled: v })}
                  label="Add a fee to card payments"
                />
                <Toggle
                  checked={d.cardSurchargeTaxable}
                  onChange={(v) => set({ cardSurchargeTaxable: v })}
                  label="Tax the fee"
                />
                <Toggle
                  checked={d.roundSurchargeToUnit}
                  onChange={(v) => set({ roundSurchargeToUnit: v })}
                  label="Round to whole units"
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                {/* Text, not a number spinner: 3.5% is a real rate and stepping
                    by whole percent cannot express it. Stored as basis points. */}
                <Field label="Percentage" hint="Applies to every card unless one overrides it">
                  <TextInput
                    value={String(bpToPercent(d.cardSurchargeBp))}
                    onChange={(v) => set({ cardSurchargeBp: percentToBp(v) })}
                    placeholder="3"
                  />
                </Field>
                <Field label="What it is called on the bill">
                  <TextInput
                    value={d.cardSurchargeLabel}
                    onChange={(v) => set({ cardSurchargeLabel: v })}
                  />
                </Field>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1.5">
                    On a {money(EXAMPLE_MINOR)} bill
                  </p>
                  <p className="text-[13px] font-bold tabular-nums">
                    {d.cardSurchargeEnabled
                      ? `${money(exampleFee)} fee · card charged ${money(EXAMPLE_MINOR + exampleFee)}`
                      : 'No fee — card charged ' + money(EXAMPLE_MINOR)}
                  </p>
                </div>
              </div>

              {d.cardSurchargeTaxable && (
                <div className="mt-4">
                  <InfoNote>
                    The fee will have the property&apos;s taxes applied on top of it, so the guest
                    pays slightly more than the percentage above. Most places do not tax a card
                    surcharge — leave this off unless your accountant has said otherwise.
                  </InfoNote>
                </div>
              )}
            </Card>

            {/* ── What the desk may be handed ── */}
            <Card>
              <div className="flex items-center gap-2 mb-1">
                <Coins className="w-4 h-4 text-dash-muted" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                  Currencies accepted at the desk
                </p>
              </div>
              <p className="text-[11px] text-dash-muted mb-3 leading-relaxed">
                Money the property will take across the counter besides its own. The cashier
                picks from these when a guest pays, and the payment is converted at the live
                rate and recorded in both currencies. Tick only what you actually accept — a
                short list is a fast one at a busy desk.
              </p>

              <div className="flex flex-wrap gap-1.5">
                {DESK_CURRENCIES.map((code) => {
                  const on = (d.currencies ?? []).includes(code);
                  const own = code === propertyCurrency;
                  return (
                    <button
                      key={code}
                      type="button"
                      disabled={own}
                      onClick={() => setDraft({
                        ...d,
                        currencies: on
                          ? (d.currencies ?? []).filter((c) => c !== code)
                          : [...(d.currencies ?? []), code],
                      })}
                      className={`px-3 py-1.5 rounded-full border text-[11px] font-bold transition-colors ${
                        own
                          ? 'border-black/10 bg-dash-bg text-dash-muted cursor-default'
                          : on
                            ? 'border-black bg-dash-text text-white'
                            : 'border-black/10 bg-white hover:border-black/30'}`}
                      title={own ? 'The property is kept in this currency' : undefined}
                    >
                      {code}{own ? ' · house' : ''}
                    </button>
                  );
                })}
              </div>

              {(d.currencies ?? []).filter((c) => c !== propertyCurrency).length > 0 && (
                <div className="mt-3">
                  <InfoNote>
                  Rates come from a public feed and are cached, so the desk never waits on the
                  network. When a rate cannot be refreshed the last one is used and its age is
                  shown; the cashier can always type the house rate instead. Whichever rate is
                    used is saved with the payment.
                  </InfoNote>
                </div>
              )}
            </Card>

            {/* ── The methods ── */}
            <Card>
              <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-dash-muted" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                    Payment methods
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Plus className="w-3 h-3" />}
                  onClick={() => setDraft({
                    ...d,
                    methods: [...d.methods, {
                      code: `M${d.methods.length + 1}`, label: 'New method',
                      kind: 'other', active: true, surchargeBp: null,
                    }],
                  })}
                >
                  Add a method
                </Button>
              </div>
              <p className="text-[11px] text-dash-muted leading-relaxed mb-4 max-w-2xl">
                One list, used by the cashier, check-in, check-out and the guest screen alike.
                Whether a method asks for change or adds the card fee is decided by its kind, not
                its name.
              </p>

              <div className="space-y-2">
                {d.methods.map((m, i) => (
                  <div
                    key={i}
                    className={`rounded-2xl border p-3 ${m.active ? 'border-black/10 bg-white' : 'border-black/5 bg-dash-bg/40'}`}
                  >
                    <div className="grid md:grid-cols-12 gap-3 items-end">
                      <Field label="Name" className="md:col-span-3">
                        <TextInput value={m.label} onChange={(v) => setMethod(i, { label: v })} />
                      </Field>
                      <Field label="Code" className="md:col-span-2">
                        <TextInput
                          value={m.code}
                          onChange={(v) => setMethod(i, { code: v.toUpperCase() })}
                        />
                      </Field>
                      <Field label="Kind" className="md:col-span-4">
                        <Select
                          value={m.kind}
                          onChange={(v) => setMethod(i, { kind: v as PaymentMethodKind })}
                          options={KINDS}
                        />
                      </Field>
                      <Field
                        label="Own fee %"
                        className="md:col-span-2"
                        hint={m.kind === 'card' ? 'Blank uses the rate above' : 'Cards only'}
                      >
                        <TextInput
                          value={m.surchargeBp === null ? '' : String(bpToPercent(m.surchargeBp))}
                          onChange={(v) => setMethod(i, {
                            surchargeBp: v.trim() === '' ? null : percentToBp(v),
                          })}
                          placeholder={m.kind === 'card' ? String(bpToPercent(d.cardSurchargeBp)) : '—'}
                        />
                      </Field>
                      <div className="md:col-span-1 flex items-center justify-end gap-1 pb-1">
                        <button
                          type="button"
                          title={m.active ? 'In use' : 'Retired'}
                          onClick={() => setMethod(i, { active: !m.active })}
                        >
                          <Pill tone={m.active ? 'mint' : 'grey'}>{m.active ? 'On' : 'Off'}</Pill>
                        </button>
                        <button
                          type="button"
                          title="Remove"
                          className="text-dash-muted hover:text-status-bad"
                          onClick={() => setDraft({
                            ...d, methods: d.methods.filter((_, j) => j !== i),
                          })}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {!d.methods.some((m) => m.active) && (
                <p className="text-[11px] text-status-bad mt-3">
                  Every method is switched off. Saving this would leave the front desk unable to
                  take money, so the defaults will be used instead.
                </p>
              )}
            </Card>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDraft(structuredClone(query.data!))}>
                Discard changes
              </Button>
              <PermissionButton
                permission="config.write"
                icon={<Save className="w-3.5 h-3.5" />}
                disabled={save.isPending}
                onClick={async () => {
                  try {
                    await save.mutateAsync(d as unknown as Record<string, unknown>);
                    toast.success('Payment settings saved');
                  } catch (e) { toast.fail(e, 'Could not save the payment settings'); }
                }}
              >
                {save.isPending ? 'Saving…' : 'Save'}
              </PermissionButton>
            </div>
          </div>
        );
      }}
    </QueryState>
  );
}
