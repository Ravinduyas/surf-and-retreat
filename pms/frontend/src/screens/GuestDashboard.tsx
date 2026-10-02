import { useState } from 'react';
import {
  ArrowLeft, Plus, MessageSquare, StickyNote, Receipt, Ban, LogOut, LogIn,
  SplitSquareHorizontal, UserPlus, ArrowRightLeft, CalendarClock,
} from 'lucide-react';
import { StayDatesModal } from './StayDates';
import { ChannelReportPanel } from './ChannelReport';
import { useNav } from '../nav';
import {
  useReservation, useFolio, usePostCharge, usePostPayment, useVoidLine, useAddNote,
  useTransactionCodes, useSplitFolio, useCancelReservation, useAddGuest, useMessages, useSendMessage,
  usePaymentMethods, useUpdateReservation, useHostelworldSettings,
} from '../queries';
import { HostelworldBadge, HostelworldMoney, HostelworldStatement, hostelworldSplit } from '../hostelworld';
import {
  PaymentFields, emptyPayment, paymentBody, paymentTotals, paymentReady, useFxHelper,
  type PaymentDraft,
} from '../payment';
import { Card, Pill, Button, SectionHeader, Tabs, Field, Select, TextInput, Modal } from '../ui';
import { BookingExtras } from '../bookingextras';
import {
  QueryState, useToast, MoneyInput, NumberInput, ConfirmDialog, PermissionButton, statusTone,
} from '../components';
import { money, longDate, timestamp, relativeTime } from '../format';


