// ─────────────────────────────────────────────────────────────
// Taking money, as one control used by every screen that does it.
//
// Four screens each had their own copy of this — the cashier, check-in,
// check-out and the guest dashboard — with four hardcoded lists of methods that
// had already drifted apart. What a receptionist could record depended on which
// screen they happened to be standing on, which is not a preference, it is a
// bug that reaches the accounts.
//
// Two behaviours make this more than a dropdown:
//
//   **Cash.** The desk types what the guest handed over and the change is
//   worked out here, big enough to read at arm's length. The payment recorded
//   is still what was owed — the drawer keeps that, and the change goes back.
//
//   **Card.** The property may add a percentage. The fee is quoted by the
//   server, not computed here, because a fee worked out twice is a fee that
//   will one day differ in the third decimal place with a guest watching. The
//   panel shows the fee and the real total before anybody presses the button.
//
//   **Foreign money.** A guest settling forty euro with a fifty-dollar note is
//   an ordinary evening. The desk says which currency it was handed, and the
//   panel converts at the live rate, works out the change, and shows it back in
//   that same currency — because change is counted out of a drawer in notes,
//   not in the property's accounting currency. When the drawer has no dollars,
//   the change currency is switched and the figure follows. What is recorded is
//   all of it: the note, the change, both currencies, and the rate each was
//   taken at, so a till counted in one currency can be reconciled against a
//   folio kept in another.
//
// The order the panel asks in is the order the counter works in: how much,
// then how, then in what, then what was handed over.
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { Banknote, CreditCard, Info, RefreshCw, TriangleAlert } from 'lucide-react';
import { usePaymentMethods, useFxRates } from './queries';
import { Field, Select } from './ui';
import { MoneyInput } from './components';
import { money, bpToPercent } from './format';
import type { FxRates, PaymentMethod } from './types';

export interface PaymentDraft {
  /** Method code, e.g. `CASH`. Sent to the API as-is. */
  method: string;
  /** What the guest is settling, before any card fee. Property currency. */
  amountMinor: number;
  /**
   * Whether this settles the lot or part of it.
   *
   * Asked before anything else because it is the question the guest is
   * answering — "all of it?" — and because it decides the amount, which
   * decides the change. `full` keeps the amount pinned to the balance, so a
   * bill that moves while the panel is open cannot leave the desk taking
   * yesterday's number.
   */
  settle: 'full' | 'partial';
  /** Cash only: what they handed over, in `currency`. Null when not counted. */
  tenderedMinor: number | null;
  /**
   * How much of that note the property keeps, in `currency`.
   *
   * A guest hands over two thousand rupees for a bill of eleven dollars and
   * says "take fifteen hundred". What comes back is then five hundred rupees
   * exactly — their own money, subtracted — rather than a figure arrived at by
   * converting into the property's currency and back out again. Null means
   * "keep whatever settles the bill", which is the ordinary case.
   */
  keptMinor: number | null;
  /** What the guest is paying in. The property's own currency by default. */
  currency: string;
  /** Rate override: property units per one unit of `currency`. Null = live. */
  rate: number | null;
  /** What the change is handed back in. Defaults to `currency`. */
  changeCurrency: string;
  /** Rate override for the change currency. */
  changeRate: number | null;
  reference: string;
}

export const emptyPayment = (amountMinor = 0, currency = ''): PaymentDraft => ({
  method: 'CASH',
  amountMinor,
  settle: amountMinor > 0 ? 'full' : 'partial',
  tenderedMinor: null,
  keptMinor: null,
  currency,
  rate: null,
  changeCurrency: currency,
  changeRate: null,
  reference: '',
});

/**
 * What the desk needs to know about the money in front of it.
 *
 * `fx` is how a currency turns into the property's own. Left out — by a screen
 * that only takes the house currency — everything is at a rate of one, which is
 * exactly what it was before any of this existed.
 */
export interface FxHelper {
  /** The property's own currency. */
  base: string;
  /** Property units per one unit of `currency`, or null when none is known. */
  rateFor: (currency: string) => number | null;
  /** Currencies the desk may take, the property's own first. */
  currencies: string[];
  /** When the rates were fetched, and whether they are old enough to say so. */
  fetchedAt: string | null;
  stale: boolean;
  error: string | null;
}

