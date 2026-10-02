import { useState, useEffect } from 'react';
import { LogIn, ArrowLeft, Check, Bed, CreditCard, IdCard, AlertTriangle } from 'lucide-react';
import { useNav } from '../nav';
import {
  useReservation, useFreeRooms, useCheckIn, useAssignRoom, usePaymentMethods,
} from '../queries';
import {
  PaymentFields, emptyPayment, paymentBody, paymentTotals, paymentReady, useFxHelper,
  type PaymentDraft,
} from '../payment';
import { useAuthStore } from '../stores';
import { Card, Pill, Button, SectionHeader, Field, Select, TextInput, WizardSteps } from '../ui';
import { RegistrationDocuments } from '../registration';
import { GuestRegistrationPanel } from '../guestregistration';
import { QueryState, useToast, MoneyInput, ErrorNote, statusTone } from '../components';
import { ConfirmBookingModal } from '../confirmbooking';
import { money, shortDate, longDate, bpToPercent } from '../format';
import { BookingExtras } from '../bookingextras';
import {
  HostelworldBadge, HostelworldMoney, hostelworldSplit, hostelworldMismatch, promotionLabel,
} from '../hostelworld';

export function CheckInScreen({ reservationId }: { reservationId?: string }) {
  const { navigate, back } = useNav();
  const toast = useToast();
  const property = useAuthStore((s) => s.property);
  const reservation = useReservation(reservationId);
  const checkIn = useCheckIn();
  const assignRoom = useAssignRoom();

  const [step, setStep] = useState(0);
  const [roomId, setRoomId] = useState('');
  const [bedId, setBedId] = useState('');
  const [idType, setIdType] = useState('passport');
  const [idNumber, setIdNumber] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [confirming, setConfirming] = useState(false);

  // The deposit runs through the same till as everything else — the same
  // panel, the same card fee, the same currencies and the same change
  // arithmetic. A deposit taken at check-in and a payment taken at the cashier
  // desk are the same act of taking money, and were never worth two forms.
  const payMethods = usePaymentMethods();
  const fx = useFxHelper();
  const [pay, setPay] = useState<PaymentDraft>(emptyPayment());
  const depositMethod = payMethods.data?.methods.find((m) => m.code === pay.method);
  const depositMinor = pay.amountMinor;
  const payTotals = paymentTotals(
    pay,
    depositMethod,
    payMethods.data?.cardSurchargeEnabled ?? false,
    payMethods.data?.cardSurchargeBp ?? 0,
    fx,
  );
  const depositCardFeeMinor = payTotals.surchargeMinor;
  const payBlocked = depositMinor > 0 && !paymentReady(
    pay, depositMethod,
    payMethods.data?.cardSurchargeEnabled ?? false,
    payMethods.data?.cardSurchargeBp ?? 0,
    fx,
  );

  const res = reservation.data;
  const isDorm = res?.roomTypeKind === 'dorm';

  const freeRooms = useFreeRooms(
    res?.arrival ?? '',
    res?.departure ?? '',
    res?.roomTypeId,
    reservationId,
    !!res,
  );

  useEffect(() => {
    if (res?.roomId) setRoomId(res.roomId);
    if (res?.bedId) setBedId(res.bedId);
  }, [res?.roomId, res?.bedId]);

  if (!reservationId) {
    return (
      <div className="py-16 text-center">
        <p className="font-bold mb-1">No reservation selected</p>
        <p className="text-[12px] text-dash-muted mb-4">Pick an arrival to check in.</p>
        <Button onClick={() => navigate('arrivals')}>Go to arrivals</Button>
      </div>
    );
  }

  async function submit() {
    setError(null);
    try {
      const result = await checkIn.mutateAsync({
        id: reservationId!,
        body: {
          roomId: roomId || undefined,
          bedId: bedId || undefined,
          idType,
          idNumber: idNumber || undefined,
          registered: true,
          // Everything that crossed the counter, so the folio line reads the
          // same whether the money was taken here or at the cashier desk.
          ...(depositMinor > 0
            ? (() => {
              const body = paymentBody(pay, fx);
              return {
                paymentMinor: body.amountMinor,
                paymentMethod: body.method,
                tenderedMinor: body.tenderedMinor,
                tenderCurrency: body.tenderCurrency,
                tenderRate: body.tenderRate,
                changeCurrency: body.changeCurrency,
                changeRate: body.changeRate,
              };
            })()
            : {}),
        },
      });
      toast.success(`${result.guest} checked into room ${result.room}`);
      navigate('guest-dashboard', { reservationId: reservationId! });
    } catch (e) {
      setError(e);
      toast.fail(e, 'Check-in failed');
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={back} className="text-dash-muted hover:text-black">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <SectionHeader eyebrow="Front office" title="Check-in" />
      </div>

      <QueryState query={reservation} loadingRows={5}>
        {(r) => {
          if (r.status === 'Checked-in') {
            return (
              <Card tone="mint">
                <p className="text-[14px] font-bold mb-1">{r.guest} is already checked in</p>
                <p className="text-[12px] text-dash-muted mb-4">
                  Room {r.room} · arrived {shortDate(r.arrival)}
                </p>
                <Button onClick={() => navigate('guest-dashboard', { reservationId: r.id })}>
                  Open guest dashboard
                </Button>
              </Card>
            );
          }
          // Explained here rather than left to the server's 409. A booking the
          // website took holds no room until somebody accepts it, so there is
          // nothing to check the guest into — and the fix is one button away.
          if (r.awaitingConfirmation) {
            return (
              <Card tone="peach">
                <p className="text-[14px] font-bold mb-1">This booking has not been confirmed yet</p>
                <p className="text-[12px] text-dash-muted mb-4">
                  {r.guest} booked on the website, but the property has not accepted it. It holds no
                  room and cannot be checked in. Confirm it first — that picks the room or beds and
                  closes the dates on the calendar.
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => setConfirming(true)}>Confirm booking</Button>
                  <Button variant="secondary" onClick={() => navigate('reservations')}>
                    Back to reservations
                  </Button>
                </div>
                <ConfirmBookingModal
                  reservationId={r.id}
                  open={confirming}
                  onClose={() => setConfirming(false)}
                />
              </Card>
            );
          }
          if (!['Tentative', 'Confirmed', 'Guaranteed'].includes(r.status)) {
            return (
              <Card tone="peach">
                <p className="text-[14px] font-bold mb-1">This reservation cannot be checked in</p>
                <p className="text-[12px] text-dash-muted">Its status is {r.status}.</p>
              </Card>
            );
          }

          const arrivalInFuture = property && r.arrival > property.businessDate;
          const selectedRoom = freeRooms.data?.rooms.find((x) => x.id === roomId);
          const roomNotReady = selectedRoom?.status === 'Vacant Dirty';

          return (
            <>
              <div className="mb-5"><WizardSteps steps={['Guest & stay', 'Room', 'Registration & payment']} current={step} /></div>

              <div className="grid lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2 space-y-3">
                  {arrivalInFuture && (
                    <div className="rounded-2xl bg-dash-peach/50 border border-black/5 p-3 flex items-start gap-2.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-status-warn mt-0.5 shrink-0" />
                      <p className="text-[11px] leading-relaxed">
                        This reservation arrives on {longDate(r.arrival)}, after the open business date
                        ({property?.businessDate}). Early check-in is refused until the business date reaches
                        the arrival — run the night audit if the date is behind.
                      </p>
                    </div>
                  )}

                  {step === 0 && (
                    <Card>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-4">Reservation</p>
                      <div className="grid md:grid-cols-2 gap-x-6 gap-y-3">
                        <Detail label="Guest" value={r.guest} />
                        <Detail label="Confirmation" value={r.confirmation} />
                        <Detail label="Email" value={r.email || '—'} />
                        <Detail label="Phone" value={r.phone || '—'} />
                        <Detail label="Arrival" value={longDate(r.arrival)} />
                        <Detail label="Departure" value={longDate(r.departure)} />
                        <Detail label="Nights" value={String(r.nights)} />
                        <Detail label="Occupancy" value={`${r.adults} adult${r.adults > 1 ? 's' : ''}${r.children ? `, ${r.children} child` : ''}`} />
                        <Detail label="Room type" value={r.roomType} />
                        <Detail label="Rate plan" value={`${r.ratePlanName} (${r.rateCode})`} />
                        <Detail label="Source" value={r.channel ? `${r.source} · ${r.otaChannel ?? r.channel}` : r.source} />
                        <Detail label="Total room charge" value={money(r.totalMinor)} />
                      </div>
                      {/* Total · Hostelworld collected · business price: what
                          the desk should actually ask this guest for. */}
                      {hostelworldSplit(r) && (
                        <div className="mt-4 rounded-xl bg-orange-50 border border-orange-100 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <HostelworldBadge />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                              Collect the business price
                            </p>
                          </div>
                          <div className="max-w-xs">
                            <HostelworldMoney split={hostelworldSplit(r)} />
                          </div>
                          <p className="text-[11px] text-dash-muted mt-2">
                            Hostelworld already took {money(r.otaCollectedMinor ?? 0)} from this guest
                            when they booked. Ask for {money(r.businessMinor ?? 0)}
                            {r.otaCreditMinor && r.otaCreditMinor > 0
                              ? '; the folio already carries a matching credit.'
                              : '.'}
                          </p>
                          {r.hostelworldDetail?.promotion && (
                            <p className="text-[11px] text-dash-muted mt-1">
                              The price includes a Hostelworld promotion — {promotionLabel(r.hostelworldDetail)},{' '}
                              {money(r.hostelworldDetail.promotion.discountMinor)} off what was on sale.
                            </p>
                          )}
                          {hostelworldMismatch(r.hostelworldDetail ?? null, r).map((m) => (
                            <p key={m} className="text-[11px] font-semibold text-status-bad mt-1">{m}</p>
                          ))}
                        </div>
                      )}
                      {r.specialRequests && (
                        <div className="mt-4 rounded-xl bg-dash-yellow/40 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1">Special requests</p>
                          <p className="text-[12px]">{r.specialRequests}</p>
                        </div>
                      )}
                      <BookingExtras preferences={r.preferences} className="mt-4" />
                    </Card>
                  )}

                  {step === 1 && (
                    <Card>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-4">
                        {isDorm ? 'Bed assignment' : 'Room assignment'}
                      </p>
                      {freeRooms.isLoading && <p className="text-[12px] text-dash-muted">Finding free rooms…</p>}
                      {freeRooms.isError && <ErrorNote error={freeRooms.error} onRetry={freeRooms.refetch} />}

                      {isDorm ? (
                        <>
                          <Field label="Bed" required hint="Only beds free for the whole stay are listed">
                            <Select
                              value={bedId}
                              onChange={setBedId}
                              options={[
                                { label: 'Assign automatically', value: '' },
                                ...(freeRooms.data?.beds ?? []).map((b) => ({
                                  label: `${b.code} · room ${b.room} · ${b.bunk}`,
                                  value: b.id,
                                })),
                              ]}
                            />
                          </Field>
                          {freeRooms.data && freeRooms.data.beds.length === 0 && (
                            <p className="text-[11px] text-status-bad font-semibold mt-3">
                              No bed of this type is free for the whole stay.
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <Field label="Room" hint="Only rooms free for the whole stay are listed">
                            <Select
                              value={roomId}
                              onChange={setRoomId}
                              options={[
                                { label: 'Assign automatically (cleanest room first)', value: '' },
                                ...(freeRooms.data?.rooms ?? []).map((room) => ({
                                  label: `${room.number} · floor ${room.floor} · ${room.status}`,
                                  value: room.id,
                                })),
                              ]}
                            />
                          </Field>
                          {roomNotReady && (
                            <div className="mt-3 rounded-xl bg-dash-peach/50 p-3 flex items-start gap-2.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-status-warn mt-0.5 shrink-0" />
                              <p className="text-[11px]">
                                Room {selectedRoom?.number} is still dirty. Check-in will be refused until
                                housekeeping releases it.
                              </p>
                            </div>
                          )}
                          {freeRooms.data && freeRooms.data.rooms.length === 0 && (
                            <p className="text-[11px] text-status-bad font-semibold mt-3">
                              No room of this type is free for the whole stay. Change the room type, or move
                              another reservation.
                            </p>
                          )}
                          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                            {(freeRooms.data?.rooms ?? []).slice(0, 12).map((room) => (
                              <button
                                key={room.id}
                                onClick={() => setRoomId(room.id)}
                                className={`p-3 rounded-xl border text-left transition-colors ${
                                  roomId === room.id ? 'border-black bg-dash-bg' : 'border-black/5 hover:bg-dash-bg'
                                }`}
                              >
                                <p className="text-[14px] font-black">{room.number}</p>
                                <p className="text-[9px] text-dash-muted mt-0.5">Floor {room.floor}</p>
                                <Pill tone={statusTone(room.status)} className="mt-1.5">{room.status.replace('Vacant ', '')}</Pill>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </Card>
                  )}

                  {step === 2 && (
                    <>
                      <Card>
                        <div className="flex items-center gap-2 mb-4">
                          <IdCard className="w-4 h-4 text-dash-muted" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">Registration</p>
                        </div>

                        {/* Offered before the fields, because the whole point is
                            that the guest fills them in rather than reading a
                            passport number out across the desk. The fields stay
                            below for a guest without a phone. */}
                        <div className="mb-5">
                          <GuestRegistrationPanel reservationId={r.id} guest={r.guest} />
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                          <Field label="ID type">
                            <Select
                              value={idType}
                              onChange={setIdType}
                              options={[
                                { label: 'Passport', value: 'passport' },
                                { label: 'National ID', value: 'national-id' },
                                { label: 'Driving licence', value: 'licence' },
                              ]}
                            />
                          </Field>
                          <Field label="ID number" hint="Stored on the guest profile for future stays">
                            <TextInput value={idNumber} onChange={setIdNumber} placeholder="e.g. N1234567" />
                          </Field>
                        </div>

                        {/* The document itself and the signature, beneath the
                            number that used to stand in for both. */}
                        <div className="mt-5 pt-4 border-t subtle-divider">
                          <RegistrationDocuments reservationId={r.id} guestName={r.guest} />
                        </div>
                      </Card>

                      <Card>
                        <div className="flex items-center gap-2 mb-4">
                          <CreditCard className="w-4 h-4 text-dash-muted" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">Deposit / advance payment</p>
                        </div>
                        {/* What is outstanding on the folio is what "full
                            payment" means here, so the desk can settle the
                            whole bill at check-in without typing a figure. */}
                        {/* The room is posted by the night audit, so at
                            check-in the folio is usually still empty and its
                            balance is zero. What the guest is here to pay is
                            the stay, so that is what "full payment" offers
                            until real charges exist to settle instead. */}
                        {/* For a Hostelworld booking with the split on, what
                            the guest is here to pay is the business price —
                            Hostelworld already took the rest. Any credit
                            already on the folio (that same Hostelworld line,
                            or a deposit taken earlier) comes off what is
                            offered, so "full payment" is never asked twice. */}
                        {(() => {
                          const split = hostelworldSplit(r);
                          const expected = split ? split.businessMinor : r.totalMinor;
                          const hwCredit = r.otaCreditMinor ?? 0;
                          const otherCredits = Math.max(0, Math.max(0, -r.balanceMinor) - hwCredit);
                          const due = r.balanceMinor > 0
                            ? r.balanceMinor
                            : Math.max(0, expected - otherCredits);
                          const label = r.balanceMinor > 0
                            ? 'Outstanding on the folio'
                            : split
                              ? 'Business price · Hostelworld collected the rest at booking'
                              : otherCredits > 0
                                ? 'Stay total less what is already on the folio'
                                : 'Stay total · nothing posted to the folio yet';
                          return (
                            <PaymentFields
                              draft={pay}
                              onChange={setPay}
                              balanceMinor={due}
                              dueLabel={label}
                            />
                          );
                        })()}
                        <p className="text-[11px] text-dash-muted mt-3">
                          Leave the amount at 0 to take payment later.
                        </p>
                        {depositCardFeeMinor > 0 && (
                          <p className="text-[11px] text-dash-muted mt-1">
                            A {bpToPercent(payMethods.data?.cardSurchargeBp ?? 0)}% card fee of{' '}
                            <span className="font-bold">{money(depositCardFeeMinor)}</span> will be
                            added, so the card is charged{' '}
                            <span className="font-bold">{money(depositMinor + depositCardFeeMinor)}</span>.
                          </p>
                        )}
                        {r.depositRequiredMinor > 0 && (
                          <p className="text-[11px] text-dash-muted mt-3">
                            Deposit required on this booking: <span className="font-bold">{money(r.depositRequiredMinor)}</span>
                          </p>
                        )}
                      </Card>
                    </>
                  )}

                  {error && <ErrorNote error={error} />}

                  <div className="flex items-center justify-between pt-2">
                    <Button
                      variant="ghost"
                      disabled={step === 0}
                      onClick={() => setStep((s) => Math.max(0, s - 1))}
                    >
                      Back
                    </Button>
                    {step < 2 ? (
                      <Button onClick={() => setStep((s) => s + 1)}>Continue</Button>
                    ) : (
                      <Button
                        icon={<LogIn className="w-3.5 h-3.5" />}
                        disabled={checkIn.isPending || payBlocked}
                        onClick={submit}
                      >
                        {checkIn.isPending ? 'Checking in…' : 'Complete check-in'}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Summary rail */}
                <div className="space-y-3">
                  <Card tone="dark">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-3">Checking in</p>
                    <p className="text-[18px] font-black leading-tight mb-1">{r.guest}</p>
                    <p className="text-[11px] text-white/60 mb-4">{r.confirmation}</p>
                    <div className="space-y-2">
                      <SummaryRow label="Room type" value={r.roomType} dark />
                      <SummaryRow label="Room" value={selectedRoom?.number ?? r.room ?? 'auto'} dark />
                      <SummaryRow label="Nights" value={String(r.nights)} dark />
                      <SummaryRow label="Rate" value={`${money(r.rateMinor)} / night`} dark />
                      <div className="border-t border-white/10 pt-2">
                        {hostelworldSplit(r) ? (
                          <HostelworldMoney split={hostelworldSplit(r)} dark />
                        ) : (
                          <SummaryRow label="Stay total" value={money(r.totalMinor)} dark strong />
                        )}
                        <SummaryRow label="Folio balance" value={money(r.balanceMinor)} dark />
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">Check-in rules</p>
                    <ul className="space-y-2 text-[11px] text-dash-muted leading-relaxed">
                      <li className="flex gap-2"><Check className="w-3 h-3 mt-0.5 shrink-0" /> The room must be clean or inspected</li>
                      <li className="flex gap-2"><Check className="w-3 h-3 mt-0.5 shrink-0" /> Arrival date must have been reached</li>
                      <li className="flex gap-2"><Check className="w-3 h-3 mt-0.5 shrink-0" /> The room is held for the whole stay</li>
                      <li className="flex gap-2"><Bed className="w-3 h-3 mt-0.5 shrink-0" /> Room status becomes Occupied on check-in</li>
                    </ul>
                  </Card>
                </div>
              </div>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-0.5">{label}</p>
      <p className="text-[13px] font-semibold">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value, dark, strong }: { label: string; value: string; dark?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`text-[11px] ${dark ? 'text-white/50' : 'text-dash-muted'}`}>{label}</span>
      <span className={`text-[12px] tabular-nums ${strong ? 'font-black' : 'font-bold'}`}>{value}</span>
    </div>
  );
}
