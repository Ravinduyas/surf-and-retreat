import { useState } from 'react';
import { Wallet, Plus, Receipt, Building2, Printer } from 'lucide-react';
import {
  useArAccounts, useArAccount, useArPayment, useCompanies, useCreateCompany,
  useUpdateCompany, useInvoices, useInvoiceDocument,
} from '../queries';
import { useAuthStore } from '../stores';
import { Card, Pill, Button, SectionHeader, Tabs, Field, Select, TextInput, Modal } from '../ui';
import {
  QueryState, useToast, MoneyInput, NumberInput, DateInput, PermissionButton, Toggle, statusTone,
} from '../components';
import { money, longDate, bpToPercent, percentToBp } from '../format';
import { InvoicePaper, printInvoice } from '../invoice';

export function AccountsReceivableScreen({ companyId }: { companyId?: string }) {
  const toast = useToast();
  const property = useAuthStore((s) => s.property);
  const accounts = useArAccounts();
  const companies = useCompanies();
  const invoices = useInvoices();
  const arPayment = useArPayment();
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();

  const [tab, setTab] = useState<'ledger' | 'invoices' | 'companies'>('ledger');
  /** The invoice open in the print preview, if any. */
  const [viewing, setViewing] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(companyId ?? '');
  const account = useArAccount(selectedId || undefined);

  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payRef, setPayRef] = useState('');
  const [companyOpen, setCompanyOpen] = useState(false);
  const [c, setC] = useState({
    code: '', name: '', type: 'company', contactName: '', email: '', phone: '',
    arEnabled: true, creditLimit: 0, commission: 0, terms: 30,
  });

  return (
    <div>
      <SectionHeader
        eyebrow="Finance"
        title="Accounts receivable"
        action={
          <div className="flex items-center gap-2">
            <Tabs
              tabs={[
                { value: 'ledger', label: 'City ledger', count: accounts.data?.length },
                { value: 'invoices', label: 'Invoices', count: invoices.data?.length },
                { value: 'companies', label: 'Companies', count: companies.data?.length },
              ]}
              active={tab}
              onChange={setTab}
            />
            {tab === 'companies' && (
              <PermissionButton permission="config.write" icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setCompanyOpen(true)}>
                New company
              </PermissionButton>
            )}
          </div>
        }
      />

      {tab === 'ledger' && (
        <div className="grid lg:grid-cols-3 gap-3">
          <div>
            <QueryState query={accounts} loadingRows={4}
              empty="No direct-billing accounts"
              emptyHint="Enable direct billing on a company to start using the city ledger.">
              {(rows) => {
                const total = rows.reduce((s, a) => s + a.balanceMinor, 0);
                return (
                  <>
                    <Card tone={total > 0 ? 'peach' : 'mint'} className="mb-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-2">
                        Total receivable
                      </p>
                      <p className="text-[26px] font-black tabular-nums">{money(total)}</p>
                      <p className="text-[11px] text-dash-muted mt-1">
                        across {rows.length} account{rows.length === 1 ? '' : 's'}
                      </p>
                    </Card>
                    <div className="space-y-2">
                      {rows.map((a) => (
                        <button key={a.companyId} onClick={() => setSelectedId(a.companyId)}
                          className={`w-full text-left p-4 rounded-2xl border transition-colors ${
                            selectedId === a.companyId ? 'border-black bg-dash-bg' : 'border-black/5 hover:bg-dash-bg'
                          }`}>
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <p className="text-[13px] font-bold truncate">{a.name}</p>
                            <span className={`text-[13px] font-black tabular-nums ${a.balanceMinor > 0 ? 'text-status-bad' : ''}`}>
                              {money(a.balanceMinor)}
                            </span>
                          </div>
                          <p className="text-[10px] text-dash-muted">
                            {a.code} · {a.type.replace('_', ' ')} · terms {a.paymentTermsDays}d
                          </p>
                          {a.overLimit && (
                            <Pill tone="red" className="mt-2">Over credit limit ({money(a.creditLimitMinor)})</Pill>
                          )}
                          {a.oldestChargeDate && (
                            <p className="text-[10px] text-dash-muted mt-1">
                              Oldest charge {longDate(a.oldestChargeDate)}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                );
              }}
            </QueryState>
          </div>

          <div className="lg:col-span-2">
            {!selectedId ? (
              <Card className="h-full flex flex-col items-center justify-center py-20">
                <Wallet className="w-8 h-8 text-dash-muted mb-3" />
                <p className="text-[13px] font-bold mb-1">Select an account</p>
                <p className="text-[12px] text-dash-muted">See its statement and record payments.</p>
              </Card>
            ) : (
              <QueryState query={account} loadingRows={5}>
                {(a: any) => (
                  <Card>
                    <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                      <div>
                        <h3 className="text-[18px] font-bold tracking-tight">{a.company.name}</h3>
                        <p className="text-[11px] text-dash-muted">{a.company.code}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">Balance</p>
                          <p className={`text-[22px] font-black tabular-nums ${a.balanceMinor > 0 ? 'text-status-bad' : 'text-status-ok'}`}>
                            {money(a.balanceMinor)}
                          </p>
                        </div>
                        <PermissionButton permission="ar.write" icon={<Receipt className="w-3.5 h-3.5" />}
                          onClick={() => { setPayAmount(Math.max(0, a.balanceMinor)); setPayOpen(true); }}>
                          Record payment
                        </PermissionButton>
                      </div>
                    </div>

                    {a.transactions.length === 0 ? (
                      <p className="text-[12px] text-dash-muted py-8 text-center">No activity on this account.</p>
                    ) : (
                      <div className="overflow-x-auto scroll-thin">
                        <table className="w-full min-w-[40rem] text-[12px]">
                          <thead>
                            <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                              <th className="pb-2">Date</th>
                              <th className="pb-2">Type</th>
                              <th className="pb-2">Invoice</th>
                              <th className="pb-2">Reference</th>
                              <th className="pb-2">By</th>
                              <th className="pb-2 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {a.transactions.map((t: any) => (
                              <tr key={t.id} className="border-b border-black/[0.03]">
                                <td className="py-2 whitespace-nowrap">{longDate(t.date)}</td>
                                <td className="py-2">
                                  <Pill tone={t.kind === 'payment' ? 'mint' : 'grey'}>{t.kind}</Pill>
                                </td>
                                <td className="py-2 font-mono text-[10px]">{t.invoice ?? '—'}</td>
                                <td className="py-2 text-dash-muted">{t.reference ?? t.note ?? '—'}</td>
                                <td className="py-2 text-dash-muted">{t.createdBy}</td>
                                <td className={`py-2 text-right tabular-nums font-bold ${t.kind === 'payment' ? 'text-status-ok' : ''}`}>
                                  {t.kind === 'payment' ? '−' : ''}{money(t.amountMinor)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                )}
              </QueryState>
            )}
          </div>
        </div>
      )}

      {tab === 'invoices' && (
        <QueryState query={invoices} loadingRows={4} empty="No invoices issued yet">
          {(rows) => (
            <Card>
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full min-w-[56rem] text-[12px]">
                  <thead>
                    <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                      <th className="pb-2">Number</th>
                      <th className="pb-2">Issued</th>
                      <th className="pb-2">Bill to</th>
                      <th className="pb-2">Company</th>
                      <th className="pb-2 text-right">Net</th>
                      <th className="pb-2 text-right">Tax</th>
                      <th className="pb-2 text-right">Total</th>
                      <th className="pb-2 text-right">Paid</th>
                      <th className="pb-2 text-right">Status</th>
                      <th className="pb-2 text-right">Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((i) => (
                      <tr key={i.id} className="border-b border-black/[0.03]">
                        <td className="py-2 font-mono text-[11px] font-bold">{i.number}</td>
                        <td className="py-2 whitespace-nowrap">{longDate(i.issuedAt.slice(0, 10))}</td>
                        <td className="py-2 font-semibold">{i.billTo}</td>
                        <td className="py-2 text-dash-muted">{i.company ?? '—'}</td>
                        <td className="py-2 text-right tabular-nums">{money(i.netMinor)}</td>
                        <td className="py-2 text-right tabular-nums text-dash-muted">{money(i.taxMinor)}</td>
                        <td className="py-2 text-right tabular-nums font-bold">{money(i.totalMinor)}</td>
                        <td className="py-2 text-right tabular-nums">{money(i.paidMinor)}</td>
                        <td className="py-2 text-right"><Pill tone={statusTone(i.status)}>{i.status}</Pill></td>
                        <td className="py-2 text-right">
                          <Button variant="secondary" onClick={() => setViewing(i.id)}>
                            <Receipt className="w-3.5 h-3.5" /> View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </QueryState>
      )}

      <InvoiceModal invoiceId={viewing} onClose={() => setViewing(null)} />

      {tab === 'companies' && (
        <QueryState query={companies} loadingRows={4}
          empty="No companies or travel agents"
          emptyHint="Add the corporates, agents and tour operators you deal with.">
          {(rows) => (
            <Card>
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full min-w-[52rem] text-[12px]">
                  <thead>
                    <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                      <th className="pb-2">Code</th>
                      <th className="pb-2">Name</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2">Contact</th>
                      <th className="pb-2 text-right">Commission</th>
                      <th className="pb-2 text-right">Credit limit</th>
                      <th className="pb-2 text-right">Balance</th>
                      <th className="pb-2 text-center">Direct billing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((co) => (
                      <tr key={co.id} className="border-b border-black/[0.03]">
                        <td className="py-2.5 font-mono text-[11px]">{co.code}</td>
                        <td className="py-2.5 font-semibold">{co.name}</td>
                        <td className="py-2.5 text-dash-muted">{co.type.replace('_', ' ')}</td>
                        <td className="py-2.5 text-dash-muted">
                          {[co.contactName, co.email].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="py-2.5 text-right">{bpToPercent(co.commissionBp)}%</td>
                        <td className="py-2.5 text-right tabular-nums">{money(co.creditLimitMinor)}</td>
                        <td className={`py-2.5 text-right tabular-nums font-bold ${co.balanceMinor > 0 ? 'text-status-bad' : ''}`}>
                          {money(co.balanceMinor)}
                        </td>
                        <td className="py-2.5 text-center">
                          <div className="flex justify-center">
                            <Toggle checked={co.arEnabled}
                              onChange={(v) => updateCompany.mutate({ id: co.id, body: { arEnabled: v } })} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </QueryState>
      )}

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record a payment on account"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button disabled={payAmount <= 0 || arPayment.isPending}
              onClick={async () => {
                try {
                  await arPayment.mutateAsync({
                    companyId: selectedId,
                    body: { amountMinor: payAmount, reference: payRef || undefined },
                  });
                  toast.success(`${money(payAmount)} recorded`);
                  setPayOpen(false); setPayRef('');
                } catch (e) { toast.fail(e); }
              }}>
              Record payment
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <Field label="Amount" required><MoneyInput valueMinor={payAmount} onChange={setPayAmount} /></Field>
          <Field label="Reference" hint="Bank transfer reference, cheque number…">
            <TextInput value={payRef} onChange={setPayRef} />
          </Field>
        </div>
      </Modal>

      <Modal open={companyOpen} onClose={() => setCompanyOpen(false)} title="New company or agent" size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCompanyOpen(false)}>Cancel</Button>
            <Button disabled={!c.code.trim() || !c.name.trim() || createCompany.isPending}
              onClick={async () => {
                try {
                  await createCompany.mutateAsync({
                    code: c.code.trim().toUpperCase(), name: c.name.trim(), type: c.type,
                    contactName: c.contactName || undefined, email: c.email || undefined,
                    phone: c.phone || undefined, arEnabled: c.arEnabled,
                    creditLimitMinor: c.creditLimit, commissionBp: percentToBp(c.commission),
                    paymentTermsDays: c.terms,
                  });
                  toast.success('Company created');
                  setCompanyOpen(false);
                  setC({ code: '', name: '', type: 'company', contactName: '', email: '', phone: '', arEnabled: true, creditLimit: 0, commission: 0, terms: 30 });
                } catch (e) { toast.fail(e); }
              }}>
              Create company
            </Button>
          </div>
        }>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Code" required><TextInput value={c.code} onChange={(v) => setC({ ...c, code: v.toUpperCase() })} /></Field>
          <Field label="Name" required><TextInput value={c.name} onChange={(v) => setC({ ...c, name: v })} /></Field>
          <Field label="Type">
            <Select value={c.type} onChange={(v) => setC({ ...c, type: v })} options={[
              { label: 'Company', value: 'company' },
              { label: 'Travel agent', value: 'travel_agent' },
              { label: 'Tour operator', value: 'tour_operator' },
              { label: 'OTA', value: 'ota' },
            ]} />
          </Field>
          <Field label="Contact name"><TextInput value={c.contactName} onChange={(v) => setC({ ...c, contactName: v })} /></Field>
          <Field label="Email"><TextInput value={c.email} onChange={(v) => setC({ ...c, email: v })} /></Field>
          <Field label="Phone"><TextInput value={c.phone} onChange={(v) => setC({ ...c, phone: v })} /></Field>
          <Field label="Commission %">
            <input type="number" value={c.commission} onChange={(e) => setC({ ...c, commission: Number(e.target.value) })}
              className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-black/40" />
          </Field>
          <Field label="Credit limit">
            <MoneyInput valueMinor={c.creditLimit} onChange={(v) => setC({ ...c, creditLimit: v })} />
          </Field>
          <Field label="Payment terms (days)">
            <NumberInput value={c.terms} onChange={(v) => setC({ ...c, terms: v })} min={0} max={365} />
          </Field>
        </div>
        <div className="mt-4">
          <Toggle checked={c.arEnabled} onChange={(v) => setC({ ...c, arEnabled: v })}
            label="Allow direct billing (city ledger)" />
        </div>
      </Modal>
    </div>
  );
}

/**
 * The invoice, ready to hand over.
 *
 * `print-hide` on the toolbar rather than a conditional render: the print
 * stylesheet drops it, so what the operator previews in the dialog is the paper
 * alone, with no "Print" button printed onto it.
 */
export function InvoiceModal({ invoiceId, onClose }: { invoiceId: string | null; onClose: () => void }) {
  const doc = useInvoiceDocument(invoiceId);
  return (
    <Modal
      open={!!invoiceId}
      onClose={onClose}
      title="Invoice"
      size="xl"
      footer={
        <div className="flex items-center gap-2 print-hide">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button onClick={printInvoice} disabled={!doc.data}>
            <Printer className="w-3.5 h-3.5" /> Print / Save as PDF
          </Button>
        </div>
      }
    >
      <QueryState query={doc} loadingRows={6}>
        {(d) => (
          <>
            <p className="text-[11px] text-dash-muted mb-3 print-hide">
              Choose <span className="font-semibold">Save as PDF</span> as the destination in the print
              dialog to send the guest a copy.
            </p>
            <InvoicePaper doc={d} />
          </>
        )}
      </QueryState>
    </Modal>
  );
}
