// ─────────────────────────────────────────────────────────────
// How the property takes money: what it accepts, what a card costs, and what
// goes back in the guest's hand.
//
// Three things live here because they have to agree with each other:
//
//   1. **The methods.** One list, held in settings and editable in
//      Configuration. There used to be four hardcoded copies in the front end —
//      the cashier offered "Voucher", check-in offered "OTA prepaid", and the
//      guest dashboard offered neither — so what a receptionist could record
//      depended on which screen they happened to be standing on.
//
//   2. **The card surcharge.** A percentage the property adds when a guest pays
//      by card. It is posted as a **charge on the folio**, not folded into the
//      payment, because it is money the guest owes: fold it in and the folio
//      balances to the wrong number and the fee never appears in revenue.
//      Basis points throughout, like every other percentage in this system.
//
//   3. **Cash and change.** The drawer receives what the guest settles, not
//      what they handed over. Tendering 120 against a bill of 103 puts 103 in
//      the till and 17 back in their hand, so 103 is the payment and the other
//      two figures are recorded beside it for the shift count to be checkable.
//
// The arithmetic is deliberately in one place. A surcharge computed in the
// browser and again on the server is a surcharge that will one day differ, and
// the guest is standing there holding the card.
// ─────────────────────────────────────────────────────────────
import { get, run, all } from '../db.ts';
import { id, HttpError, nowIso } from '../lib/util.ts';
import { postCharge, postPayment } from './folio.ts';
import { cachedRate, fromBaseMinor, toBaseMinor } from './fx.ts';
import { audit } from './audit.ts';
import type { AuthContext } from '../auth.ts';

type Actor = Pick<AuthContext, 'userId' | 'userName' | 'propertyId'>;

export const PAYMENT_SETTING_KEY = 'payments';

/** Transaction code the card fee is posted under. Created on first use. */
export const CARD_FEE_CODE = 'CARDFEE';

/**
 * What a method *is*, which is what decides how the screen behaves.
 *
 * `cash` asks what the guest handed over and works out the change. `card`
 * carries the surcharge. The rest simply record the money.
 */
export type MethodKind = 'cash' | 'card' | 'transfer' | 'account' | 'other';

export interface PaymentMethod {
  /** Stable identifier. Never shown; safe to key settings and reports on. */
  code: string;
  /** What the receptionist reads. */
  label: string;
  kind: MethodKind;
  active: boolean;
  /**
   * Overrides the property-wide card rate for this one method — Amex costing
   * more than Visa is the usual reason. `null` means "use the default", which
   * is what makes changing the property rate actually change every card.
   */
  surchargeBp: number | null;
}

export interface PaymentSettings {
  /** Whether a card surcharge is added at all. */
  cardSurchargeEnabled: boolean;
  /** The default, in basis points. 300 = 3%. */
  cardSurchargeBp: number;
  /** Whether the fee is itself taxed. Off by default — see `takePayment`. */
  cardSurchargeTaxable: boolean;
  /** What the fee is called on the guest's folio. */
  cardSurchargeLabel: string;
  /** Round the fee to whole units of currency (no cents on a card fee). */
  roundSurchargeToUnit: boolean;
  methods: PaymentMethod[];
  /**
   * Currencies this property will take across the counter, besides its own.
   *
   * A shortlist rather than every currency the rate feed knows: a desk picks
   * from the four it actually sees, and a list of a hundred and sixty is a
   * list nobody reads. The property's own currency is always accepted and is
   * never in here.
   */
  currencies: string[];
}

/**
 * What a desk starts with: the two ways money actually arrives at a counter.
 *
 * It used to be the union of four older lists — Visa, Mastercard, Amex, bank
 * transfer, company account, voucher, OTA prepaid — which meant a receptionist
 * settling a bill in cash scrolled past six things they would never pick, and
 * a card payment made somebody decide which brand of card it was for no reason
 * the folio cares about. A card is a card; the brand is on the terminal slip.
 *
 * Anything else a property genuinely uses — a company account, an OTA prepaid
 * line, a voucher — is added in Configuration → Payments, where it can also be
 * given its own card fee. Nothing is lost by their absence here: a folio line
 * already written against "Visa" keeps saying Visa, because `methodFor` reads
 * historic values rather than refusing them.
 */
