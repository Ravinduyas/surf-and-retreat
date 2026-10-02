// ─────────────────────────────────────────────────────────────
// The cash box.
//
// A folio says what a guest paid. It does not say what is in the drawer, and
// at a property that takes dollars, euro and rupees over the same counter
// those two questions have different answers in different currencies. This is
// the second question: **what is physically in the box, currency by currency,
// and does anybody disagree.**
//
// The arithmetic is deliberately plain, because a cashier has to be able to
// argue with it:
//
//     what should be there  =  what was counted at the start of the day
//                           +  cash notes taken in, in that currency
//                           −  change handed back, in that currency
//                           −  what an administrator removed
//                           +  what an administrator put back
//
// Every term comes from a row somebody wrote: the count from the cashier, the
// notes and change from the payment lines, the removals from the administrator
// who signed for them. Nothing is inferred, so a disagreement always has a
// name and a time attached to it.
//
// Two rules the property asked for, and the reasons they are worth having:
//
//   **Only an administrator takes money out.** A drawer that anybody can empty
//   is a drawer nobody can be accountable for. The route refuses any other
//   role outright rather than hiding the button.
//
//   **A count that contradicts the last withdrawal warns the administrator.**
//   If the box was emptied to a known figure last night and this morning's
//   count says something else, that is precisely the moment worth telling
//   somebody about — and the only moment, because a difference with no
//   administrator action behind it is the ordinary business of a busy till.
// ─────────────────────────────────────────────────────────────
import { all, get, run, scalar, tx } from '../db.ts';
import { HttpError, id, nowIso } from '../lib/util.ts';
import { audit } from './audit.ts';
import { notify } from './notify.ts';
import type { AuthContext } from '../auth.ts';

type Actor = Pick<AuthContext, 'userId' | 'userName' | 'propertyId'>;

export interface CurrencyAmount {
  currency: string;
  amountMinor: number;
}

export interface CashBoxBalance extends CurrencyAmount {
  /** What the start-of-day count said was there. */
  openingMinor: number;
  /** Cash notes taken in since that count, in this currency. */
  receivedMinor: number;
  /** Change handed back since that count, in this currency. */
  changeMinor: number;
  /** Removed by an administrator since that count. */
  withdrawnMinor: number;
  /** Put back by an administrator since that count. */
  depositedMinor: number;
}

const clean = (v: unknown): string => {
  const c = typeof v === 'string' ? v.trim().toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(c)) throw new HttpError(400, `${String(v)} is not a currency code`);
  return c;
};

const whole = (v: unknown, field: string): number => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || Math.round(n) !== n || n < 0 || n > 1_000_000_000) {
    throw new HttpError(400, `${field} must be a whole amount in minor units`);
  }
  return n;
};

const propertyCurrency = (propertyId: string): string =>
  (get<{ currency: string }>('SELECT currency FROM properties WHERE id = ?', propertyId)?.currency
    ?? 'USD').toUpperCase();

const businessDate = (propertyId: string): string =>
  get<{ business_date: string }>('SELECT business_date FROM properties WHERE id = ?', propertyId)
    ?.business_date ?? nowIso().slice(0, 10);

/** The most recent start-of-day count, whenever it happened. */
function lastOpening(propertyId: string): { at: string; groupId: string } | null {
  const row = get<{ at: string; group_id: string }>(
    `SELECT at, group_id FROM cash_box_events
      WHERE property_id = ? AND kind = 'opening_count'
      ORDER BY at DESC LIMIT 1`, propertyId,
  );
  return row ? { at: row.at, groupId: row.group_id } : null;
}

/**
 * What is in the box right now, per currency.
 *
 * Everything is measured from the last start-of-day count, because that is the
 * last time a human looked inside. Before the first count the box is taken to
 * have started empty, which is honest rather than convenient: it says "nobody
 * has ever told me what is in here" and the first count fixes it.
 */