const IDENTITY_FX: FxHelper = {
  base: '',
  rateFor: () => 1,
  currencies: [],
  fetchedAt: null,
  stale: false,
  error: null,
};

/** Live rates and the accepted currency list, as the panel wants them. */
export function useFxHelper(): FxHelper {
  const list = usePaymentMethods();
  const base = list.data?.currency ?? '';
  const currencies = list.data?.currencies ?? (base ? [base] : []);
  // Only worth asking for rates when the property actually takes another money.
  const rates = useFxRates(currencies.length > 1);
  return useMemo(() => fxHelper(base, currencies, rates.data), [base, currencies.join(','), rates.data]);
}

export function fxHelper(base: string, currencies: string[], data?: FxRates): FxHelper {
  const byCurrency = new Map((data?.rates ?? []).map((r) => [r.currency, r]));
  return {
    base,
    currencies,
    fetchedAt: data?.fetchedAt ?? null,
    stale: (data?.rates ?? []).some((r) => r.stale),
    error: data?.error ?? null,
    rateFor: (currency: string) => {
      if (!currency || currency === base) return 1;
      const found = byCurrency.get(currency);
      return found?.rate ?? null;
    },
  };
}

/** Minor units of a foreign currency → minor units of the property's own. */
const toBase = (minor: number, rate: number) => Math.round(minor * rate);
/** And back the other way, for change handed over in notes. */
const fromBase = (minor: number, rate: number) => (rate > 0 ? Math.round(minor / rate) : 0);

/** The arithmetic the panel shows. Mirrors `takePayment` on the server. */
export function paymentTotals(
  draft: PaymentDraft,
  method: PaymentMethod | undefined,
  surchargeEnabled: boolean,
  defaultBp: number,
  fx: FxHelper = IDENTITY_FX,
) {
  const bp = method?.surchargeBp ?? defaultBp;
  const applies = surchargeEnabled && method?.kind === 'card' && bp > 0 && draft.amountMinor > 0;
  const surchargeMinor = applies ? Math.round((draft.amountMinor * bp) / 10_000) : 0;
  /** What the property is owed, in its own currency. */
  const totalMinor = draft.amountMinor + surchargeMinor;

  const tenderRate = draft.rate ?? fx.rateFor(draft.currency);
  const changeRate = draft.changeRate ?? fx.rateFor(draft.changeCurrency || draft.currency);
  const missingRate = tenderRate === null || changeRate === null;

  /** The same bill, in the money the guest is holding. */
  const totalInTenderMinor = tenderRate ? fromBase(totalMinor, tenderRate) : null;

  const counted = method?.kind === 'cash' && draft.tenderedMinor !== null;
  const tenderedBaseMinor = counted && tenderRate !== null
    ? toBase(draft.tenderedMinor as number, tenderRate) : null;

  /**
   * The part of the note being kept, in the guest's own money.
   *
   * Whatever settles the bill unless the desk said otherwise — and when it did,
   * the change is exact subtraction rather than a round trip through the
   * property's currency, which is what turns five hundred rupees into 499.04.
   */
  const keptMinor = counted && tenderRate !== null
    ? Math.min(
      draft.tenderedMinor as number,
      draft.keptMinor ?? fromBase(totalMinor, tenderRate),
    )
    : null;

  const sameCurrencyChange = (draft.changeCurrency || draft.currency) === draft.currency;
  const changeInCurrencyMinor = counted && keptMinor !== null
    ? (sameCurrencyChange
      ? (draft.tenderedMinor as number) - keptMinor
      : (changeRate !== null && tenderedBaseMinor !== null
        ? fromBase(tenderedBaseMinor - totalMinor, changeRate) : null))
    : null;
  const changeMinor = counted && changeInCurrencyMinor !== null && changeRate !== null
    ? (sameCurrencyChange
      ? toBase(changeInCurrencyMinor, changeRate)
      : (tenderedBaseMinor as number) - totalMinor)
    : (tenderedBaseMinor !== null ? tenderedBaseMinor - totalMinor : null);

  return {
    surchargeBp: applies ? bp : 0,
    surchargeMinor,
    totalMinor,
    totalInTenderMinor,
    tenderRate,
    changeRate,
    tenderedBaseMinor,
    changeMinor,
    changeInCurrencyMinor,
    keptMinor,
    missingRate,
  };
}