const DEFAULT_METHODS: PaymentMethod[] = [
  { code: 'CASH', label: 'Cash', kind: 'cash', active: true, surchargeBp: null },
  { code: 'CARD', label: 'Card', kind: 'card', active: true, surchargeBp: null },
];

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  cardSurchargeEnabled: false,
  cardSurchargeBp: 300,
  cardSurchargeTaxable: false,
  cardSurchargeLabel: 'Card payment fee',
  roundSurchargeToUnit: false,
  methods: DEFAULT_METHODS,
  /**
   * The money a front desk is handed without anyone having configured
   * anything.
   *
   * A guest arriving with dollars, euro or pounds is not an edge case a
   * property should have to switch on before the till can count it — and a
   * setting nobody knows exists is a feature nobody has. These are the
   * currencies a property in this part of the world is actually offered, and
   * the shortlist in Configuration → Payments narrows or widens it the moment
   * somebody has an opinion. Whatever is not on the list is refused at the
   * counter rather than taken at a rate nobody chose.
   */
  currencies: ['USD', 'EUR', 'GBP', 'LKR', 'INR', 'AUD'],
};

const KINDS: MethodKind[] = ['cash', 'card', 'transfer', 'account', 'other'];

const bp = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10_000
    ? Math.round(v) : fallback;

/**
 * Read the settings, merged over the defaults.
 *
 * Merged rather than replaced so a half-written setting cannot leave a property
 * with no way to take money — the failure mode of "methods: []" is a front desk
 * that cannot be paid.
 */
export function paymentSettings(propertyId: string): PaymentSettings {
  const row = get<{ value: string }>(
    'SELECT value FROM settings WHERE property_id = ? AND key = ?', propertyId, PAYMENT_SETTING_KEY,
  );
  let saved: Partial<PaymentSettings> | null = null;
  try { saved = row?.value ? JSON.parse(row.value) : null; } catch { saved = null; }
  if (!saved || typeof saved !== 'object') return DEFAULT_PAYMENT_SETTINGS;

  const d = DEFAULT_PAYMENT_SETTINGS;
  const methods = Array.isArray(saved.methods) && saved.methods.length
    ? saved.methods
      .filter((m) => m && typeof m.code === 'string' && m.code.trim())
      .map((m) => ({
        code: String(m.code).trim().toUpperCase().slice(0, 24),
        label: String(m.label ?? m.code).trim().slice(0, 40) || String(m.code),
        kind: KINDS.includes(m.kind as MethodKind) ? (m.kind as MethodKind) : 'other',
        active: m.active !== false,
        surchargeBp: m.surchargeBp === null || m.surchargeBp === undefined
          ? null : bp(m.surchargeBp, 0),
      }))
    : d.methods;

  return {
    cardSurchargeEnabled: saved.cardSurchargeEnabled === true,
    cardSurchargeBp: bp(saved.cardSurchargeBp, d.cardSurchargeBp),
    cardSurchargeTaxable: saved.cardSurchargeTaxable === true,
    cardSurchargeLabel: String(saved.cardSurchargeLabel ?? d.cardSurchargeLabel)
      .trim().slice(0, 60) || d.cardSurchargeLabel,
    roundSurchargeToUnit: saved.roundSurchargeToUnit === true,
    // A list with no live method is the same outage as an empty one.
    methods: methods.some((m) => m.active) ? methods : d.methods,
    currencies: Array.isArray(saved.currencies)
      ? [...new Set(saved.currencies
        .map((c) => String(c ?? '').trim().toUpperCase())
        .filter((c) => /^[A-Z]{3}$/.test(c)))].slice(0, 24)
      : d.currencies,
  };
}