export function balances(propertyId: string): {
  since: string | null;
  base: string;
  currencies: CashBoxBalance[];
} {
  const opening = lastOpening(propertyId);
  const since = opening?.at ?? '0000-01-01T00:00:00.000Z';

  const rows = new Map<string, CashBoxBalance>();
  const row = (currency: string): CashBoxBalance => {
    let r = rows.get(currency);
    if (!r) {
      r = {
        currency,
        amountMinor: 0,
        openingMinor: 0,
        receivedMinor: 0,
        changeMinor: 0,
        withdrawnMinor: 0,
        depositedMinor: 0,
      };
      rows.set(currency, r);
    }
    return r;
  };

  if (opening) {
    for (const e of all<{ currency: string; amount_minor: number }>(
      `SELECT currency, amount_minor FROM cash_box_events WHERE group_id = ?`, opening.groupId,
    )) row(e.currency).openingMinor += e.amount_minor;
  }

  // Cash taken over the counter. A payment records the note in the currency it
  // was handed over in and the change in the currency it went back in — which
  // can be a different one — so each side is counted where it actually landed.
  const base = propertyCurrency(propertyId);
  for (const p of all<{ currency: string; taken: number }>(
    `SELECT COALESCE(tender_currency, ?) AS currency,
            COALESCE(SUM(COALESCE(tender_amount_minor, tendered_minor, -amount_minor)), 0) AS taken
       FROM folio_lines
      WHERE property_id = ? AND kind = 'payment' AND voided = 0
        AND method LIKE '%ash%' AND posted_at > ?
      GROUP BY COALESCE(tender_currency, ?)`,
    base, propertyId, since, base,
  )) row(p.currency).receivedMinor += p.taken;

  for (const c of all<{ currency: string; given: number }>(
    `SELECT COALESCE(change_currency, ?) AS currency,
            COALESCE(SUM(COALESCE(change_amount_minor, change_minor, 0)), 0) AS given
       FROM folio_lines
      WHERE property_id = ? AND kind = 'payment' AND voided = 0
        AND method LIKE '%ash%' AND posted_at > ?
      GROUP BY COALESCE(change_currency, ?)`,
    base, propertyId, since, base,
  )) row(c.currency).changeMinor += c.given;

  for (const m of all<{ kind: string; currency: string; total: number }>(
    `SELECT kind, currency, COALESCE(SUM(amount_minor), 0) AS total
       FROM cash_box_events
      WHERE property_id = ? AND at > ? AND kind IN ('withdrawal', 'deposit')
      GROUP BY kind, currency`, propertyId, since,
  )) {
    const r = row(m.currency);
    if (m.kind === 'withdrawal') r.withdrawnMinor += m.total;
    else r.depositedMinor += m.total;
  }

  // The property's own money is always listed, even at zero: "there is no cash
  // in the box" is an answer, and a missing row is not.
  row(base);

  for (const r of rows.values()) {
    r.amountMinor = r.openingMinor + r.receivedMinor - r.changeMinor
      - r.withdrawnMinor + r.depositedMinor;
  }

  return {
    since: opening?.at ?? null,
    base,
    currencies: [...rows.values()].sort(
      (a, b) => (a.currency === base ? -1 : b.currency === base ? 1 : a.currency.localeCompare(b.currency)),
    ),
  };
}

/** The last time an administrator took money out, if ever. */
export function lastWithdrawal(propertyId: string): {
  groupId: string; at: string; businessDate: string; userName: string;
  items: CurrencyAmount[];
} | null {
  const head = get<{ group_id: string; at: string; business_date: string; user_name: string }>(
    `SELECT group_id, at, business_date, user_name FROM cash_box_events
      WHERE property_id = ? AND kind = 'withdrawal' ORDER BY at DESC LIMIT 1`, propertyId,
  );
  if (!head) return null;
  return {
    groupId: head.group_id,
    at: head.at,
    businessDate: head.business_date,
    userName: head.user_name,
    items: all<{ currency: string; amount_minor: number }>(
      'SELECT currency, amount_minor FROM cash_box_events WHERE group_id = ?', head.group_id,
    ).map((r) => ({ currency: r.currency, amountMinor: r.amount_minor })),
  };
}