export function GuestDashboardScreen({ reservationId }: { reservationId?: string }) {
  const { navigate, back } = useNav();
  const toast = useToast();
  const reservation = useReservation(reservationId);
  const codes = useTransactionCodes();
  const postCharge = usePostCharge();
  const postPayment = usePostPayment();
  const voidLine = useVoidLine();
  const addNote = useAddNote();
  const splitFolio = useSplitFolio();
  const cancelReservation = useCancelReservation();
  const addGuest = useAddGuest();
  const sendMessage = useSendMessage();
  // The Hostelworld collected amount can be corrected here when Beds24 sent
  // nothing or the wrong figure; the folio credit follows it on the server.
  const updateReservation = useUpdateReservation();
  const hwSettings = useHostelworldSettings();
  const [hwOpen, setHwOpen] = useState(false);
  const [hwCollected, setHwCollected] = useState(0);

  const [tab, setTab] = useState<'folio' | 'stay' | 'guests' | 'notes' | 'messages'>('folio');
  const [activeFolioId, setActiveFolioId] = useState<string | null>(null);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [stayOpen, setStayOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<{ id: string; description: string } | null>(null);

  const folioId = activeFolioId ?? reservation.data?.folios?.[0]?.id;
  const folio = useFolio(folioId);
  const messages = useMessages(reservationId);

  // Charge form
  const [chargeCode, setChargeCode] = useState('');
  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeQty, setChargeQty] = useState(1);
  const [chargeUnit, setChargeUnit] = useState(0);
  // Payment form — method, amount, cash tendered and reference all travel
  // together, because the card fee and the change depend on all four.
  const [pay, setPay] = useState<PaymentDraft>(emptyPayment());
  /** What was outstanding when the dialog opened, for the "settle it all" link. */
  const [balanceMinor, setBalanceMinor] = useState(0);
  const payMethods = usePaymentMethods();
  const payMethod = payMethods.data?.methods.find((m) => m.code === pay.method);
  const fx = useFxHelper();
  const payTotals = paymentTotals(
    pay, payMethod,
    payMethods.data?.cardSurchargeEnabled ?? false,
    payMethods.data?.cardSurchargeBp ?? 0,
    fx,
  );
  const payTotalMinor = payTotals.totalMinor;
  const payReady = paymentReady(
    pay, payMethod,
    payMethods.data?.cardSurchargeEnabled ?? false,
    payMethods.data?.cardSurchargeBp ?? 0,
    fx,
  );
  // Note / guest / message
  const [noteBody, setNoteBody] = useState('');
  const [guestName, setGuestName] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [voidReason, setVoidReason] = useState('');

  if (!reservationId) {
    return (
      <div className="py-16 text-center">
        <p className="font-bold mb-1">No reservation selected</p>
        <Button className="mt-3" onClick={() => navigate('in-house')}>Go to in-house</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={back} className="text-dash-muted hover:text-black"><ArrowLeft className="w-4 h-4" /></button>
        <SectionHeader eyebrow="Guest" title="Stay overview" />
      </div>

      <QueryState query={reservation} loadingRows={6}>
        {(r) => (
          <>
            {/* Header */}
            <Card className="mb-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h2 className="text-[20px] font-bold tracking-tight">{r.guest}</h2>
                    {r.vip && <Pill tone="yellow" solid>VIP</Pill>}
                    <Pill tone={statusTone(r.status)}>{r.status}</Pill>
                    {r.hostelworld && <HostelworldBadge />}
                  </div>
                  <p className="text-[11px] text-dash-muted">
                    {r.confirmation} · {r.roomType}
                    {r.room ? ` · room ${r.room}` : ' · no room assigned'}
                    {r.bed ? ` · bed ${r.bed}` : ''}
                    {' · '}{longDate(r.arrival)} → {longDate(r.departure)} ({r.nights}n)
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-dash-muted flex-wrap">
                    {r.email && <span>{r.email}</span>}
                    {r.phone && <span>{r.phone}</span>}
                    <span>{r.adults} adult{r.adults > 1 ? 's' : ''}{r.children ? `, ${r.children} child` : ''}</span>
                    {/* The OTA the guest booked on, not only the hub it came through:
                        "OTA · Hostelworld.com · BEDS24" rather than "OTA · BEDS24". */}
                    <span>
                      {r.source}
                      {r.otaChannel && r.otaChannel !== r.channel ? ` · ${r.otaChannel}` : ''}
                      {r.channel ? ` · ${r.channel}` : ''}
                    </span>
                    {r.profileId && (
                      <button onClick={() => navigate('profile-detail', { profileId: r.profileId! })}
                        className="font-bold text-black hover:underline">
                        Open profile
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">Balance</p>
                  <p className={`text-[24px] font-black tabular-nums ${r.balanceMinor > 0 ? 'text-status-bad' : r.balanceMinor < 0 ? 'text-status-info' : 'text-status-ok'}`}>
                    {money(r.balanceMinor)}
                  </p>
                  <p className="text-[10px] text-dash-muted mt-0.5">Stay total {money(r.totalMinor)}</p>
                </div>
              </div>

              {/* Total · Hostelworld collected · business price. Shown only
                  when Configuration → Hostelworld is on and this booking is
                  one of theirs. The edit is for the figure Beds24 did not
                  send, or sent wrong; the folio credit follows it. */}
              {r.hostelworld && (hwSettings.data?.enabled || r.hostelworldDetail) && (
                <div className="mt-4 pt-4 border-t subtle-divider space-y-4">
                  {hwSettings.data?.enabled && (
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-[16rem] max-w-sm flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <HostelworldBadge />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                            What the property receives
                          </p>
                        </div>
                        {hostelworldSplit(r) ? (
                          <>
                            <HostelworldMoney split={hostelworldSplit(r)} />
                            <p className="text-[10px] text-dash-muted mt-2">
                              {r.otaCreditMinor && r.otaCreditMinor > 0
                                ? `A credit of ${money(r.otaCreditMinor)} is on the folio, so the balance above is what the guest still owes.`
                                : 'No credit is on the folio — the balance above is the full stay; collect the business price.'}
                            </p>
                          </>
                        ) : (
                          <p className="text-[11px] text-dash-muted">
                            No collected amount is recorded for this booking yet, so it shows the plain
                            total. Enter what Hostelworld collected to see the business price.
                          </p>
                        )}
                      </div>
                      {!['Checked-out', 'Cancelled', 'No-show'].includes(r.status) && (
                        <PermissionButton permission="reservations.write" size="sm" variant="secondary"
                          onClick={() => { setHwCollected(r.otaCollectedMinor ?? 0); setHwOpen(true); }}>
                          {hostelworldSplit(r) ? 'Edit collected amount' : 'Enter collected amount'}
                        </PermissionButton>
                      )}
                    </div>
                  )}
                  {/* Hostelworld's own statement — booking price, deposit,
                      balance due, the promotion and every night — read from
                      Beds24 and laid out like the confirmation email. */}
                  {r.hostelworldDetail && (
                    <HostelworldStatement
                      detail={r.hostelworldDetail}
                      booking={{ totalMinor: r.totalMinor, otaCollectedMinor: r.otaCollectedMinor }}
                    />
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t subtle-divider">
                {r.status === 'Checked-in' && (
                  <PermissionButton permission="frontdesk.write" size="sm" icon={<LogOut className="w-3 h-3" />}
                    onClick={() => navigate('check-out', { reservationId: r.id })}>
                    Check out
                  </PermissionButton>
                )}
                {['Tentative', 'Confirmed', 'Guaranteed'].includes(r.status) && (
                  <PermissionButton permission="frontdesk.write" size="sm" icon={<LogIn className="w-3 h-3" />}
                    onClick={() => navigate('check-in', { reservationId: r.id })}>
                    Check in
                  </PermissionButton>
                )}
                <PermissionButton permission="folio.post" size="sm" variant="secondary"
                  icon={<Plus className="w-3 h-3" />} onClick={() => setChargeOpen(true)}>
                  Post charge
                </PermissionButton>
                <PermissionButton permission="folio.payment" size="sm" variant="secondary"
                  icon={<Receipt className="w-3 h-3" />}
                  onClick={() => {
                    setPay(emptyPayment(Math.max(0, r.balanceMinor)));
                    setBalanceMinor(Math.max(0, r.balanceMinor));
                    setPaymentOpen(true);
                  }}>
                  Take payment
                </PermissionButton>
                {!['Checked-out', 'Cancelled', 'No-show'].includes(r.status) && (
                  <PermissionButton permission="reservations.write" size="sm" variant="secondary"
                    icon={<CalendarClock className="w-3 h-3" />}
                    onClick={() => setStayOpen(true)}>
                    Extend / shorten
                  </PermissionButton>
                )}
                <PermissionButton permission="reservations.write" size="sm" variant="secondary"
                  icon={<ArrowRightLeft className="w-3 h-3" />}
                  onClick={() => navigate('new-reservation', { reservationId: r.id })}>
                  Amend booking
                </PermissionButton>
                <Button size="sm" variant="secondary" icon={<StickyNote className="w-3 h-3" />}
                  onClick={() => setNoteOpen(true)}>
                  Add note
                </Button>
                {['Tentative', 'Confirmed', 'Guaranteed'].includes(r.status) && (
                  <PermissionButton permission="reservations.write" size="sm" variant="danger"
                    icon={<Ban className="w-3 h-3" />} onClick={() => setCancelOpen(true)}>
                    Cancel
                  </PermissionButton>
                )}
              </div>
            </Card>

            {/* What the guest bought on the website, on the screen the desk
                opens to prepare for them — the flight to meet and the lessons
                to book are needed before check-in, not during it. */}
            <BookingExtras preferences={r.preferences} className="mb-3" />

            {/* A no-show that came through an OTA is not finished until the
                channel has been told — so the state of that sits on the booking,
                not buried in the channel manager. */}
            {r.status === 'No-show' && r.channel && (
              <div className="mb-4">
                <ChannelReportPanel reservationId={r.id} />
              </div>
            )}

            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <Tabs
                tabs={[
                  { value: 'folio', label: 'Folio' },
                  { value: 'stay', label: 'Nightly rates', count: r.nightRows.length },
                  { value: 'guests', label: 'Guests', count: r.guests.length },
                  { value: 'notes', label: 'Notes', count: r.notes.length },
                  { value: 'messages', label: 'Messages', count: messages.data?.length ?? 0 },
                ]}
                active={tab}
                onChange={setTab}
              />
              {tab === 'folio' && r.folios.length > 1 && (
                <div className="flex gap-1.5">
                  {r.folios.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setActiveFolioId(f.id)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${
                        folioId === f.id ? 'bg-black text-white border-black' : 'bg-white border-black/10'
                      }`}
                    >
                      #{f.windowNo} · {money(f.balanceMinor)}
                    </button>
                  ))}
                </div>
              )}
              {tab === 'folio' && (
                <PermissionButton permission="folio.post" size="sm" variant="ghost"
                  icon={<SplitSquareHorizontal className="w-3 h-3" />}
                  disabled={splitFolio.isPending}
                  onClick={async () => {
                    try {
                      const f = await splitFolio.mutateAsync({
                        reservationId: r.id,
                        body: { name: `${r.guest} — window ${r.folios.length + 1}` },
                      });
                      setActiveFolioId(f.id);
                      toast.success(`Folio window ${f.windowNo} opened`);
                    } catch (e) { toast.fail(e); }
                  }}>
                  Split folio
                </PermissionButton>
              )}
            </div>

            {tab === 'folio' && (
              <Card>
                <QueryState query={folio} loadingRows={5}>
                  {(f) => (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-[12px] font-bold">Folio {f.number}</p>
                          <p className="text-[10px] text-dash-muted">
                            {f.name} · window {f.windowNo} · {f.status}
                          </p>
                        </div>
                        <Pill tone={f.status === 'open' ? 'mint' : 'grey'}>{f.status}</Pill>
                      </div>

                      {f.lines.length === 0 && (
                        <p className="text-[12px] text-dash-muted py-8 text-center">
                          Nothing posted yet. Room charges are posted by the night audit.
                        </p>
                      )}

                      {f.lines.length > 0 && (
                        <div className="overflow-x-auto scroll-thin">
                          <table className="w-full min-w-[46rem] text-[12px]">
                            <thead>
                              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                                <th className="pb-2">Date</th>
                                <th className="pb-2">Code</th>
                                <th className="pb-2">Description</th>
                                <th className="pb-2 text-center">Qty</th>
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
                                  </td>
                                  <td className="py-2 text-center text-dash-muted">{l.qty}</td>
                                  <td className={`py-2 text-right tabular-nums font-bold ${l.amountMinor < 0 ? 'text-status-ok' : ''}`}>
                                    {money(l.amountMinor)}
                                  </td>
                                  <td className="py-2 text-right text-[10px] text-dash-muted">{l.postedBy}</td>
                                  <td className="py-2 text-right">
                                    {!l.voided && !l.parentLineId && f.status === 'open' && (
                                      <PermissionButton permission="folio.void" size="sm" variant="ghost"
                                        onClick={() => { setVoidTarget({ id: l.id, description: l.description }); setVoidReason(''); }}>
                                        Void
                                      </PermissionButton>
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
                    </>
                  )}
                </QueryState>
              </Card>
            )}

            {tab === 'stay' && (
              <Card>
                <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
                  Rate per night — what the night audit posts
                </p>
                <div className="overflow-x-auto scroll-thin">
                  <table className="w-full min-w-[46rem] text-[12px]">
                    <thead>
                      <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Room type</th>
                        <th className="pb-2">Room</th>
                        <th className="pb-2">Rate plan</th>
                        <th className="pb-2 text-center">Guests</th>
                        {/* For a Hostelworld booking: what the night was on
                            sale for on the channel and what the promotion
                            took off, beside the rate the night audit posts. */}
                        {r.hostelworldDetail && r.hostelworldDetail.nights.length > 0 && (
                          <>
                            <th className="pb-2 text-right whitespace-nowrap">On sale (HW)</th>
                            <th className="pb-2 text-right">Promotion</th>
                          </>
                        )}
                        <th className="pb-2 text-right">Rate</th>
                        <th className="pb-2 text-center">Posted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.nightRows.map((n) => {
                        const hwNight = r.hostelworldDetail?.nights.find((x) => x.date === n.date);
                        const off = hwNight && hwNight.sellMinor !== null && hwNight.sellMinor > hwNight.rateMinor
                          ? hwNight.sellMinor - hwNight.rateMinor : 0;
                        return (
                          <tr key={n.id} className="border-b border-black/[0.03]">
                            <td className="py-2 font-semibold">{longDate(n.date)}</td>
                            <td className="py-2">{n.roomType}</td>
                            <td className="py-2">{n.room ?? '—'}</td>
                            <td className="py-2 font-mono text-[10px]">{n.rateCode}</td>
                            <td className="py-2 text-center text-dash-muted">{n.adults}{n.children ? `+${n.children}` : ''}</td>
                            {r.hostelworldDetail && r.hostelworldDetail.nights.length > 0 && (
                              <>
                                <td className="py-2 text-right tabular-nums text-dash-muted">
                                  {hwNight?.sellMinor != null ? money(hwNight.sellMinor) : '—'}
                                </td>
                                <td className="py-2 text-right tabular-nums text-orange-600 whitespace-nowrap">
                                  {off > 0 && hwNight?.sellMinor
                                    ? `− ${money(off)} (${Math.round((off * 1000) / hwNight.sellMinor) / 10}%)` : ''}
                                </td>
                              </>
                            )}
                            <td className="py-2 text-right tabular-nums font-bold">{money(n.rateMinor)}</td>
                            <td className="py-2 text-center">
                              {n.posted ? <Pill tone="mint">Posted</Pill> : <Pill tone="grey">Pending</Pill>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5 + (r.hostelworldDetail && r.hostelworldDetail.nights.length > 0 ? 2 : 0)}
                          className="pt-3 text-right text-[11px] font-bold text-dash-muted">Total room charge</td>
                        <td className="pt-3 text-right tabular-nums font-black">{money(r.totalMinor)}</td>
                        <td />
                      </tr>
                      {r.hostelworldDetail?.promotion && (
                        <tr>
                          <td colSpan={8} className="pt-1 text-right text-[10px] text-dash-muted">
                            Includes a Hostelworld promotion of {money(r.hostelworldDetail.promotion.discountMinor)} off
                            the {money(r.hostelworldDetail.promotion.listMinor)} that was on sale.
                          </td>
                        </tr>
                      )}
                    </tfoot>
                  </table>
                </div>
              </Card>
            )}

            {tab === 'guests' && (
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">Guests in the room</p>
                  <PermissionButton permission="reservations.write" size="sm" variant="secondary"
                    icon={<UserPlus className="w-3 h-3" />} onClick={() => setGuestOpen(true)}>
                    Add guest
                  </PermissionButton>
                </div>
                <div className="space-y-2">
                  {r.guests.map((g) => (
                    <div key={g.id} className="flex items-center gap-3 p-3 rounded-xl bg-dash-bg">
                      <div className="flex-1">
                        <p className="text-[12px] font-bold">{g.name}</p>
                        <p className="text-[10px] text-dash-muted">
                          {g.isPrimary ? 'Primary guest' : g.kind}{g.registered ? ' · registered' : ''}
                        </p>
                      </div>
                      {g.profileId && (
                        <Button size="sm" variant="ghost"
                          onClick={() => navigate('profile-detail', { profileId: g.profileId! })}>
                          Profile
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {tab === 'notes' && (
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">Reservation notes</p>
                  <Button size="sm" variant="secondary" icon={<StickyNote className="w-3 h-3" />}
                    onClick={() => setNoteOpen(true)}>Add note</Button>
                </div>
                {r.notes.length === 0 && <p className="text-[12px] text-dash-muted py-6 text-center">No notes yet.</p>}
                <div className="space-y-2">
                  {r.notes.map((n) => (
                    <div key={n.id} className="p-3 rounded-xl bg-dash-bg">
                      <p className="text-[12px]">{n.body}</p>
                      <p className="text-[10px] text-dash-muted mt-1.5">
                        {n.user} · {timestamp(n.ts)} · {n.category}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {tab === 'messages' && (
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">Guest messages</p>
                  <Button size="sm" variant="secondary" icon={<MessageSquare className="w-3 h-3" />}
                    onClick={() => setMessageOpen(true)}>Compose</Button>
                </div>
                <div className="rounded-xl bg-dash-sky/30 p-3 mb-3">
                  <p className="text-[11px] text-dash-muted leading-relaxed">
                    Messages are recorded on the guest's thread. Outbound delivery needs an email or
                    messaging provider configured in Configuration → Integrations; until then they stay
                    as drafts rather than being reported as sent.
                  </p>
                </div>
                {(messages.data ?? []).length === 0 && (
                  <p className="text-[12px] text-dash-muted py-6 text-center">No messages on this stay.</p>
                )}
                <div className="space-y-2">
                  {messages.data?.map((m) => (
                    <div key={m.id} className={`p-3 rounded-xl ${m.direction === 'out' ? 'bg-dash-bg ml-8' : 'bg-dash-mint/30 mr-8'}`}>
                      {m.subject && <p className="text-[11px] font-bold mb-1">{m.subject}</p>}
                      <p className="text-[12px]">{m.body}</p>
                      <p className="text-[10px] text-dash-muted mt-1.5">
                        {m.channel} · {m.direction === 'out' ? 'to guest' : 'from guest'} · {relativeTime(m.ts)} · {m.status}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* ── Modals ── */}
            <Modal
              open={chargeOpen}
              onClose={() => setChargeOpen(false)}
              title="Post a charge"
              footer={
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setChargeOpen(false)}>Cancel</Button>
                  <Button
                    disabled={!chargeCode || chargeUnit <= 0 || postCharge.isPending || !folioId}
                    onClick={async () => {
                      try {
                        await postCharge.mutateAsync({
                          folioId: folioId!,
                          body: {
                            code: chargeCode,
                            description: chargeDesc || undefined,
                            qty: chargeQty,
                            unitMinor: chargeUnit,
                            persons: r.adults + r.children,
                          },
                        });
                        toast.success(`${money(chargeQty * chargeUnit)} posted`);
                        setChargeOpen(false);
                        setChargeCode(''); setChargeDesc(''); setChargeQty(1); setChargeUnit(0);
                      } catch (e) { toast.fail(e, 'Could not post the charge'); }
                    }}
                  >
                    {postCharge.isPending ? 'Posting…' : `Post ${money(chargeQty * chargeUnit)}`}
                  </Button>
                </div>
              }
            >
              <div className="space-y-4">
                <Field label="Transaction code" required>
                  <Select
                    value={chargeCode}
                    onChange={(v) => {
                      setChargeCode(v);
                      const tc = codes.data?.find((c) => c.code === v);
                      if (tc) {
                        setChargeDesc(tc.name);
                        if (tc.defaultPriceMinor > 0) setChargeUnit(tc.defaultPriceMinor);
                      }
                    }}
                    options={[
                      { label: 'Select a code', value: '' },
                      ...(codes.data ?? []).filter((c) => c.active && c.category !== 'payment')
                        .map((c) => ({ label: `${c.code} · ${c.name}`, value: c.code })),
                    ]}
                  />
                </Field>
                <Field label="Description">
                  <TextInput value={chargeDesc} onChange={setChargeDesc} placeholder="Appears on the folio" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Quantity">
                    <NumberInput value={chargeQty} onChange={setChargeQty} min={1} max={999} />
                  </Field>
                  <Field label="Unit price">
                    <MoneyInput valueMinor={chargeUnit} onChange={setChargeUnit} />
                  </Field>
                </div>
                <p className="text-[11px] text-dash-muted">
                  Taxes configured for this transaction code are calculated and posted automatically.
                </p>
              </div>
            </Modal>

            <Modal
              open={paymentOpen}
              onClose={() => setPaymentOpen(false)}
              title="Take a payment"
              footer={
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setPaymentOpen(false)}>Cancel</Button>
                  <Button
                    disabled={!payReady || postPayment.isPending || !folioId}
                    onClick={async () => {
                      try {
                        const done = await postPayment.mutateAsync({
                          folioId: folioId!,
                          body: paymentBody(pay, fx),
                        });
                        // Says what happened, not what was asked for: with a
                        // card fee the amount taken is not the amount typed,
                        // and the change is the number the desk needs next.
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
                      } catch (e) { toast.fail(e, 'Could not post the payment'); }
                    }}
                  >
                    {postPayment.isPending ? 'Posting…' : `Take ${money(payTotalMinor)}`}
                  </Button>
                </div>
              }
            >
              <PaymentFields draft={pay} onChange={setPay} balanceMinor={balanceMinor} />
            </Modal>

            <Modal
              open={noteOpen}
              onClose={() => setNoteOpen(false)}
              title="Add a note"
              footer={
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setNoteOpen(false)}>Cancel</Button>
                  <Button
                    disabled={!noteBody.trim() || addNote.isPending}
                    onClick={async () => {
                      try {
                        await addNote.mutateAsync({ id: r.id, body: noteBody.trim() });
                        toast.success('Note added');
                        setNoteOpen(false); setNoteBody('');
                      } catch (e) { toast.fail(e); }
                    }}
                  >
                    Save note
                  </Button>
                </div>
              }
            >
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                rows={5}
                placeholder="Visible to everyone working this reservation"
                className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-black/40"
              />
            </Modal>

            <Modal
              open={guestOpen}
              onClose={() => setGuestOpen(false)}
              title="Add a guest to the room"
              footer={
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setGuestOpen(false)}>Cancel</Button>
                  <Button
                    disabled={!guestName.trim() || addGuest.isPending}
                    onClick={async () => {
                      try {
                        await addGuest.mutateAsync({ id: r.id, body: { name: guestName.trim(), kind: 'adult' } });
                        toast.success('Guest added');
                        setGuestOpen(false); setGuestName('');
                      } catch (e) { toast.fail(e); }
                    }}
                  >
                    Add guest
                  </Button>
                </div>
              }
            >
              <Field label="Full name" required>
                <TextInput value={guestName} onChange={setGuestName} />
              </Field>
            </Modal>

            <Modal
              open={messageOpen}
              onClose={() => setMessageOpen(false)}
              title="Message the guest"
              footer={
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setMessageOpen(false)}>Cancel</Button>
                  <Button
                    disabled={!messageBody.trim() || sendMessage.isPending}
                    onClick={async () => {
                      try {
                        await sendMessage.mutateAsync({
                          reservationId: r.id, profileId: r.profileId,
                          channel: 'email', direction: 'out', body: messageBody.trim(),
                        });
                        toast.success('Message saved as a draft on the thread');
                        setMessageOpen(false); setMessageBody('');
                      } catch (e) { toast.fail(e); }
                    }}
                  >
                    Save message
                  </Button>
                </div>
              }
            >
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={5}
                className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-black/40"
              />
            </Modal>

            <Modal
              open={!!voidTarget}
              onClose={() => setVoidTarget(null)}
              title="Void this posting"
              footer={
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setVoidTarget(null)}>Cancel</Button>
                  <Button variant="danger"
                    disabled={!voidReason.trim() || voidLine.isPending}
                    onClick={async () => {
                      if (!voidTarget) return;
                      try {
                        const res = await voidLine.mutateAsync({ lineId: voidTarget.id, reason: voidReason.trim() });
                        toast.success(`${res.voided} line(s) voided`);
                        setVoidTarget(null);
                      } catch (e) { toast.fail(e); }
                    }}
                  >
                    Void posting
                  </Button>
                </div>
              }
            >
              <div className="space-y-3">
                <p className="text-[12px] text-dash-muted">
                  <span className="font-bold text-black">{voidTarget?.description}</span> and any tax posted with it
                  will be struck from the balance. The lines stay visible on the folio and the void is recorded in
                  the audit trail.
                </p>
                <Field label="Reason" required>
                  <TextInput value={voidReason} onChange={setVoidReason} placeholder="e.g. posted to the wrong folio" />
                </Field>
              </div>
            </Modal>

            <ConfirmDialog
              open={cancelOpen}
              title={`Cancel ${r.confirmation}?`}
              body="The rooms are released back to inventory. Any cancellation fee must be posted separately."
              confirmLabel="Cancel reservation"
              danger
              busy={cancelReservation.isPending}
              onCancel={() => setCancelOpen(false)}
              onConfirm={async () => {
                try {
                  await cancelReservation.mutateAsync({ id: r.id, reason: 'Cancelled at the front desk' });
                  toast.success('Reservation cancelled');
                  setCancelOpen(false);
                  navigate('reservations');
                } catch (e) { toast.fail(e); }
              }}
            />

            <Modal
              open={hwOpen}
              onClose={() => setHwOpen(false)}
              title="What Hostelworld collected"
              size="sm"
              footer={
                <div className="flex justify-between gap-2">
                  {r.otaCollectedMinor != null ? (
                    <Button variant="ghost" disabled={updateReservation.isPending}
                      onClick={async () => {
                        try {
                          await updateReservation.mutateAsync({ id: r.id, body: { otaCollectedMinor: null } });
                          toast.success('Collected amount cleared');
                          setHwOpen(false);
                        } catch (e) { toast.fail(e); }
                      }}>
                      Clear
                    </Button>
                  ) : <span />}
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setHwOpen(false)}>Cancel</Button>
                    <Button
                      disabled={updateReservation.isPending || hwCollected < 0 || hwCollected > r.totalMinor}
                      onClick={async () => {
                        try {
                          await updateReservation.mutateAsync({ id: r.id, body: { otaCollectedMinor: hwCollected } });
                          toast.success('Collected amount saved');
                          setHwOpen(false);
                        } catch (e) { toast.fail(e); }
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              }
            >
              <p className="text-[11px] text-dash-muted mb-3">
                The deposit Hostelworld took from the guest when they booked, and keeps. The total
                booking price is {money(r.totalMinor)}; the business price will be the total less
                this amount.
              </p>
              <Field label="Hostelworld collected" required
                hint={hwCollected > r.totalMinor ? 'Cannot be more than the total booking price' : undefined}>
                <MoneyInput valueMinor={hwCollected} onChange={setHwCollected} />
              </Field>
              <p className="text-[11px] mt-3">
                Business price:{' '}
                <span className="font-black tabular-nums">
                  {money(Math.max(0, r.totalMinor - Math.min(r.totalMinor, Math.max(0, hwCollected))))}
                </span>
              </p>
            </Modal>

            <StayDatesModal
              open={stayOpen}
              onClose={() => setStayOpen(false)}
              reservation={{
                id: r.id, confirmation: r.confirmation, guest: r.guest,
                arrival: r.arrival, departure: r.departure, room: r.room, status: r.status,
              }}
            />
          </>
        )}
      </QueryState>
    </div>
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