export function savePaymentSettings(propertyId: string, actor: Actor, input: unknown): PaymentSettings {
  const before = paymentSettings(propertyId);
  run(
    `INSERT INTO settings(property_id, key, value, updated_at, updated_by) VALUES(?,?,?,?,?)
     ON CONFLICT(property_id, key) DO UPDATE SET value = excluded.value,
       updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    propertyId, PAYMENT_SETTING_KEY, JSON.stringify(input ?? {}), nowIso(), actor.userName,
  );
  const after = paymentSettings(propertyId);
  audit(actor, {
    action: 'settings.payments', entity: 'SETTINGS', entityRef: PAYMENT_SETTING_KEY,
    before: { surcharge: before.cardSurchargeEnabled, bp: before.cardSurchargeBp },
    after: { surcharge: after.cardSurchargeEnabled, bp: after.cardSurchargeBp },
    // Changing what a card costs a guest is a pricing decision, not a preference.
    elevated: before.cardSurchargeBp !== after.cardSurchargeBp
      || before.cardSurchargeEnabled !== after.cardSurchargeEnabled,
  });
  return after;
}

/** The method a code names, or a permissive stand-in for a historic value. */
export function methodFor(settings: PaymentSettings, code: string): PaymentMethod {
  const wanted = (code ?? '').trim();
  const found = settings.methods.find(
    (m) => m.code.toLowerCase() === wanted.toLowerCase()
      || m.label.toLowerCase() === wanted.toLowerCase(),
  );
  if (found) return found;
  // An unknown method is recorded rather than refused. Old folio lines say
  // "Cash" where the list now says "CASH", and a hard failure here would make
  // historic data unpayable rather than merely untidy.
  return { code: wanted || 'OTHER', label: wanted || 'Other', kind: 'other', active: true, surchargeBp: null };
}

export interface Surcharge {
  bp: number;
  amountMinor: number;
  label: string;
}

/**
 * What the card costs on top, for an amount the guest is settling.
 *
 * Zero for everything that is not a card, and zero when the property has not
 * switched the surcharge on — which is the default, because charging one is a
 * decision a property makes deliberately and in some places may not make at all.
 */
export function surchargeFor(
  settings: PaymentSettings, method: PaymentMethod, amountMinor: number,
): Surcharge {
  const rate = method.surchargeBp ?? settings.cardSurchargeBp;
  const applies = settings.cardSurchargeEnabled && method.kind === 'card' && rate > 0
    && amountMinor > 0;
  if (!applies) return { bp: 0, amountMinor: 0, label: settings.cardSurchargeLabel };

  const raw = (amountMinor * rate) / 10_000;
  const amount = settings.roundSurchargeToUnit
    ? Math.round(raw / 100) * 100
    : Math.round(raw);
  return { bp: rate, amountMinor: amount, label: settings.cardSurchargeLabel };
}

/**
 * A quote for the screen, so the desk sees the total before committing.
 *
 * The same function the write path uses, so what the guest is told and what is
 * posted cannot disagree.
 */
export function quotePayment(propertyId: string, methodCode: string, amountMinor: number) {
  const settings = paymentSettings(propertyId);
  const method = methodFor(settings, methodCode);
  const surcharge = surchargeFor(settings, method, amountMinor);
  return {
    method: method.code,
    methodLabel: method.label,
    kind: method.kind,
    settleMinor: amountMinor,
    surchargeBp: surcharge.bp,
    surchargeMinor: surcharge.amountMinor,
    surchargeLabel: surcharge.label,
    totalMinor: amountMinor + surcharge.amountMinor,
    /** Whether the screen should ask what the guest handed over. */
    takesCash: method.kind === 'cash',
  };
}

/** The fee needs a transaction code to post against; make one if it is missing. */
function ensureCardFeeCode(propertyId: string, label: string) {
  const existing = get<{ id: string }>(
    'SELECT id FROM transaction_codes WHERE property_id = ? AND code = ?', propertyId, CARD_FEE_CODE,
  );
  if (existing) return;
  run(
    `INSERT INTO transaction_codes(id, property_id, code, name, category,
                                   default_price_minor, taxable, active, sort_order)
     VALUES(?,?,?,?,'misc',0,0,1,900)`,
    id('txc'), propertyId, CARD_FEE_CODE, label,
  );
}

export interface TakePaymentInput {
  folioId: string;
  /** Method code or label. */
  method: string;
  /** What the guest is settling, before any card fee. In property currency. */
  amountMinor: number;
  businessDate: string;
  reference?: string | null;
  description?: string | null;
  /**
   * Cash only: what the guest actually handed over, in `tenderCurrency`.
   *
   * Not in the property's currency, unless that is what they paid in. Fifty
   * dollars is fifty dollars; what it is worth is worked out here, from the
   * rate, and it is the rate that is recorded beside it.
   */
  tenderedMinor?: number | null;
  /** What the guest paid in. Defaults to the property's own currency. */
  tenderCurrency?: string | null;
  /**
   * Property-currency units per one unit of `tenderCurrency`.
   *
   * Passed in by the desk — the same figure it was shown when it counted the
   * money — so the payment is recorded at the rate the guest was quoted, not
   * at whatever the feed says a second later. Falls back to the cached rate
   * when the caller does not send one.
   */
  tenderRate?: number | null;
  /**
   * How much of the note the property is keeping, in `tenderCurrency`.
   *
   * A guest hands over two thousand rupees and says "take fifteen hundred".
   * Without this the change could only ever be "everything above the bill",
   * and the two figures the guest cares about — what they handed over and what
   * comes back — were arrived at by converting into the property's currency
   * and back again, which is how five hundred rupees becomes four hundred and
   * ninety-nine. Given here, the change is exact subtraction in the money the
   * guest is holding.
   *
   * Defaults to whatever settles the bill.
   */
  keptMinor?: number | null;
  /** What the change was handed back in. Defaults to `tenderCurrency`. */
  changeCurrency?: string | null;
  /** Property-currency units per one unit of `changeCurrency`. */
  changeRate?: number | null;
}

/**
 * Take a payment, with the card fee and the change worked out here.
 *
 * Order matters: the fee is posted **before** the payment, so a folio watched
 * mid-transaction never shows money received against a balance that has not yet
 * grown by the fee. Both are inside one transaction, so a failure leaves
 * neither.
 */
export function takePayment(propertyId: string, actor: Actor, input: TakePaymentInput) {
  const settings = paymentSettings(propertyId);
  const method = methodFor(settings, input.method);

  if (input.amountMinor <= 0) throw new HttpError(400, 'Payment amount must be positive');

  const surcharge = surchargeFor(settings, method, input.amountMinor);
  const total = input.amountMinor + surcharge.amountMinor;

  // ── What the guest paid in ──────────────────────────────────
  //
  // The folio is kept in the property's currency and stays that way. A foreign
  // note is converted once, here, at a rate that is then recorded on the line:
  // the desk is shown a rate, counts the money against it, and the accounts can
  // later be told exactly which rate a drawer was filled at.
  const propertyCurrency = (get<{ currency: string }>(
    'SELECT currency FROM properties WHERE id = ?', propertyId,
  )?.currency ?? 'USD').toUpperCase();

  const asCode = (v: unknown): string | null => {
    const c = typeof v === 'string' ? v.trim().toUpperCase() : '';
    return /^[A-Z]{3}$/.test(c) ? c : null;
  };
  // The property's own money is always taken, whatever the shortlist says.
  const accepted = [propertyCurrency, ...settings.currencies.filter((c) => c !== propertyCurrency)];
  const assertAccepted = (currency: string) => {
    if (accepted.includes(currency)) return;
    throw new HttpError(400,
      `${currency} is not one of the currencies this property accepts`,
      'currency_not_accepted', { accepted });
  };
  const tenderCurrency = asCode(input.tenderCurrency) ?? propertyCurrency;
  assertAccepted(tenderCurrency);
  const changeCurrency = asCode(input.changeCurrency) ?? tenderCurrency;
  assertAccepted(changeCurrency);

  /**
   * The rate to use for one currency: the desk's figure if it sent one, else
   * the cached feed rate. A currency with neither is refused rather than
   * guessed — a payment converted at a rate nobody chose is worse than a
   * payment that did not go through.
   */
  const rateFor = (currency: string, given: number | null | undefined): number => {
    if (currency === propertyCurrency) return 1;
    if (typeof given === 'number' && Number.isFinite(given) && given > 0) return given;
    const cached = cachedRate(propertyCurrency, currency);
    if (cached) return cached.rate;
    throw new HttpError(400,
      `No exchange rate is known for ${currency} — enter today's rate to take this payment`,
      'no_rate', { currency, base: propertyCurrency });
  };

  const tenderRate = rateFor(tenderCurrency, input.tenderRate);
  const changeRate = rateFor(changeCurrency, input.changeRate);

  // Cash is the one method where the guest hands over a different number from
  // the one being settled, and the difference goes back across the counter.
  let changeMinor = 0;
  let changeAmountMinor: number | null = null;
  const tenderedForeign = input.tenderedMinor ?? null;
  // What that note is worth to the property, which is what the drawer gains.
  const tendered = tenderedForeign === null
    ? null : toBaseMinor(tenderedForeign, tenderRate);
  if (method.kind === 'cash' && tendered !== null && tenderedForeign !== null) {
    if (tendered < total) {
      const shortfall = tenderCurrency === propertyCurrency
        ? `Cash received (${(tendered / 100).toFixed(2)})`
        : `Cash received (${(tenderedForeign / 100).toFixed(2)} ${tenderCurrency}`
          + ` = ${(tendered / 100).toFixed(2)} ${propertyCurrency})`;
      throw new HttpError(400,
        `${shortfall} is less than the ${(total / 100).toFixed(2)} due`, 'short_tender',
        { totalMinor: total, tenderedMinor: tendered });
    }

    // What the property is keeping out of that note. Said in the guest's own
    // money when the desk said it; otherwise it is simply the bill.
    const keptForeign = typeof input.keptMinor === 'number' && Number.isFinite(input.keptMinor)
      ? Math.round(input.keptMinor)
      : fromBaseMinor(total, tenderRate);
    if (keptForeign < 0 || keptForeign > tenderedForeign) {
      throw new HttpError(400,
        `Keeping ${(keptForeign / 100).toFixed(2)} ${tenderCurrency} out of`
        + ` ${(tenderedForeign / 100).toFixed(2)} ${tenderCurrency} is not possible`,
        'bad_kept', { tenderedMinor: tenderedForeign, keptMinor: keptForeign });
    }
    // What is kept has to be what the folio is credited, or the drawer and the
    // bill tell two different stories. A rate rounds, so a unit of difference
    // is allowed and anything more is a client that has drifted.
    if (Math.abs(toBaseMinor(keptForeign, tenderRate) - total) > 1) {
      throw new HttpError(400,
        `Keeping ${(keptForeign / 100).toFixed(2)} ${tenderCurrency} does not match the`
        + ` ${(total / 100).toFixed(2)} ${propertyCurrency} being settled`,
        'kept_mismatch', {
          totalMinor: total, keptMinor: keptForeign,
          keptInBaseMinor: toBaseMinor(keptForeign, tenderRate),
        });
    }

    if (changeCurrency === tenderCurrency) {
      // The everyday case, and the exact one: the guest gets back the part of
      // their own note that was not kept. No conversion, so no rounding.
      changeAmountMinor = tenderedForeign - keptForeign;
      changeMinor = toBaseMinor(changeAmountMinor, changeRate);
    } else {
      // Handed back in another currency because the drawer has no notes of
      // theirs. Then it has to go through the property's currency.
      changeMinor = tendered - total;
      changeAmountMinor = fromBaseMinor(changeMinor, changeRate);
    }
  }

  let surchargeLineId: string | null = null;
  if (surcharge.amountMinor > 0) {
    ensureCardFeeCode(propertyId, surcharge.label);
    const posted = postCharge(propertyId, actor, {
      folioId: input.folioId,
      code: CARD_FEE_CODE,
      description: `${surcharge.label} (${(surcharge.bp / 100).toFixed(2)}%)`,
      unitMinor: surcharge.amountMinor,
      businessDate: input.businessDate,
      // A fee on a fee is a compounding surprise, and in most places a card
      // surcharge is not itself a taxable supply. Configurable, off by default.
      applyTax: settings.cardSurchargeTaxable,
      reference: input.reference ?? undefined,
    });
    surchargeLineId = posted.lineId;
  }

  const { lineId } = postPayment(propertyId, actor, {
    folioId: input.folioId,
    method: method.label,
    amountMinor: total,
    businessDate: input.businessDate,
    reference: input.reference ?? undefined,
    description: input.description ?? undefined,
    tenderedMinor: method.kind === 'cash' ? tendered : null,
    changeMinor: method.kind === 'cash' ? changeMinor : null,
    // Written down whatever the currency, so a row says for itself which money
    // was counted rather than leaving a reader to assume it was the house's.
    // The rate is 1 when it was, which is the honest way to record that.
    baseCurrency: propertyCurrency,
    tenderCurrency: method.kind === 'cash' && tenderedForeign !== null ? tenderCurrency : null,
    tenderAmountMinor: method.kind === 'cash' ? tenderedForeign : null,
    tenderRate: method.kind === 'cash' && tenderedForeign !== null ? tenderRate : null,
    changeCurrency: method.kind === 'cash' && tenderedForeign !== null ? changeCurrency : null,
    changeAmountMinor: method.kind === 'cash' ? changeAmountMinor : null,
    changeRate: method.kind === 'cash' && tenderedForeign !== null ? changeRate : null,
  });

  return {
    lineId,
    surchargeLineId,
    method: method.code,
    methodLabel: method.label,
    settleMinor: input.amountMinor,
    surchargeBp: surcharge.bp,
    surchargeMinor: surcharge.amountMinor,
    totalMinor: total,
    tenderedMinor: tendered,
    changeMinor,
    /** The property's own currency — everything above is in it. */
    currency: propertyCurrency,
    /** What the guest actually handed over, and what went back to them. */
    tenderCurrency,
    tenderAmountMinor: tenderedForeign,
    /** The part of the note that was kept, in the guest's own money. */
    keptMinor: tenderedForeign === null || changeAmountMinor === null
      ? null : tenderedForeign - (changeCurrency === tenderCurrency ? changeAmountMinor : 0),
    tenderRate,
    changeCurrency,
    changeAmountMinor,
    changeRate,
  };
}

/** Payments taken today, by method — what a shift count is checked against. */
export function paymentsByMethod(propertyId: string, businessDate: string) {
  return all<{ method: string; total: number; count: number }>(
    `SELECT COALESCE(method,'—') AS method, COALESCE(SUM(-amount_minor),0) AS total,
            count(*) AS count
       FROM folio_lines
      WHERE property_id = ? AND business_date = ? AND kind = 'payment' AND voided = 0
      GROUP BY method ORDER BY total DESC`,
    propertyId, businessDate,
  );
}
