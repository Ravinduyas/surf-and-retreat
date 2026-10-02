import { useState, useMemo } from 'react';
import {
  Search, Plus, Receipt, Wallet, Lock, Unlock, ArrowRightLeft, ClipboardCheck, HandCoins,
  History, ArrowLeft,
} from 'lucide-react';
import { useNav } from '../nav';
import {
  useFolios, useFolio, usePostCharge, usePostPayment, useVoidLine, useTransferLine,
  useTransactionCodes, useCashierShift, useOpenShift, useCloseShift, useOutstanding,
  usePaymentMethods, useCashbox, useCashboxHistory, useCashTransactions, useCashCount,
  useCashWithdraw, useCashLedger,
} from '../queries';
import {
  PaymentFields, emptyPayment, paymentBody, paymentTotals, paymentReady, useFxHelper,
  type PaymentDraft,
} from '../payment';
import { Card, Pill, Button, SectionHeader, Tabs, Field, Select, TextInput, Modal, DataGrid, type GridCol } from '../ui';
import { QueryState, useToast, MoneyInput, NumberInput, PermissionButton, statusTone } from '../components';
import { money, clock, timestamp } from '../format';
import type { CashCountResult, FolioSummary, LedgerEntry } from '../types';

export function CashierScreen({ folioId: initialFolioId }: { folioId?: string }) {
  const { navigate } = useNav();
  const toast = useToast();
  const folios = useFolios();
  const codes = useTransactionCodes();
  const shift = useCashierShift();
  const outstanding = useOutstanding();
  const openShift = useOpenShift();
  const closeShift = useCloseShift();
  const postCharge = usePostCharge();
  const postPayment = usePostPayment();
  const voidLine = useVoidLine();
  const transferLine = useTransferLine();

  const [tab, setTab] = useState<'open' | 'outstanding' | 'all'>('open');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | undefined>(initialFolioId);
  const folio = useFolio(selectedId);

  const [chargeOpen, setChargeOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [shiftOpenModal, setShiftOpenModal] = useState(false);
  const [shiftCloseModal, setShiftCloseModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState<{ id: string; description: string } | null>(null);

  const [chargeCode, setChargeCode] = useState('');
  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeQty, setChargeQty] = useState(1);
  const [chargeUnit, setChargeUnit] = useState(0);
  const [pay, setPay] = useState<PaymentDraft>(emptyPayment());
  const [payBalanceMinor, setPayBalanceMinor] = useState(0);
  const payMethodList = usePaymentMethods();
  const payMethodRow = payMethodList.data?.methods.find((m) => m.code === pay.method);
  const fx = useFxHelper();
  const payTotalMinor = paymentTotals(
    pay, payMethodRow,
    payMethodList.data?.cardSurchargeEnabled ?? false,
    payMethodList.data?.cardSurchargeBp ?? 0,
    fx,
  ).totalMinor;
  const payReady = paymentReady(
    pay, payMethodRow,
    payMethodList.data?.cardSurchargeEnabled ?? false,
    payMethodList.data?.cardSurchargeBp ?? 0,
    fx,
  );
  const [floatMinor, setFloatMinor] = useState(0);
  const [countedMinor, setCountedMinor] = useState(0);
  const [shiftNote, setShiftNote] = useState('');
  const [transferTo, setTransferTo] = useState('');

  const folioCols: GridCol<FolioSummary>[] = [
    { key: 'number', header: 'Folio', render: (f) => <span className="font-mono text-[11px] font-bold">{f.number}</span> },
    {
      key: 'guest', header: 'Guest / account',
      render: (f) => (
        <div className="min-w-0">
          <p className="font-bold truncate">{f.guest ?? f.name}</p>
          <p className="text-[10px] text-dash-muted">
            {f.confirmation ?? f.type}{f.room ? ` · room ${f.room}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'status', header: 'Reservation',
      render: (f) => f.reservationStatus
        ? <Pill tone={statusTone(f.reservationStatus)}>{f.reservationStatus}</Pill>
        : <Pill tone="grey">{f.type}</Pill>,
    },
    {
      key: 'balance', header: 'Balance', align: 'right',
      render: (f) => (
        <span className={`tabular-nums font-bold ${f.balanceMinor > 0 ? 'text-status-bad' : f.balanceMinor < 0 ? 'text-status-info' : ''}`}>
          {money(f.balanceMinor)}
        </span>
      ),
    },
    { key: 'folioStatus', header: '', align: 'right', render: (f) => <Pill tone={f.status === 'open' ? 'mint' : 'grey'}>{f.status}</Pill> },
  ];

  const shiftData = shift.data;

  return (
    <div>
      <SectionHeader
        eyebrow="Finance"
        title="Cashier"
        action={
          shiftData?.open ? (
            <div className="flex items-center gap-2">
              <Pill tone="mint" solid>Shift open since {clock(shiftData.openedAt)}</Pill>
              <PermissionButton permission="folio.payment" variant="secondary" icon={<Lock className="w-3.5 h-3.5" />}
                onClick={() => { setCountedMinor(shiftData.expectedCashMinor ?? 0); setShiftCloseModal(true); }}>
                Close shift
              </PermissionButton>
            </div>
          ) : (
            <PermissionButton permission="folio.payment" icon={<Unlock className="w-3.5 h-3.5" />}
              onClick={() => setShiftOpenModal(true)}>
              Open shift
            </PermissionButton>
          )
        }
      />

      {shiftData?.open && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Card tone="mint"><Metric label="Payments this shift" value={money(shiftData.paymentsMinor ?? 0)} /></Card>
          <Card tone="sky"><Metric label="Charges posted" value={money(shiftData.chargesMinor ?? 0)} /></Card>
          <Card><Metric label="Expected cash" value={money(shiftData.expectedCashMinor ?? 0)}
            sub={`float ${money(shiftData.openingFloatMinor ?? 0)}`} /></Card>
          <Card><Metric label="Postings" value={String(shiftData.lines ?? 0)} /></Card>
        </div>
      )}

      {/* Every movement of money, before anything else on the page: this is
          the register, and a cashier opening this screen is nearly always
          looking for something that happened in it. */}
      <MoneyLedger />

      {/*
        The page reads top to bottom, in the order the work happens.

        What is in hand goes first and takes the whole width: the cash box when
        nobody is being served, the folio itself the moment one is opened. Both
        are tables of money, and money in a column three fifths of a screen wide
        wraps, scrolls sideways and gets misread — the drawer had six columns
        squeezed into a panel narrow enough to hide the change.

        The list of folios sits underneath, also full width, because it is how
        the next piece of work is chosen rather than something to be watched
        while doing this one.
      */}
      <div className="min-w-0">
          {!selectedId ? (
            /* The drawer, not an empty box telling somebody to click something.
               A cashier standing at this screen with no guest in front of them
               is doing the other half of the job: counting the money, seeing
               what has come in, and — if they are an administrator — taking it
               out. That is what this space is for. */
            <CashBoxPanel />
          ) : (
            <QueryState query={folio} loadingRows={6}>
              {(f) => (
                <Card>
                  <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          type="button"
                          title="Back to the cash box"
                          onClick={() => setSelectedId(undefined)}
                          className="text-dash-muted hover:text-black"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <p className="text-[16px] font-bold">{f.reservation?.guest ?? f.name}</p>
                        <Pill tone={f.status === 'open' ? 'mint' : 'grey'}>{f.status}</Pill>
                      </div>
                      <p className="text-[11px] text-dash-muted">
                        Folio {f.number} · window {f.windowNo}
                        {f.reservation ? ` · ${f.reservation.confirmation} · room ${f.reservation.room ?? '—'}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">Balance</p>
                      <p className={`text-[22px] font-black tabular-nums ${f.balanceMinor > 0 ? 'text-status-bad' : f.balanceMinor < 0 ? 'text-status-info' : 'text-status-ok'}`}>
                        {money(f.balanceMinor)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    <PermissionButton permission="folio.post" size="sm" icon={<Plus className="w-3 h-3" />}
                      disabled={f.status !== 'open'} onClick={() => setChargeOpen(true)}>
                      Post charge
                    </PermissionButton>
                    <PermissionButton permission="folio.payment" size="sm" variant="secondary"
                      icon={<Receipt className="w-3 h-3" />} disabled={f.status !== 'open'}
                      onClick={() => {
                        setPay(emptyPayment(Math.max(0, f.balanceMinor)));
                        setPayBalanceMinor(Math.max(0, f.balanceMinor));
                        setPaymentOpen(true);
                      }}>
                      Take payment
                    </PermissionButton>
                    {f.reservation && (
                      <Button size="sm" variant="ghost"
                        onClick={() => navigate('guest-dashboard', { reservationId: f.reservation!.id })}>
                        Guest dashboard
                      </Button>
                    )}
                  </div>

                  {f.lines.length === 0 ? (
                    <p className="text-[12px] text-dash-muted py-10 text-center">Nothing posted to this folio yet.</p>
                  ) : (
                    <div className="overflow-x-auto scroll-thin max-h-[440px]">
                      <table className="w-full min-w-[40rem] text-[12px]">
                        <thead className="sticky top-0 bg-white">
                          <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                            <th className="pb-2">Date</th>
                            <th className="pb-2">Code</th>
                            <th className="pb-2">Description</th>
                            <th className="pb-2 text-right">Amount</th>
                            <th className="pb-2 text-right">By</th>
                            <th className="pb-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {f.lines.map((l) => (
                            <tr key={l.id} className={`border-b border-black/[0.03] ${l.voided ? 'opacity-40' : ''}`}>
                              <td className="py-2 text-dash-muted whitespace-nowrap">{l.businessDate}</td>
                              <td className="py-2 font-mono text-[10px]">{l.code}</td>
                              <td className={`py-2 ${l.kind === 'tax' ? 'text-dash-muted pl-4' : 'font-semibold'} ${l.voided ? 'line-through' : ''}`}>
                                {l.description}
                                {l.method ? <span className="text-dash-muted"> · {l.method}</span> : ''}
                              </td>
                              <td className={`py-2 text-right tabular-nums font-bold ${l.amountMinor < 0 ? 'text-status-ok' : ''}`}>
                                {money(l.amountMinor)}
                              </td>
                              <td className="py-2 text-right text-[10px] text-dash-muted">{l.postedBy}</td>
                              <td className="py-2 text-right whitespace-nowrap">
                                {!l.voided && !l.parentLineId && f.status === 'open' && (
                                  <>
                                    <PermissionButton permission="folio.post" size="sm" variant="ghost"
                                      icon={<ArrowRightLeft className="w-3 h-3" />}
                                      onClick={() => { setTransferTarget({ id: l.id, description: l.description }); setTransferTo(''); }} />
                                    <PermissionButton permission="folio.void" size="sm" variant="ghost"
                                      onClick={async () => {
                                        const reason = window.prompt(`Void "${l.description}" — reason?`);
                                        if (!reason) return;
                                        try {
                                          await voidLine.mutateAsync({ lineId: l.id, reason });
                                          toast.success('Posting voided');
                                        } catch (e) { toast.fail(e); }
                                      }}>
                                      Void
                                    </PermissionButton>
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="border-t subtle-divider mt-4 pt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Total label="Charges" value={money(f.chargesMinor)} />
                    <Total label="Taxes" value={money(f.taxesMinor)} />
                    <Total label="Payments" value={money(f.paymentsMinor)} />
                    <Total label="Balance" value={money(f.balanceMinor)} strong />
                  </div>
                </Card>
              )}
            </QueryState>
          )}
      </div>

      {/* `min-w-0` so this can shrink below the width of the table inside it —
          a flex/grid child otherwise refuses to, and the table stretches the
          page instead of scrolling in its own box. */}
      <div className="mt-3 space-y-3 min-w-0">
          <Card padded={false} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Tabs
                tabs={[
                  { value: 'open', label: 'Open' },
                  { value: 'outstanding', label: 'Owing' },
                  { value: 'all', label: 'All' },
                ]}
                active={tab}
                onChange={setTab}
              />
            </div>
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-dash-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Guest, room or folio number…"
                className="w-full bg-white border border-black/10 rounded-full pl-9 pr-4 py-2 text-[12px] outline-none focus:border-black/30"
              />
            </div>

            {tab === 'outstanding' ? (
              <QueryState query={outstanding} loadingRows={4} empty="Every folio is settled">
                {(rows) => (
                  <div className="space-y-1.5 max-h-[520px] overflow-y-auto scroll-thin">
                    {rows
                      .filter((r: any) => !search || (r.guest ?? '').toLowerCase().includes(search.toLowerCase()))
                      .map((r: any) => (
                        <button
                          key={r.folioId}
                          onClick={() => setSelectedId(r.folioId)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl text-left ${
                            selectedId === r.folioId ? 'bg-dash-bg' : 'hover:bg-dash-bg'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-bold truncate">{r.guest ?? r.name}</p>
                            <p className="text-[10px] text-dash-muted">
                              {r.number} · {r.room ? `room ${r.room}` : r.reservationStatus ?? ''}
                            </p>
                          </div>
                          <span className={`text-[12px] font-bold tabular-nums ${r.balanceMinor > 0 ? 'text-status-bad' : 'text-status-info'}`}>
                            {money(r.balanceMinor)}
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </QueryState>
            ) : (
              <QueryState query={folios} loadingRows={4} empty="No folios yet">
                {(rows) => {
                  const q = search.trim().toLowerCase();
                  const filtered = rows
                    .filter((f) => tab === 'all' || f.status === 'open')
                    .filter((f) => !q
                      || (f.guest ?? f.name).toLowerCase().includes(q)
                      || f.number.toLowerCase().includes(q)
                      || (f.room ?? '').toLowerCase().includes(q));
                  return (
                    <div className="max-h-[520px] overflow-y-auto scroll-thin">
                      <DataGrid
                        rows={filtered}
                        cols={folioCols}
                        onRowClick={(f) => setSelectedId(f.id)}
                        emptyTitle="No folios match"
                      />
                    </div>
                  );
                }}
              </QueryState>
            )}
          </Card>
      </div>

      {/* The drawer, last: it is the closing balance of everything above it —
          the payments, the change given back, what the administrator took —
          and a total belongs under the rows it totals. */}
      <div className="mt-3 min-w-0">
        <CashBoxCard />
      </div>

      {/* ── Modals ── */}
      <Modal open={chargeOpen} onClose={() => setChargeOpen(false)} title="Post a charge"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setChargeOpen(false)}>Cancel</Button>
            <Button disabled={!chargeCode || chargeUnit <= 0 || postCharge.isPending || !selectedId}
              onClick={async () => {
                try {
                  await postCharge.mutateAsync({
                    folioId: selectedId!,
                    body: { code: chargeCode, description: chargeDesc || undefined, qty: chargeQty, unitMinor: chargeUnit },
                  });
                  toast.success(`${money(chargeQty * chargeUnit)} posted`);
                  setChargeOpen(false); setChargeCode(''); setChargeDesc(''); setChargeQty(1); setChargeUnit(0);
                } catch (e) { toast.fail(e); }
              }}>
              {postCharge.isPending ? 'Posting…' : `Post ${money(chargeQty * chargeUnit)}`}
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <Field label="Transaction code" required>
            <Select value={chargeCode}
              onChange={(v) => {
                setChargeCode(v);
                const tc = codes.data?.find((c) => c.code === v);
                if (tc) { setChargeDesc(tc.name); if (tc.defaultPriceMinor) setChargeUnit(tc.defaultPriceMinor); }
              }}
              options={[
                { label: 'Select a code', value: '' },
                ...(codes.data ?? []).filter((c) => c.active && c.category !== 'payment')
                  .map((c) => ({ label: `${c.code} · ${c.name}`, value: c.code })),
              ]} />
          </Field>
          <Field label="Description"><TextInput value={chargeDesc} onChange={setChargeDesc} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity"><NumberInput value={chargeQty} onChange={setChargeQty} min={1} max={999} /></Field>
            <Field label="Unit price"><MoneyInput valueMinor={chargeUnit} onChange={setChargeUnit} /></Field>
          </div>
        </div>
      </Modal>

      <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="Take a payment"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button disabled={!payReady || postPayment.isPending || !selectedId}
              onClick={async () => {
                try {
                  const done = await postPayment.mutateAsync({
                    folioId: selectedId!,
                    body: paymentBody(pay, fx),
                  });
                  toast.success(
                    `${money(done?.totalMinor ?? pay.amountMinor)} received`,
                    done?.changeMinor
                      ? `Give ${money(done.changeMinor)} change`
                      : done?.surchargeMinor
                        ? `Includes ${money(done.surchargeMinor)} card fee`
                        : undefined,
                  );
                  setPaymentOpen(false);
                  setPay(emptyPayment());
                } catch (e) { toast.fail(e); }
              }}>
              {postPayment.isPending ? 'Posting…' : `Take ${money(payTotalMinor)}`}
            </Button>
          </div>
        }>
        <PaymentFields draft={pay} onChange={setPay} balanceMinor={payBalanceMinor} />
      </Modal>

      <Modal open={!!transferTarget} onClose={() => setTransferTarget(null)} title="Transfer this posting"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTransferTarget(null)}>Cancel</Button>
            <Button disabled={!transferTo || transferLine.isPending}
              onClick={async () => {
                if (!transferTarget) return;
                try {
                  await transferLine.mutateAsync({ lineId: transferTarget.id, targetFolioId: transferTo });
                  toast.success('Posting transferred');
                  setTransferTarget(null);
                } catch (e) { toast.fail(e); }
              }}>
              Transfer
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <p className="text-[12px] text-dash-muted">
            Move <span className="font-bold text-black">{transferTarget?.description}</span> and its taxes to another
            open folio.
          </p>
          <Field label="Destination folio" required>
            <Select value={transferTo} onChange={setTransferTo}
              options={[
                { label: 'Select a folio', value: '' },
                ...(folios.data ?? []).filter((f) => f.status === 'open' && f.id !== selectedId)
                  .map((f) => ({ label: `${f.number} · ${f.guest ?? f.name}`, value: f.id })),
              ]} />
          </Field>
        </div>
      </Modal>

      <Modal open={shiftOpenModal} onClose={() => setShiftOpenModal(false)} title="Open cashier shift"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShiftOpenModal(false)}>Cancel</Button>
            <Button disabled={openShift.isPending}
              onClick={async () => {
                try {
                  await openShift.mutateAsync({ openingFloatMinor: floatMinor });
                  toast.success('Shift opened');
                  setShiftOpenModal(false);
                } catch (e) { toast.fail(e); }
              }}>
              Open shift
            </Button>
          </div>
        }>
        <Field label="Opening float" hint="Cash in the drawer at the start of your shift">
          <MoneyInput valueMinor={floatMinor} onChange={setFloatMinor} />
        </Field>
      </Modal>

      <Modal open={shiftCloseModal} onClose={() => setShiftCloseModal(false)} title="Close cashier shift"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShiftCloseModal(false)}>Cancel</Button>
            <Button disabled={closeShift.isPending}
              onClick={async () => {
                try {
                  const res = await closeShift.mutateAsync({ countedMinor, note: shiftNote || undefined });
                  toast.success(
                    'Shift closed',
                    res.varianceMinor === 0
                      ? 'Drawer balanced exactly'
                      : `Variance ${money(res.varianceMinor)}`,
                  );
                  setShiftCloseModal(false); setShiftNote('');
                } catch (e) { toast.fail(e); }
              }}>
              Close shift
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <div className="rounded-2xl bg-dash-bg p-4 space-y-1.5">
            <Row label="Opening float" value={money(shiftData?.openingFloatMinor ?? 0)} />
            {(shiftData?.byMethod ?? []).map((m) => (
              <Row key={m.method} label={m.method} value={money(m.totalMinor)} />
            ))}
            <div className="border-t subtle-divider pt-2 mt-2">
              <Row label="Expected cash" value={money(shiftData?.expectedCashMinor ?? 0)} strong />
            </div>
          </div>
          <Field label="Counted cash" required>
            <MoneyInput valueMinor={countedMinor} onChange={setCountedMinor} />
          </Field>
          <div className="rounded-xl bg-dash-bg p-3">
            <Row
              label="Variance"
              value={money(countedMinor - (shiftData?.expectedCashMinor ?? 0))}
              strong
            />
          </div>
          <Field label="Note"><TextInput value={shiftNote} onChange={setShiftNote} placeholder="Explain any variance" /></Field>
        </div>
      </Modal>
    </div>
  );
}

/**
 * The register: every movement of money, newest first.
 *
 * Payments and cash-box events in one table, because they are one story. A
 * guest hands over rupees and gets rupees back; an administrator takes dollars
 * out at midnight; the morning count says what was found. Reading those in
 * three places is how a day fails to add up.
 *
 * Money is shown in the currency it actually moved in — the note the guest
 * held, the notes the administrator carried out — with the property's own
 * figure beside it where they differ, because the folio is kept in one currency
 * and the drawer is filled in several.
 */
function MoneyLedger() {
  const ledger = useCashLedger();

  const label = (e: LedgerEntry) => {
    if (e.kind === 'payment') return e.what;
    if (e.kind === 'withdrawal') return 'Taken out';
    if (e.kind === 'deposit') return 'Put in';
    return e.kind === 'opening_count' ? 'Start-of-day count' : 'Shift count';
  };

  return (
    <Card className="mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Receipt className="w-4 h-4 text-dash-muted" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
          Money in and out
        </p>
      </div>
      <QueryState query={ledger} loadingRows={4}
        isEmpty={(d) => d.entries.length === 0}
        empty="No money has moved yet"
        emptyHint="Payments, counts and withdrawals all appear here as they happen.">
        {(d) => (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-[12px] min-w-[60rem]">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                  <th className="pb-2">When</th>
                  <th className="pb-2">What</th>
                  <th className="pb-2">Guest / room</th>
                  <th className="pb-2 text-right">In</th>
                  <th className="pb-2 text-right">Out</th>
                  <th className="pb-2 text-right">Settled</th>
                  <th className="pb-2">By</th>
                </tr>
              </thead>
              <tbody>
                {d.entries.map((e) => (
                  <tr key={e.id}
                    className={`border-b border-black/[0.03] ${e.voided ? 'opacity-40 line-through' : ''}`}>
                    <td className="py-2 whitespace-nowrap">
                      <span className="font-semibold tabular-nums">{clock(e.at)}</span>
                      <span className="block text-[10px] text-dash-muted tabular-nums">
                        {e.businessDate}
                      </span>
                    </td>
                    <td className="py-2">
                      <Pill tone={e.kind === 'payment' ? 'mint'
                        : e.kind === 'withdrawal' ? 'yellow' : 'grey'}>
                        {label(e)}
                      </Pill>
                      {e.settles && (
                        <span className="block text-[10px] text-dash-muted mt-0.5">
                          {e.settles === 'full' ? 'Full payment' : 'Partial payment'}
                        </span>
                      )}
                      {e.note && (
                        <span className="block text-[10px] text-dash-muted mt-0.5">{e.note}</span>
                      )}
                    </td>
                    <td className="py-2">
                      {e.guest ? (
                        <>
                          <span className="font-semibold">{e.guest}</span>
                          <span className="block text-[10px] text-dash-muted">
                            {[e.room ? `room ${e.room}` : null, e.roomType, e.folio]
                              .filter(Boolean).join(' · ')}
                          </span>
                        </>
                      ) : (
                        <span className="text-dash-muted">—</span>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {e.inMinor
                        ? <span className="font-bold">
                          +{money(e.inMinor, { currency: e.inCurrency ?? e.currency })}
                        </span>
                        : <span className="text-dash-muted">—</span>}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {e.outMinor
                        ? <span className="font-bold text-status-warn">
                          −{money(e.outMinor, { currency: e.outCurrency ?? e.currency })}
                        </span>
                        : <span className="text-dash-muted">—</span>}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {e.kind === 'payment' && e.settledMinor != null ? (
                        <>
                          <span className="font-bold">{money(e.settledMinor, { currency: e.currency })}</span>
                          {!!e.outstandingMinor && (
                            <span className="block text-[10px] text-status-warn">
                              {money(e.outstandingMinor, { currency: e.currency })} left
                            </span>
                          )}
                        </>
                      ) : e.kind === 'opening_count' || e.kind === 'close_count' ? (
                        <>
                          <span>{money(e.settledMinor ?? 0, { currency: e.currency })} counted</span>
                          {!!e.outstandingMinor && (
                            <span className="block text-[10px] text-status-warn">
                              {e.outstandingMinor > 0 ? '+' : ''}
                              {money(e.outstandingMinor, { currency: e.currency })} vs expected
                            </span>
                          )}
                        </>
                      ) : <span className="text-dash-muted">—</span>}
                    </td>
                    <td className="py-2 text-[11px] text-dash-muted">{e.by ?? '—'}</td>
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

/**
 * What came through the counter, and who counted the box.
 *
 * The drawer's own figures are not here: they are the last word on the page,
 * under everything they are the sum of.
 */
function CashBoxPanel() {
  const today = useCashTransactions();
  const history = useCashboxHistory(8);

  return (
    <div className="space-y-3">
            {/* ── What came through the counter today ── */}
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="w-4 h-4 text-dash-muted" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                  Money taken today
                </p>
              </div>
              <QueryState query={today} loadingRows={3}
                isEmpty={(d) => d.transactions.length === 0}
                empty="Nothing taken yet today"
                emptyHint="Payments appear here the moment they are posted.">
                {(t) => (
                  <div className="overflow-x-auto scroll-thin">
                    <table className="w-full text-[12px] min-w-[44rem]">
                      <thead>
                        <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                          <th className="pb-2">Time</th>
                          <th className="pb-2">Guest</th>
                          <th className="pb-2">Type</th>
                          <th className="pb-2 text-right">Settled</th>
                          <th className="pb-2 text-right">Received</th>
                          <th className="pb-2 text-right">Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.transactions.map((x) => (
                          <tr key={x.id} className={`border-b border-black/[0.03] ${x.voided ? 'opacity-40 line-through' : ''}`}>
                            <td className="py-2 tabular-nums text-dash-muted">{clock(x.at)}</td>
                            <td className="py-2">
                              <span className="font-semibold">{x.guest ?? '—'}</span>
                              <span className="block text-[10px] text-dash-muted">{x.folio}</span>
                            </td>
                            <td className="py-2"><Pill tone="grey">{x.method}</Pill></td>
                            <td className="py-2 text-right tabular-nums font-bold">
                              {money(x.settledMinor, { currency: x.currency })}
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              {x.tenderAmountMinor != null && x.tenderCurrency
                                ? (
                                  <>
                                    {money(x.tenderAmountMinor, { currency: x.tenderCurrency })}
                                    {x.tenderCurrency !== x.currency && (
                                      <span className="block text-[10px] text-dash-muted">
                                        = {money(x.tenderedBaseMinor ?? 0, { currency: x.currency })}
                                      </span>
                                    )}
                                  </>
                                )
                                : '—'}
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              {x.changeAmountMinor
                                ? (
                                  <>
                                    {money(x.changeAmountMinor, { currency: x.changeCurrency ?? x.currency })}
                                    {x.changeCurrency && x.changeCurrency !== x.currency && (
                                      <span className="block text-[10px] text-dash-muted">
                                        = {money(x.changeBaseMinor ?? 0, { currency: x.currency })}
                                      </span>
                                    )}
                                  </>
                                )
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </QueryState>
            </Card>

            {/* ── Who counted, who took, and what they disagreed by ── */}
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-dash-muted" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                  Cash box history
                </p>
              </div>
              <QueryState query={history} loadingRows={2}
                isEmpty={(d) => d.events.length === 0}
                empty="Nothing recorded yet"
                emptyHint="Counts and withdrawals are listed here as they happen.">
                {(h) => (
                  <div className="space-y-2">
                    {h.events.map((e) => (
                      <div key={e.groupId} className="rounded-xl bg-dash-bg p-2.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[11px] font-bold">
                            {e.kind === 'opening_count' ? 'Start-of-day count'
                              : e.kind === 'close_count' ? 'Shift count'
                                : e.kind === 'withdrawal' ? 'Money taken out' : 'Money put in'}
                          </span>
                          <span className="text-[10px] text-dash-muted">
                            {e.by} · {new Date(e.at).toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                          {e.lines.map((l) => (
                            <span key={l.currency} className="text-[11px] tabular-nums">
                              {money(l.amountMinor, { currency: l.currency })}
                              {l.varianceMinor != null && l.varianceMinor !== 0 && (
                                <span className="ml-1 font-bold text-status-warn">
                                  ({l.varianceMinor > 0 ? '+' : ''}
                                  {money(l.varianceMinor, { currency: l.currency })} vs expected)
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                        {e.note && <p className="text-[10px] text-dash-muted mt-1">{e.note}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </QueryState>
            </Card>
    </div>
  );
}

/**
 * The cash box itself: what is in it, currency by currency, and the two things
 * a person can do to it.
 *
 * Last on the page on purpose. It is the closing balance of everything above —
 * the payments, the change, the withdrawals — and a total belongs under the
 * rows it totals, not on top of them.
 *
 * Money is shown in the currency it is actually held in. A drawer with dollars
 * and rupees in it does not hold "eight hundred and forty dollars' worth" — it
 * holds notes of two kinds, and somebody has to count each pile. Converting
 * them into one figure here would be the same mistake as converting them on the
 * way in.
 */
function CashBoxCard() {
  const toast = useToast();
  const box = useCashbox();
  const count = useCashCount();
  const withdraw = useCashWithdraw();

  const [countOpen, setCountOpen] = useState(false);
  const [takeOpen, setTakeOpen] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [result, setResult] = useState<CashCountResult | null>(null);

  const data = box.data;
  const currencies = data?.currencies ?? [];
  /**
   * What a count can be entered in: everything the box already holds, plus
   * every currency the desk is allowed to take. A pile of pounds that arrived
   * today has to be countable tomorrow morning even though the box has never
   * held pounds before.
   */
  const accepted = usePaymentMethods().data?.currencies ?? [];
  const countable = [...new Set([...currencies.map((c) => c.currency), ...accepted])];

  const open = (which: 'count' | 'take') => {
    setAmounts(Object.fromEntries(currencies.map((c) => [
      c.currency, which === 'count' ? c.amountMinor : 0,
    ])));
    setNote('');
    setResult(null);
    if (which === 'count') setCountOpen(true); else setTakeOpen(true);
  };

  const items = (onlyPositive = true) => Object.entries(amounts)
    .map(([currency, amountMinor]) => ({ currency, amountMinor: amountMinor || 0 }))
    .filter((i) => (onlyPositive ? i.amountMinor > 0 : true));
  return (
    <div className="space-y-3">
      <QueryState query={box} loadingRows={4}>
        {(b) => (
          <>
            <Card>
              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-dash-muted" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                      Cash box
                    </p>
                    <p className="text-[10.5px] text-dash-muted">
                      {b.since
                        ? `Counted ${new Date(b.since).toLocaleString()}`
                        : 'Never counted — the first count sets the baseline'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <PermissionButton permission="folio.payment" size="sm" variant="secondary"
                    icon={<ClipboardCheck className="w-3 h-3" />} onClick={() => open('count')}>
                    Count the box
                  </PermissionButton>
                  {/* Only an administrator, and only when the server says so —
                      the button is not the control, the route is. */}
                  {b.canWithdraw && (
                    <PermissionButton permission="folio.payment" size="sm"
                      icon={<HandCoins className="w-3 h-3" />} onClick={() => open('take')}>
                      Take money out
                    </PermissionButton>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto scroll-thin">
                <table className="w-full text-[12px] min-w-[34rem]">
                  <thead>
                    <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                      <th className="pb-2">Currency</th>
                      <th className="pb-2 text-right">Counted in</th>
                      <th className="pb-2 text-right">Taken</th>
                      <th className="pb-2 text-right">Change out</th>
                      <th className="pb-2 text-right">Removed</th>
                      <th className="pb-2 text-right">In the box</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.currencies.map((c) => (
                      <tr key={c.currency} className="border-b border-black/[0.03]">
                        <td className="py-2 font-bold">
                          {c.currency}
                          {c.currency === b.base && (
                            <span className="ml-1.5 text-[9.5px] font-semibold text-dash-muted">house</span>
                          )}
                        </td>
                        <td className="py-2 text-right tabular-nums text-dash-muted">
                          {money(c.openingMinor, { currency: c.currency })}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {c.receivedMinor ? `+${money(c.receivedMinor, { currency: c.currency })}` : '—'}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {c.changeMinor ? `−${money(c.changeMinor, { currency: c.currency })}` : '—'}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {c.withdrawnMinor ? `−${money(c.withdrawnMinor, { currency: c.currency })}` : '—'}
                          {c.depositedMinor ? ` +${money(c.depositedMinor, { currency: c.currency })}` : ''}
                        </td>
                        <td className="py-2 text-right tabular-nums font-black text-[13px]">
                          {money(c.amountMinor, { currency: c.currency })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {b.lastWithdrawal && (
                <p className="text-[10.5px] text-dash-muted mt-3">
                  Last taken out by <span className="font-bold">{b.lastWithdrawal.userName}</span> on{' '}
                  {b.lastWithdrawal.businessDate}:{' '}
                  {b.lastWithdrawal.items.map((i) => money(i.amountMinor, { currency: i.currency })).join(' · ')}
                </p>
              )}
              {!b.canWithdraw && (
                <p className="text-[10.5px] text-dash-muted mt-1">
                  Only an administrator can take money out of the box.
                </p>
              )}
            </Card>
          </>
        )}
      </QueryState>

      {/* ── Start-of-day count ── */}
      <Modal open={countOpen} onClose={() => setCountOpen(false)} title="Count the cash box"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setCountOpen(false)}>Cancel</Button>
            <PermissionButton permission="folio.payment" disabled={count.isPending}
              onClick={async () => {
                try {
                  const r = await count.mutateAsync({ counts: items(false), note: note || undefined });
                  setResult(r);
                  const off = r.lines.filter((l) => l.varianceMinor !== 0);
                  if (r.warned) {
                    toast.push({
                      kind: 'warn',
                      title: 'Counted — the administrator has been told',
                      body: 'What is in the box does not match what was left after money was taken out.',
                    });
                  } else if (off.length) {
                    toast.push({ kind: 'warn', title: 'Counted', body: 'The count does not match what was expected.' });
                  } else {
                    toast.success('Cash box counted', 'It matches what was expected.');
                  }
                } catch (e) { toast.fail(e, 'Could not record the count'); }
              }}>
              {count.isPending ? 'Saving…' : 'Save the count'}
            </PermissionButton>
          </div>
        }>
        <div className="space-y-3">
          <p className="text-[12px] text-dash-muted leading-relaxed">
            Count each pile of notes before taking any money today, and type what is actually
            there. Anything left out is recorded as none of that currency in the box.
          </p>
          {countable.map((c) => (
            <Field key={c} label={c}>
              <MoneyInput valueMinor={amounts[c] ?? 0}
                onChange={(v) => setAmounts((a) => ({ ...a, [c]: v }))} />
            </Field>
          ))}
          <Field label="Note" hint="Optional — anything worth saying about this count">
            <TextInput value={note} onChange={setNote} placeholder="e.g. two 50s were damp" />
          </Field>

          {result && (
            <div className="rounded-xl bg-dash-bg p-3 space-y-1">
              <p className="text-[11px] font-bold">What the count found</p>
              {result.lines.map((l) => (
                <div key={l.currency} className="flex justify-between text-[11px] tabular-nums">
                  <span>{l.currency}</span>
                  <span>
                    counted {money(l.countedMinor, { currency: l.currency })} · expected{' '}
                    {money(l.expectedMinor, { currency: l.currency })}
                    {l.varianceMinor !== 0 && (
                      <span className="ml-1 font-bold text-status-warn">
                        ({l.varianceMinor > 0 ? '+' : ''}{money(l.varianceMinor, { currency: l.currency })})
                      </span>
                    )}
                  </span>
                </div>
              ))}
              {result.warned && (
                <p className="text-[10.5px] text-status-warn font-semibold pt-1">
                  The administrator has been warned: this does not match what was left after
                  {result.comparedWith ? ` ${result.comparedWith.by} took money out on ${result.comparedWith.businessDate}` : ' the last withdrawal'}.
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Taking money out — administrators only ── */}
      <Modal open={takeOpen} onClose={() => setTakeOpen(false)} title="Take money out of the cash box"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setTakeOpen(false)}>Cancel</Button>
            <PermissionButton permission="folio.payment" disabled={withdraw.isPending}
              onClick={async () => {
                try {
                  await withdraw.mutateAsync({ items: items(true), note: note || undefined });
                  toast.success('Money taken out', 'The box has been updated and the removal recorded.');
                  setTakeOpen(false);
                } catch (e) { toast.fail(e, 'Could not take that money out'); }
              }}>
              {withdraw.isPending ? 'Recording…' : 'Take it out'}
            </PermissionButton>
          </div>
        }>
        <div className="space-y-3">
          <p className="text-[12px] text-dash-muted leading-relaxed">
            How much is being taken out, from each currency. The box cannot go below what it
            holds, and this is recorded against your name.
          </p>
          {currencies.map((c) => (
            <Field key={c.currency} label={c.currency}
              hint={`In the box: ${money(c.amountMinor, { currency: c.currency })}`}>
              <MoneyInput valueMinor={amounts[c.currency] ?? 0}
                onChange={(v) => setAmounts((a) => ({ ...a, [c.currency]: v }))} />
            </Field>
          ))}
          <Field label="Note" hint="Where the money is going — the bank, the safe, a float">
            <TextInput value={note} onChange={setNote} placeholder="e.g. to the safe" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-2">{label}</p>
      <p className="text-[20px] font-black leading-none tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-dash-muted mt-1.5">{sub}</p>}
    </>
  );
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1">{label}</p>
      <p className={`tabular-nums ${strong ? 'text-[18px] font-black' : 'text-[14px] font-bold'}`}>{value}</p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-dash-muted">{label}</span>
      <span className={`text-[12px] tabular-nums ${strong ? 'font-black' : 'font-bold'}`}>{value}</span>
    </div>
  );
}