function writeEvents(
  propertyId: string, actor: Actor, kind: string, items: {
    currency: string; amountMinor: number; expectedMinor?: number | null;
  }[], note: string | null,
): string {
  const groupId = id('cbg');
  const at = nowIso();
  const date = businessDate(propertyId);
  for (const item of items) {
    run(
      `INSERT INTO cash_box_events(id, property_id, group_id, business_date, at, kind, currency,
                                   amount_minor, expected_minor, variance_minor,
                                   user_id, user_name, note)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id('cbe'), propertyId, groupId, date, at, kind, item.currency, item.amountMinor,
      item.expectedMinor ?? null,
      item.expectedMinor === undefined || item.expectedMinor === null
        ? null : item.amountMinor - item.expectedMinor,
      actor.userId, actor.userName, note,
    );
  }
  return groupId;
}

/** Read a list of `{currency, amountMinor}` off the wire, deduplicated. */
function readItems(input: unknown, field: string): CurrencyAmount[] {
  if (!Array.isArray(input) || !input.length) {
    throw new HttpError(400, `${field} must list at least one currency and amount`);
  }
  const merged = new Map<string, number>();
  for (const raw of input) {
    const currency = clean((raw as any)?.currency);
    const amountMinor = whole((raw as any)?.amountMinor, `${field}.amountMinor`);
    merged.set(currency, (merged.get(currency) ?? 0) + amountMinor);
  }
  return [...merged].map(([currency, amountMinor]) => ({ currency, amountMinor }));
}

/**
 * The start-of-day count.
 *
 * The cashier writes down what is in the box before taking a penny, and the
 * system says what it believed was there. Where those disagree **and an
 * administrator emptied the box on an earlier day**, the administrator is told
 * — that is the case the property asked to be warned about, and the one where
 * two people's figures for the same drawer have genuinely parted company.
 */
export function recordOpeningCount(
  propertyId: string, actor: Actor, input: { counts: unknown; note?: string | null },
) {
  const items = readItems(input.counts, 'counts');
  return tx(() => {
    const before = balances(propertyId);
    const expected = new Map(before.currencies.map((c) => [c.currency, c.amountMinor]));
    const withdrawal = lastWithdrawal(propertyId);
    const today = businessDate(propertyId);

    const rows = items.map((item) => ({
      ...item,
      expectedMinor: expected.get(item.currency) ?? 0,
    }));
    // A currency the box held but the count does not mention is counted as
    // zero rather than quietly carried forward — "it is not in the box" is a
    // statement the cashier is making by leaving it out.
    for (const [currency, amountMinor] of expected) {
      if (!rows.some((r) => r.currency === currency) && amountMinor !== 0) {
        rows.push({ currency, amountMinor: 0, expectedMinor: amountMinor });
      }
    }

    const groupId = writeEvents(propertyId, actor, 'opening_count', rows, input.note ?? null);

    const differences = rows
      .map((r) => ({ ...r, varianceMinor: r.amountMinor - r.expectedMinor }))
      .filter((r) => r.varianceMinor !== 0);

    // Only when an administrator emptied the box on an earlier business date:
    // that is when there is a figure somebody signed for to disagree with.
    const afterAdminNight = !!withdrawal && withdrawal.businessDate < today;
    if (differences.length && afterAdminNight) {
      const detail = differences
        .map((d) => `${d.currency} counted ${(d.amountMinor / 100).toFixed(2)}`
          + ` against ${(d.expectedMinor / 100).toFixed(2)} expected`
          + ` (${d.varianceMinor > 0 ? '+' : ''}${(d.varianceMinor / 100).toFixed(2)})`)
        .join(' · ');
      const message = `${actor.userName} counted the cash box this morning and it does not agree`
        + ` with what was left after ${withdrawal.userName} took money out on`
        + ` ${withdrawal.businessDate}. ${detail}`;
      // To every administrator by name, so it is somebody's job rather than
      // everybody's, and once without a name so it also stands in the feed.
      for (const admin of all<{ id: string }>(
        `SELECT u.id FROM users u
           JOIN user_properties up ON up.user_id = u.id AND up.property_id = ?
          WHERE u.active = 1 AND (u.role = 'admin' OR up.role = 'admin')`, propertyId,
      )) {
        notify(propertyId, {
          source: 'Cashier', severity: 'warn', userId: admin.id,
          title: 'Cash box does not match after last night', message, link: '#/cashier',
        });
      }
      notify(propertyId, {
        source: 'Cashier', severity: 'warn',
        title: 'Cash box does not match after last night', message, link: '#/cashier',
      });
    }

    audit(actor, {
      action: 'cashbox.count', entity: 'CASHBOX', entityId: groupId,
      after: { counts: rows, warned: differences.length > 0 && afterAdminNight },
      elevated: differences.length > 0,
    });

    return {
      groupId,
      countedAt: nowIso(),
      warned: differences.length > 0 && afterAdminNight,
      comparedWith: withdrawal ? { at: withdrawal.at, businessDate: withdrawal.businessDate, by: withdrawal.userName } : null,
      lines: rows.map((r) => ({
        currency: r.currency,
        countedMinor: r.amountMinor,
        expectedMinor: r.expectedMinor,
        varianceMinor: r.amountMinor - r.expectedMinor,
      })),
    };
  });
}

/**
 * An administrator taking money out of the box.
 *
 * Refused if it would take more of a currency than the box holds: a drawer
 * cannot go negative, and a request to remove money that is not there is a
 * miscount worth stopping at the point it is typed rather than discovering in
 * tomorrow's count.
 */
export function withdraw(
  propertyId: string, actor: Actor, input: { items: unknown; note?: string | null },
) {
  const items = readItems(input.items, 'items');
  return tx(() => {
    const before = balances(propertyId);
    const held = new Map(before.currencies.map((c) => [c.currency, c.amountMinor]));
    for (const item of items) {
      if (item.amountMinor <= 0) {
        throw new HttpError(400, `Nothing to take out in ${item.currency}`);
      }
      const have = held.get(item.currency) ?? 0;
      if (item.amountMinor > have) {
        throw new HttpError(400,
          `The box holds ${(have / 100).toFixed(2)} ${item.currency},`
          + ` less than the ${(item.amountMinor / 100).toFixed(2)} being taken out`,
          'insufficient_cash', { currency: item.currency, heldMinor: have });
      }
    }

    const groupId = writeEvents(propertyId, actor, 'withdrawal', items, input.note ?? null);
    const after = balances(propertyId);

    audit(actor, {
      action: 'cashbox.withdraw', entity: 'CASHBOX', entityId: groupId,
      after: { items, note: input.note ?? null },
      // Money leaving a drawer is never routine bookkeeping.
      elevated: true,
    });
    notify(propertyId, {
      source: 'Cashier', severity: 'info',
      title: `${actor.userName} took money out of the cash box`,
      message: items.map((i) => `${(i.amountMinor / 100).toFixed(2)} ${i.currency}`).join(' · ')
        + (input.note ? ` — ${input.note}` : ''),
      link: '#/cashier',
    });

    return { groupId, taken: items, remaining: after.currencies };
  });
}

/** Money put back into the box — the other direction, same accountability. */
export function deposit(
  propertyId: string, actor: Actor, input: { items: unknown; note?: string | null },
) {
  const items = readItems(input.items, 'items');
  return tx(() => {
    for (const item of items) {
      if (item.amountMinor <= 0) throw new HttpError(400, `Nothing to add in ${item.currency}`);
    }
    const groupId = writeEvents(propertyId, actor, 'deposit', items, input.note ?? null);
    audit(actor, {
      action: 'cashbox.deposit', entity: 'CASHBOX', entityId: groupId,
      after: { items, note: input.note ?? null }, elevated: true,
    });
    return { groupId, added: items, remaining: balances(propertyId).currencies };
  });
}

/** What has been done to the box lately, newest first, grouped by event. */
export function history(propertyId: string, limit = 40) {
  const groups = all<{
    group_id: string; kind: string; at: string; business_date: string; user_name: string; note: string | null;
  }>(
    `SELECT group_id, kind, MAX(at) AS at, MAX(business_date) AS business_date,
            MAX(user_name) AS user_name, MAX(note) AS note
       FROM cash_box_events WHERE property_id = ?
      GROUP BY group_id ORDER BY at DESC LIMIT ?`, propertyId, Math.min(200, Math.max(1, limit)),
  );
  return groups.map((g) => ({
    groupId: g.group_id,
    kind: g.kind,
    at: g.at,
    businessDate: g.business_date,
    by: g.user_name,
    note: g.note,
    lines: all<{
      currency: string; amount_minor: number; expected_minor: number | null; variance_minor: number | null;
    }>(
      `SELECT currency, amount_minor, expected_minor, variance_minor
         FROM cash_box_events WHERE group_id = ? ORDER BY currency`, g.group_id,
    ).map((l) => ({
      currency: l.currency,
      amountMinor: l.amount_minor,
      expectedMinor: l.expected_minor,
      varianceMinor: l.variance_minor,
    })),
  }));
}


/**
 * Everything that moved money, newest first, in one list.
 *
 * A cashier reconciling a day does not think in two tables. They think: what
 * came in, what went back out, whose stay it was for, and what the
 * administrator took at the end. So payments and cash-box events are read
 * together and told in the same shape — money **in**, money **out**, each in
 * the currency it actually moved in, against the guest and room it belongs to.
 *
 * Whether a payment was the whole bill or part of it is worked out rather than
 * stored: the folio's running balance at that line. Nothing left owing means
 * it settled the stay; anything left means it was a payment on account. That
 * cannot drift out of step with the folio the way a saved flag would.
 */
export interface LedgerEntry {
  id: string;
  at: string;
  businessDate: string;
  kind: 'payment' | 'withdrawal' | 'deposit' | 'opening_count' | 'close_count';
  /** What it was: the method, or what was done to the box. */
  what: string;
  guest: string | null;
  room: string | null;
  roomType: string | null;
  confirmation: string | null;
  folio: string | null;
  by: string | null;
  note: string | null;
  /** Full or partial, for a payment. Null for everything else. */
  settles: 'full' | 'partial' | null;
  /** Money into the box, in the currency it arrived in. */
  inCurrency: string | null;
  inMinor: number | null;
  /** Money back out — change, or an administrator's withdrawal. */
  outCurrency: string | null;
  outMinor: number | null;
  /** What the folio was credited, always the property's own currency. */
  settledMinor: number | null;
  currency: string;
  /** What is still owed on that folio after this payment. */
  outstandingMinor: number | null;
  rate: number | null;
  voided: boolean;
}

export function ledger(propertyId: string, opts: { date?: string; limit?: number } = {}): LedgerEntry[] {
  const base = propertyCurrency(propertyId);
  const limit = Math.min(500, Math.max(1, opts.limit ?? 60));
  const date = opts.date ?? null;

  const payments = all<any>(
    `SELECT l.id, l.posted_at, l.business_date, l.description, l.method, l.amount_minor,
            l.tendered_minor, l.change_minor, l.tender_currency, l.tender_amount_minor,
            l.tender_rate, l.change_currency, l.change_amount_minor, l.posted_by,
            l.reference, l.voided, l.folio_id, l.rowid AS seq,
            f.number AS folio_number, f.name AS folio_name,
            r.confirmation, r.guest_name, rm.number AS room_number, rt.name AS room_type
       FROM folio_lines l
       JOIN folios f ON f.id = l.folio_id
       LEFT JOIN reservations r ON r.id = l.reservation_id
       LEFT JOIN rooms rm ON rm.id = r.room_id
       LEFT JOIN room_types rt ON rt.id = r.room_type_id
      WHERE l.property_id = ? AND l.kind = 'payment'
        AND (? IS NULL OR l.business_date = ?)
      ORDER BY l.posted_at DESC LIMIT ?`,
    propertyId, date, date, limit,
  );

  /** What the folio still owed the moment that payment landed. */
  const outstandingAfter = (folioId: string, seq: number): number => scalar<number>(
    `SELECT COALESCE(SUM(amount_minor), 0) FROM folio_lines
      WHERE folio_id = ? AND voided = 0 AND rowid <= ?`, folioId, seq,
  );

  const paymentEntries: LedgerEntry[] = payments.map((l) => {
    const outstanding = l.voided === 1 ? null : outstandingAfter(l.folio_id, l.seq);
    const inMinor = l.tender_amount_minor ?? l.tendered_minor ?? -l.amount_minor;
    const outMinor = l.change_amount_minor ?? l.change_minor ?? 0;
    return {
      id: l.id,
      at: l.posted_at,
      businessDate: l.business_date,
      kind: 'payment' as const,
      what: l.method ?? 'Payment',
      guest: l.guest_name ?? l.folio_name ?? null,
      room: l.room_number ?? null,
      roomType: l.room_type ?? null,
      confirmation: l.confirmation ?? null,
      folio: l.folio_number ?? null,
      by: l.posted_by ?? null,
      note: l.reference ?? null,
      settles: outstanding === null ? null : (outstanding <= 0 ? 'full' : 'partial'),
      inCurrency: l.tender_currency ?? base,
      inMinor,
      outCurrency: outMinor ? (l.change_currency ?? base) : null,
      outMinor: outMinor || null,
      settledMinor: -l.amount_minor,
      currency: base,
      outstandingMinor: outstanding === null ? null : Math.max(0, outstanding),
      rate: l.tender_rate ?? null,
      voided: l.voided === 1,
    };
  });

  // The box's own events. A withdrawal is one row per currency; they are read
  // as separate lines because that is how they are counted out of the drawer.
  const events = all<any>(
    `SELECT id, group_id, business_date, at, kind, currency, amount_minor,
            expected_minor, variance_minor, user_name, note
       FROM cash_box_events
      WHERE property_id = ? AND (? IS NULL OR business_date = ?)
      ORDER BY at DESC LIMIT ?`,
    propertyId, date, date, limit,
  );

  const eventEntries: LedgerEntry[] = events.map((e) => ({
    id: e.id,
    at: e.at,
    businessDate: e.business_date,
    kind: e.kind,
    what: e.kind === 'withdrawal' ? 'Taken out of the cash box'
      : e.kind === 'deposit' ? 'Put into the cash box'
        : e.kind === 'opening_count' ? 'Start-of-day count' : 'Shift count',
    guest: null,
    room: null,
    roomType: null,
    confirmation: null,
    folio: null,
    by: e.user_name,
    note: e.note,
    settles: null,
    inCurrency: e.kind === 'deposit' ? e.currency : null,
    inMinor: e.kind === 'deposit' ? e.amount_minor : null,
    outCurrency: e.kind === 'withdrawal' ? e.currency : null,
    outMinor: e.kind === 'withdrawal' ? e.amount_minor : null,
    // A count moves nothing; it states what was found, and by how much that
    // disagreed with the books.
    settledMinor: e.kind === 'opening_count' || e.kind === 'close_count' ? e.amount_minor : null,
    currency: e.currency,
    outstandingMinor: e.variance_minor,
    rate: null,
    voided: false,
  }));

  return [...paymentEntries, ...eventEntries]
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, limit);
}

/**
 * The money that has crossed the counter today, as the cashier page shows it.
 *
 * One row per payment: what kind it was, what was settled, what was handed
 * over and in which currency, and what went back as change and in which
 * currency. All of it comes off the folio line, so the page and the ledger
 * cannot drift apart.
 */
export function transactions(propertyId: string, opts: { date?: string; limit?: number } = {}) {
  const date = opts.date ?? businessDate(propertyId);
  const base = propertyCurrency(propertyId);
  return all<any>(
    `SELECT l.id, l.posted_at, l.business_date, l.description, l.method, l.amount_minor,
            l.tendered_minor, l.change_minor, l.tender_currency, l.tender_amount_minor,
            l.tender_rate, l.change_currency, l.change_amount_minor, l.change_rate,
            l.posted_by, l.reference, l.voided, f.number AS folio_number, f.name AS folio_name,
            r.confirmation, r.guest_name
       FROM folio_lines l
       JOIN folios f ON f.id = l.folio_id
       LEFT JOIN reservations r ON r.id = l.reservation_id
      WHERE l.property_id = ? AND l.kind = 'payment' AND l.business_date = ?
      ORDER BY l.posted_at DESC LIMIT ?`,
    propertyId, date, Math.min(500, Math.max(1, opts.limit ?? 100)),
  ).map((l) => ({
    id: l.id,
    at: l.posted_at,
    businessDate: l.business_date,
    description: l.description,
    method: l.method ?? '—',
    guest: l.guest_name ?? l.folio_name,
    confirmation: l.confirmation ?? null,
    folio: l.folio_number,
    reference: l.reference,
    postedBy: l.posted_by,
    voided: l.voided === 1,
    /** What the folio was credited, always in the property's own currency. */
    settledMinor: -l.amount_minor,
    currency: base,
    /** What crossed the counter, in the money it crossed in. */
    tenderCurrency: l.tender_currency ?? (l.tendered_minor !== null ? base : null),
    tenderAmountMinor: l.tender_amount_minor ?? l.tendered_minor,
    tenderRate: l.tender_rate,
    changeCurrency: l.change_currency ?? (l.change_minor !== null ? base : null),
    changeAmountMinor: l.change_amount_minor ?? l.change_minor,
    changeRate: l.change_rate,
    /** The same two figures converted, so a day can be totalled in one column. */
    tenderedBaseMinor: l.tendered_minor,
    changeBaseMinor: l.change_minor,
  }));
}