export function PaymentFields({
  draft,
  onChange,
  balanceMinor,
  dueLabel,
  compact = false,
}: {
  draft: PaymentDraft;
  onChange: (d: PaymentDraft) => void;
  /** What is outstanding. The panel opens on settling all of it. */
  balanceMinor?: number;
  /**
   * What that figure is, when it is not simply what the folio owes.
   *
   * At check-in the room has not been posted yet — the night audit does that —
   * so the folio reads zero while the guest is standing there expecting to pay
   * for their stay. The screen that knows which figure it is passing says so.
   */
  dueLabel?: string;
  compact?: boolean;
}) {
  const list = usePaymentMethods();
  const methods = list.data?.methods ?? [];
  const method = methods.find((m) => m.code === draft.method);
  const fx = useFxHelper();
  const base = fx.base;
  const currencies = fx.currencies;
  const [rateOpen, setRateOpen] = useState(false);

  // The stored default is CASH; if a property has removed it, fall to whatever
  // they do accept rather than leaving the form pointing at nothing.
  useEffect(() => {
    if (!methods.length || method) return;
    onChange({ ...draft, method: methods[0].code });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methods.length, method]);

  // The draft starts before the property's currency has loaded, so it is
  // filled in here rather than guessed at the call site.
  useEffect(() => {
    if (!base || draft.currency) return;
    onChange({ ...draft, currency: base, changeCurrency: base });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, draft.currency]);

  // "All of it" means all of it now, not what the bill said when the panel
  // opened — a charge posted while it is on screen must not be quietly dropped.
  useEffect(() => {
    if (draft.settle !== 'full' || balanceMinor === undefined) return;
    // Cash decides its own amount from the note on the counter.
    if (method?.kind === 'cash' && draft.tenderedMinor !== null) return;
    if (draft.keptMinor !== null) return;
    const due = Math.max(0, balanceMinor);
    if (due !== draft.amountMinor) onChange({ ...draft, amountMinor: due });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.settle, balanceMinor, draft.keptMinor, draft.tenderedMinor, method?.kind]);

  /**
   * When the desk says how much of the note to take, that decides the payment.
   *
   * The guest handed over two thousand rupees and said take fifteen hundred:
   * fifteen hundred rupees is what the property has been paid, whatever that
   * comes to in its own currency, and the folio is credited exactly that. The
   * amount box follows rather than leading, because the figure the guest and
   * the cashier both saw was counted in rupees.
   */
  useEffect(() => {
    const rate = draft.rate ?? fx.rateFor(draft.currency);
    if (method?.kind !== 'cash' || draft.tenderedMinor === null || rate === null) return;
    // What is being taken: the desk's figure, else whatever settles the bill —
    // and never more than the guest actually handed over. A guest paying half
    // their bill in cash is paying half their bill, not being refused.
    const due = balanceMinor === undefined ? null : fromBase(Math.max(0, balanceMinor), rate);
    const kept = Math.min(
      draft.tenderedMinor,
      draft.keptMinor ?? (due ?? draft.tenderedMinor),
    );
    const settled = Math.round(kept * rate);
    if (settled !== draft.amountMinor) {
      onChange({
        ...draft,
        amountMinor: settled,
        // Anything short of the bill is a payment on account, and the panel
        // should say so rather than still calling it a full settlement.
        settle: balanceMinor !== undefined && settled < Math.max(0, balanceMinor)
          ? 'partial' : draft.settle,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.keptMinor, draft.tenderedMinor, draft.currency, draft.rate, method?.kind, balanceMinor, fx]);

  const t = useMemo(
    () => paymentTotals(draft, method, list.data?.cardSurchargeEnabled ?? false,
      list.data?.cardSurchargeBp ?? 0, fx),
    [draft, method, list.data, fx],
  );

  const isCash = method?.kind === 'cash';
  const currency = draft.currency || base;
  const changeCurrency = draft.changeCurrency || currency;
  const foreign = !!base && currency !== base;
  const short = t.changeMinor !== null && t.changeMinor < 0;
  const inCurrency = (minor: number | null, code: string) =>
    (minor === null ? '—' : `${money(minor, { currency: code })}`);

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {/* ── What is owed, and whether this settles it ── */}
      {balanceMinor !== undefined && (
        <div className="rounded-2xl bg-dash-text text-white p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
            {dueLabel ?? (balanceMinor > 0 ? 'To pay' : 'Nothing outstanding')}
          </p>
          <p className="text-[26px] font-black tabular-nums leading-tight">
            {money(Math.max(0, balanceMinor))}
          </p>
          {foreign && t.tenderRate !== null && balanceMinor > 0 && (
            <p className="text-[11px] text-white/60 mt-0.5 tabular-nums">
              ≈ {money(fromBase(Math.max(0, balanceMinor), t.tenderRate), { currency })} in {currency}
            </p>
          )}
        </div>
      )}

      {balanceMinor !== undefined && balanceMinor > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {(['full', 'partial'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onChange({
                ...draft,
                settle: mode,
                amountMinor: mode === 'full' ? Math.max(0, balanceMinor) : draft.amountMinor,
              })}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                draft.settle === mode
                  ? 'border-black bg-dash-text text-white'
                  : 'border-black/10 bg-white hover:border-black/30'}`}
            >
              <span className="block text-[12px] font-bold">
                {mode === 'full' ? 'Full payment' : 'Partial payment'}
              </span>
              <span className={`block text-[10px] ${draft.settle === mode ? 'text-white/60' : 'text-dash-muted'}`}>
                {mode === 'full' ? money(Math.max(0, balanceMinor)) : 'Type an amount'}
              </span>
            </button>
          ))}
        </div>
      )}

      <Field label="Method" required>
        <Select
          value={draft.method}
          onChange={(v) => onChange({ ...draft, method: v, tenderedMinor: null, keptMinor: null })}
          options={methods.map((m) => ({ label: m.label, value: m.code }))}
        />
      </Field>

      {/* Only worth asking when the property takes more than its own money. */}
      {currencies.length > 1 && (
        <Field
          label="Paid in"
          hint={foreign ? `Converted to ${base} at the rate below` : undefined}
        >
          <Select
            value={currency}
            onChange={(v) => onChange({
              ...draft,
              currency: v,
              // A new currency is a new note and a new rate; anything counted
              // against the old one is not what is on the counter now.
              tenderedMinor: null,
              keptMinor: null,
              rate: null,
              changeCurrency: v,
              changeRate: null,
            })}
            options={currencies.map((c) => ({ label: c, value: c }))}
          />
        </Field>
      )}

      {/* ── The rate, said out loud ── */}
      {foreign && (
        <div className="rounded-2xl border border-black/10 bg-white p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                Exchange rate
              </p>
              <p className="text-[13px] font-bold tabular-nums">
                {t.tenderRate === null
                  ? `No rate known for ${currency}`
                  : `1 ${currency} = ${t.tenderRate.toFixed(4)} ${base}`}
              </p>
            </div>
            <button
              type="button"
              className="text-[11px] font-bold underline text-dash-muted hover:text-black shrink-0"
              onClick={() => setRateOpen((v) => !v)}
            >
              {draft.rate !== null ? 'Rate set by hand' : 'Use my own rate'}
            </button>
          </div>

          {(rateOpen || draft.rate !== null) && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Field label={`${base} per 1 ${currency}`}>
                  <input
                    inputMode="decimal"
                    value={draft.rate ?? ''}
                    placeholder={t.tenderRate?.toFixed(4) ?? '0.0000'}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      const next = e.target.value.trim() && Number.isFinite(n) && n > 0 ? n : null;
                      onChange({
                        ...draft,
                        rate: next,
                        // The change is handed back in the same money unless
                        // the desk has said otherwise, so it follows the rate.
                        changeRate: changeCurrency === currency ? next : draft.changeRate,
                      });
                    }}
                    className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] text-right tabular-nums outline-none focus:border-black/40"
                  />
                </Field>
              </div>
              {draft.rate !== null && (
                <button
                  type="button"
                  className="mb-1 inline-flex items-center gap-1 text-[11px] font-bold text-dash-muted hover:text-black"
                  onClick={() => onChange({ ...draft, rate: null, changeRate: null })}
                >
                  <RefreshCw className="w-3 h-3" /> Live rate
                </button>
              )}
            </div>
          )}

          <p className="text-[10px] text-dash-muted leading-relaxed">
            {draft.rate !== null
              ? 'This payment is recorded at the rate typed here.'
              : fx.error
                ? `Live rates could not be refreshed (${fx.error}). The last known rate is being used.`
                : fx.fetchedAt
                  ? `Live rate, fetched ${new Date(fx.fetchedAt).toLocaleString()}.`
                  : 'No rate has been fetched yet.'}
            {' '}The rate used is saved with the payment.
          </p>

          {(fx.stale || t.tenderRate === null) && (
            <p className="flex items-start gap-1.5 text-[10.5px] text-status-warn">
              <TriangleAlert className="w-3.5 h-3.5 mt-px shrink-0" />
              {t.tenderRate === null
                ? 'Type today\'s rate to take this payment.'
                : 'These rates are more than two days old — check them before taking money.'}
            </p>
          )}
        </div>
      )}

      {/* Cash is counted in the money the guest is holding, so its amount is
          asked for inside the cash panel below — "how much did they hand you,
          and how much of it are you taking" — rather than here in a currency
          they never produced. Everything else is charged for an amount, and
          that is what this asks. */}
      {!isCash && (
        <Field
          label={draft.settle === 'full' ? 'Amount being settled' : 'Amount'}
          required
          hint={foreign && t.totalInTenderMinor !== null
            ? `${money(t.totalMinor)} = ${money(t.totalInTenderMinor, { currency })} ${currency}`
            : undefined}
        >
          <MoneyInput
            valueMinor={draft.amountMinor}
            disabled={draft.settle === 'full' && balanceMinor !== undefined}
            onChange={(v) => onChange({ ...draft, amountMinor: v })}
          />
        </Field>
      )}

      {/* ── The card fee ── */}
      {t.surchargeMinor > 0 && (
        <div className="rounded-2xl border border-black/10 bg-white p-3.5">
          <div className="flex items-center gap-1.5 mb-2">
            <CreditCard className="w-3.5 h-3.5 text-dash-muted" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
              Card payment
            </p>
          </div>
          <Line label="Amount" value={money(draft.amountMinor)} />
          <Line
            label={`${list.data?.cardSurchargeLabel ?? 'Card fee'} · ${bpToPercent(t.surchargeBp)}%`}
            value={money(t.surchargeMinor)}
          />
          <div className="flex justify-between items-baseline pt-2 mt-1 border-t subtle-divider">
            <span className="text-[11px] font-bold">Charge the card</span>
            <span className="text-[16px] font-black tabular-nums">{money(t.totalMinor)}</span>
          </div>
          <p className="text-[10px] text-dash-muted mt-2 leading-relaxed">
            The fee is posted to the folio as its own line, so the guest&apos;s bill shows what
            they were charged and why.
          </p>
        </div>
      )}

      {/* ── Cash and change ── */}
      {isCash && (
        <div className="rounded-2xl border border-black/10 bg-white p-3.5 space-y-3">
          <div className="flex items-center gap-1.5">
            <Banknote className="w-3.5 h-3.5 text-dash-muted" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
              Cash {foreign ? `· in ${currency}` : ''}
            </p>
          </div>
          <Field
            label={`Amount received${currency ? ` (${currency})` : ''}`}
            required
            hint={t.totalInTenderMinor !== null && balanceMinor !== undefined && balanceMinor > 0
              ? `What the guest handed over · the bill is ${money(Math.max(0, balanceMinor))}`
                + (foreign ? ` ≈ ${money(fromBase(Math.max(0, balanceMinor), t.tenderRate ?? 1), { currency })}` : '')
              : 'What the guest handed over'}
          >
            <MoneyInput
              valueMinor={draft.tenderedMinor ?? 0}
              onChange={(v) => onChange({
                ...draft,
                tenderedMinor: v > 0 ? v : null,
                // A new note is a new conversation about how much of it to keep.
                keptMinor: null,
              })}
            />
          </Field>

          {/* How much of that note the property is taking. Asked for every
              cash payment now that the box above is the note itself: a guest
              handing over two thousand rupees for an eleven dollar bill is the
              same act as one handing over a twenty for it, and both end with
              somebody counting money back. */}
          {draft.tenderedMinor !== null && t.tenderRate !== null && (
            <Field
              label={`Take from it${currency ? ` (${currency})` : ''}`}
              hint={t.keptMinor !== null
                ? `Taking ${money(t.keptMinor, { currency })}`
                  + (foreign ? ` = ${money(t.totalMinor)}` : '')
                  + '. The rest goes back to the guest.'
                : 'What the guest said to take. The rest goes back to them.'}
            >
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <MoneyInput
                    valueMinor={t.keptMinor ?? 0}
                    onChange={(v) => onChange({ ...draft, keptMinor: Math.max(0, v) })}
                  />
                </div>
                <button
                  type="button"
                  className="mb-1 px-2.5 py-1 rounded-full border border-black/10 text-[11px] font-bold hover:bg-dash-bg shrink-0"
                  onClick={() => onChange({ ...draft, keptMinor: draft.tenderedMinor })}
                >
                  Keep it all
                </button>
                {draft.keptMinor !== null && (
                  <button
                    type="button"
                    className="mb-1 px-2.5 py-1 rounded-full border border-black/10 text-[11px] font-bold hover:bg-dash-bg shrink-0"
                    onClick={() => onChange({ ...draft, keptMinor: null })}
                  >
                    Just the bill
                  </button>
                )}
              </div>
            </Field>
          )}

          {/* Round notes, because that is what people hand over — in the
              currency they are handing over, not the one we keep books in. */}
          <div className="flex flex-wrap gap-1.5">
            {quickNotes(t.totalInTenderMinor ?? t.totalMinor).map((n) => (
              <button
                key={n}
                type="button"
                className="px-2.5 py-1 rounded-full border border-black/10 text-[11px] font-bold hover:bg-dash-bg"
                onClick={() => onChange({ ...draft, tenderedMinor: n })}
              >
                {money(n, { currency, decimals: false })}
              </button>
            ))}
            <button
              type="button"
              className="px-2.5 py-1 rounded-full border border-black/10 text-[11px] font-bold hover:bg-dash-bg"
              onClick={() => onChange({
                ...draft,
                tenderedMinor: t.totalInTenderMinor ?? t.totalMinor,
                // The exact bill, handed over and taken in full: nothing to
                // decide about the rest, because there is no rest.
                keptMinor: null,
              })}
            >
              Exact
            </button>
          </div>

          {draft.tenderedMinor !== null && (
            short ? (
              <div className="rounded-xl bg-status-bad/5 border border-status-bad/30 p-3">
                <p className="text-[12px] font-bold text-status-bad">
                  {inCurrency(fromBase(Math.abs(t.changeMinor ?? 0), t.tenderRate ?? 1), currency)} short
                </p>
                <p className="text-[11px] text-dash-muted mt-0.5">
                  {money(t.totalMinor)} is due and {inCurrency(draft.tenderedMinor, currency)}
                  {foreign && t.tenderedBaseMinor !== null ? ` (${money(t.tenderedBaseMinor)})` : ''} was handed over.
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-dash-mint/40 border border-black/5 p-3 space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-dash-muted">
                    Change to give
                  </span>
                  <span className="text-[22px] font-black tabular-nums">
                    {inCurrency(t.changeInCurrencyMinor, changeCurrency)}
                  </span>
                </div>

                {/* The drawer decides what the change can be handed back in.
                    No dollars in the till is an everyday reason to give it in
                    something else, and the figure has to follow. */}
                {currencies.length > 1 && (t.changeMinor ?? 0) > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-dash-muted">Give the change in</span>
                    <div className="w-[8.5rem]">
                      <Select
                        value={changeCurrency}
                        onChange={(v) => onChange({ ...draft, changeCurrency: v, changeRate: null })}
                        options={currencies.map((c) => ({ label: c, value: c }))}
                      />
                    </div>
                  </div>
                )}

                {(
                  <div className="space-y-0.5 tabular-nums">
                    <p className="text-[10px] text-dash-muted leading-relaxed">
                      Received {inCurrency(draft.tenderedMinor, currency)}
                      {foreign && t.tenderedBaseMinor !== null ? ` = ${money(t.tenderedBaseMinor)}` : ''} ·
                      taken {inCurrency(t.keptMinor, currency)} · back{' '}
                      {inCurrency(t.changeInCurrencyMinor, changeCurrency)}
                    </p>
                    {/* The two figures the desk is asked for out loud: what the
                        guest has actually paid in the property's own money, and
                        what is still owed after it. */}
                    <p className="text-[11px] font-semibold">
                      Paid {money(t.totalMinor)}
                      {balanceMinor !== undefined && (
                        Math.max(0, balanceMinor) - t.totalMinor > 0
                          ? ` · ${money(Math.max(0, balanceMinor) - t.totalMinor)} still to pay`
                          : ' · settles the bill'
                      )}
                    </p>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}

      <Field label="Reference" hint={method?.kind === 'card' ? 'Card auth code' : undefined}>
        <input
          value={draft.reference}
          onChange={(e) => onChange({ ...draft, reference: e.target.value })}
          placeholder="Auth code / transfer reference"
          className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-black/40"
        />
      </Field>

      {list.isError && (
        <p className="flex items-start gap-1.5 text-[11px] text-status-warn">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Could not load the payment methods — check the connection before taking money.
        </p>
      )}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline py-0.5">
      <span className="text-[11px] text-dash-muted">{label}</span>
      <span className="text-[12px] font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/**
 * The notes somebody would actually reach for, above what is owed.
 *
 * Not a fixed set: 20/50/100 is useless against a bill of 340. These are the
 * next round numbers up, which is how change is worked out in the head anyway.
 */
function quickNotes(totalMinor: number): number[] {
  if (totalMinor <= 0) return [];
  const major = totalMinor / 100;
  const steps = [5, 10, 20, 50, 100];
  const out = new Set<number>();
  for (const s of steps) {
    const up = Math.ceil(major / s) * s;
    if (up * 100 > totalMinor) out.add(Math.round(up * 100));
  }
  return [...out].sort((a, b) => a - b).slice(0, 4);
}

/**
 * What to send to `POST /api/folios/:id/payments`.
 *
 * The rate goes with it, not just the currency: the server could look one up,
 * but then the payment would be recorded at whatever the feed says a second
 * after the desk counted the money against the figure on screen. What was shown
 * is what is taken.
 */
export function paymentBody(draft: PaymentDraft, fx?: FxHelper) {
  const rateFor = (currency: string) => fx?.rateFor(currency) ?? null;
  const currency = draft.currency || undefined;
  const changeCurrency = draft.changeCurrency || currency;
  return {
    method: draft.method,
    amountMinor: draft.amountMinor,
    reference: draft.reference || undefined,
    // Only meaningful for cash; the server ignores it otherwise.
    tenderedMinor: draft.tenderedMinor,
    // Only when the desk chose it; otherwise the server settles the bill.
    keptMinor: draft.keptMinor,
    tenderCurrency: currency,
    tenderRate: draft.rate ?? (currency ? rateFor(currency) : null),
    changeCurrency,
    changeRate: draft.changeRate ?? (changeCurrency ? rateFor(changeCurrency) : null),
  };
}

/**
 * Whether the button should be live.
 *
 * A cash payment that is short is the one case worth blocking outright — it is
 * always a typo or a misunderstanding at the counter, and posting it leaves a
 * folio that says paid and a drawer that disagrees.
 */
export function paymentReady(
  draft: PaymentDraft,
  method: PaymentMethod | undefined,
  surchargeEnabled: boolean,
  defaultBp: number,
  fx?: FxHelper,
): boolean {
  if (draft.amountMinor <= 0) return false;
  const t = paymentTotals(draft, method, surchargeEnabled, defaultBp, fx);
  // A payment in a currency with no rate cannot be taken: there is no honest
  // number to record it at, and the desk is told to type one.
  if (t.missingRate) return false;
  // Nor can more be taken out of a note than the guest handed over.
  if (draft.tenderedMinor !== null && t.keptMinor !== null
      && t.keptMinor > draft.tenderedMinor) return false;
  return !(t.changeMinor !== null && t.changeMinor < 0);
}
