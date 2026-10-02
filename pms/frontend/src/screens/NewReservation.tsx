import { useState, useEffect, useMemo } from 'react';
import { Search, Check, AlertTriangle, Ban, User, Sparkles } from 'lucide-react';
import { useNav } from '../nav';
import {
  useQuote, useCreateReservation, useUpdateReservation, useReservation, useWalkIn,
  useProfiles, useCompanies, useGroups,
} from '../queries';
import { useAuthStore } from '../stores';
import {
  Card, Pill, Button, SectionHeader, Field, Select, TextInput, WizardSteps,
} from '../ui';
import {
  QueryState, useToast, MoneyInput, NumberInput, DateInput, ErrorNote, Toggle,
  PermissionButton,
} from '../components';
import { CheckInQr } from '../registration';
import { money, longDate, nightsBetween, addDays } from '../format';
import type { QuoteOption } from '../types';

const SOURCES = ['Direct', 'Phone', 'Email', 'Walk-in', 'Corporate', 'Travel Agent', 'Group', 'OTA'];
const SEGMENTS = ['Leisure', 'Business', 'Group', 'Corporate', 'Long stay', 'Crew', 'House use'];

export function NewReservationScreen({ reservationId }: { reservationId?: string }) {
  const { navigate } = useNav();
  const toast = useToast();
  const property = useAuthStore((s) => s.property);
  const existing = useReservation(reservationId);
  const quote = useQuote();
  const createReservation = useCreateReservation();
  const updateReservation = useUpdateReservation();
  const walkIn = useWalkIn();
  const companies = useCompanies();
  const groups = useGroups();

  const isAmend = !!reservationId;
  const today = property?.businessDate ?? new Date().toISOString().slice(0, 10);

  const [step, setStep] = useState(0);
  const [arrival, setArrival] = useState(today);
  const [departure, setDeparture] = useState(addDays(today, 1));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [selected, setSelected] = useState<QuoteOption | null>(null);

  const [guestName, setGuestName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileSearch, setProfileSearch] = useState('');
  const [source, setSource] = useState('Direct');
  const [segment, setSegment] = useState('Leisure');
  const [status, setStatus] = useState('Confirmed');
  const [companyId, setCompanyId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [eta, setEta] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [vip, setVip] = useState(false);
  const [overrideRate, setOverrideRate] = useState(false);
  const [overrideMinor, setOverrideMinor] = useState(0);
  const [overrideReason, setOverrideReason] = useState('');
  const [depositMinor, setDepositMinor] = useState(0);
  const [checkInNow, setCheckInNow] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [created, setCreated] = useState<
    { id: string; confirmation: string; guest: string; nights: number } | null
  >(null);

  const profiles = useProfiles(profileSearch.trim().length >= 2 ? profileSearch.trim() : undefined);

  // Seed the form when amending an existing booking.
  useEffect(() => {
    const r = existing.data;
    if (!r) return;
    setArrival(r.arrival);
    setDeparture(r.departure);
    setAdults(r.adults);
    setChildren(r.children);
    setGuestName(r.guest);
    setEmail(r.email);
    setPhone(r.phone);
    setSource(r.source);
    setSegment(r.segment || 'Leisure');
    setStatus(r.status);
    setEta(r.eta ?? '');
    setSpecialRequests(r.specialRequests ?? '');
    setVip(r.vip);
    setCompanyId(r.companyId ?? '');
    setProfileId(r.profileId ?? null);
  }, [existing.data]);

  const nights = Math.max(0, nightsBetween(arrival, departure));
  const datesValid = nights >= 1 && nights <= 365;

  async function runQuote() {
    setError(null);
    try {
      const res = await quote.mutateAsync({
        arrival, departure, adults, children,
        promotionCode: promoCode.trim() || undefined,
      });
      // Keep the current pick if it is still offered.
      if (selected) {
        const again = res.options.find(
          (o) => o.roomTypeId === selected.roomTypeId && o.ratePlanId === selected.ratePlanId);
        setSelected(again ?? null);
      }
      return res;
    } catch (e) {
      setError(e);
      toast.fail(e, 'Could not price this stay');
      return null;
    }
  }

  useEffect(() => {
    if (datesValid && step === 1) runQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, arrival, departure, adults, children, promoCode]);

  async function submit() {
    setError(null);
    if (!selected) return;
    const body: Record<string, unknown> = {
      guestName: guestName.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      profileId: profileId || undefined,
      arrival, departure, adults, children,
      roomTypeId: selected.roomTypeId,
      ratePlanId: selected.ratePlanId,
      status,
      source,
      segment,
      companyId: companyId || undefined,
      groupId: groupId || undefined,
      vip,
      eta: eta || undefined,
      specialRequests: specialRequests.trim() || undefined,
      promotionCode: promoCode.trim() || undefined,
      depositRequiredMinor: depositMinor || undefined,
      rateOverrideMinor: overrideRate ? overrideMinor : undefined,
      overrideReason: overrideRate ? overrideReason : undefined,
    };

    try {
      if (isAmend) {
        const r = await updateReservation.mutateAsync({ id: reservationId!, body });
        toast.success(`${r.confirmation} updated`);
        navigate('guest-dashboard', { reservationId: r.id });
      } else if (checkInNow) {
        const r = await walkIn.mutateAsync(body);
        toast.success(`${r.guest} checked into room ${r.room}`);
        navigate('guest-dashboard', { reservationId: r.id });
      } else {
        const r = await createReservation.mutateAsync(body);
        toast.success(`Reservation ${r.confirmation} created`, `${money(r.totalMinor)} for ${r.nights} night(s)`);
        // Stay put and offer the check-in hand-off. Jumping straight to the
        // guest dashboard threw away the one moment where the reservation is
        // certainly the right one and somebody is about to walk to the guest
        // with a phone.
        setCreated({ id: r.id, confirmation: r.confirmation, guest: r.guest, nights: r.nights });
      }
    } catch (e) {
      setError(e);
      toast.fail(e, isAmend ? 'Could not amend the reservation' : 'Could not create the reservation');
    }
  }

  const busy = createReservation.isPending || updateReservation.isPending || walkIn.isPending;
  const canContinueFromDates = datesValid;
  const canContinueFromRoom = !!selected && selected.sellable;
  const canSubmit = !!selected && guestName.trim().length >= 2;

  /*
   * Booked. The screen stops being a form and becomes a hand-off: the
   * confirmation, and a code that opens this reservation's check-in on the
   * phone somebody is about to carry to the guest.
   */
  if (created) {
    return (
      <div>
        <SectionHeader eyebrow="Reservations" title="Reservation created" />
        <Card className="max-w-3xl">
          <div className="flex items-center gap-2 mb-1">
            <Check className="w-4 h-4 text-status-ok" />
            <p className="text-[15px] font-black">{created.confirmation}</p>
          </div>
          <p className="text-[12px] text-dash-muted mb-5">
            {created.guest} · {created.nights} night{created.nights === 1 ? '' : 's'}
          </p>

          <div className="rounded-2xl bg-dash-bg p-4">
            <CheckInQr reservationId={created.id} confirmation={created.confirmation}
              guest={created.guest} />
          </div>

          <div className="flex items-center gap-2 flex-wrap mt-5">
            <PermissionButton permission="frontdesk.write"
              onClick={() => navigate('check-in', { reservationId: created.id })}>
              Check in here
            </PermissionButton>
            <Button variant="secondary"
              onClick={() => navigate('guest-dashboard', { reservationId: created.id })}>
              Open the booking
            </Button>
            <Button variant="ghost" onClick={() => { setCreated(null); navigate('new-reservation'); }}>
              Another reservation
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        eyebrow={isAmend ? `Amending ${existing.data?.confirmation ?? ''}` : 'Reservations'}
        title={isAmend ? 'Amend reservation' : 'New reservation'}
      />

      <div className="mb-5">
        <WizardSteps steps={['Stay', 'Room & rate', 'Guest', 'Confirm']} current={step} />
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 space-y-3">
          {/* ── Step 0: dates ── */}
          {step === 0 && (
            <Card>
              <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-4">Stay dates</p>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Arrival" required>
                  <DateInput value={arrival} onChange={(v) => {
                    setArrival(v);
                    if (v >= departure) setDeparture(addDays(v, 1));
                  }} min={addDays(today, -1)} />
                </Field>
                <Field label="Departure" required>
                  <DateInput value={departure} onChange={setDeparture} min={addDays(arrival, 1)} />
                </Field>
                <Field label="Adults" required>
                  <NumberInput value={adults} onChange={setAdults} min={1} max={30} />
                </Field>
                <Field label="Children">
                  <NumberInput value={children} onChange={setChildren} min={0} max={20} />
                </Field>
                <Field label="Promotion code" hint="Optional — validated against the rules you configured">
                  <TextInput value={promoCode} onChange={(v) => setPromoCode(v.toUpperCase())} placeholder="EARLYBIRD" />
                </Field>
              </div>
              {!datesValid && (
                <p className="text-[11px] text-status-bad font-semibold mt-3">
                  Departure must be at least one night after arrival.
                </p>
              )}
              {datesValid && (
                <p className="text-[12px] text-dash-muted mt-4">
                  {nights} night{nights > 1 ? 's' : ''} · {longDate(arrival)} → {longDate(departure)}
                </p>
              )}
            </Card>
          )}

          {/* ── Step 1: room & rate ── */}
          {step === 1 && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                  Available room types &amp; rates
                </p>
                <Button size="sm" variant="ghost" onClick={runQuote} disabled={quote.isPending}>
                  {quote.isPending ? 'Pricing…' : 'Refresh prices'}
                </Button>
              </div>

              {quote.isPending && <p className="text-[12px] text-dash-muted py-6 text-center">Checking availability and pricing…</p>}
              {quote.isError && <ErrorNote error={quote.error} onRetry={runQuote} />}

              {quote.data && quote.data.options.length === 0 && (
                <div className="py-10 text-center">
                  <p className="text-[13px] font-bold mb-1">Nothing to sell yet</p>
                  <p className="text-[12px] text-dash-muted mb-4">
                    This property has no active room type and rate plan combination.
                  </p>
                  <Button size="sm" onClick={() => navigate('config')}>Open configuration</Button>
                </div>
              )}

              <div className="space-y-2">
                {quote.data?.options.map((o) => {
                  const isSelected = selected?.roomTypeId === o.roomTypeId && selected?.ratePlanId === o.ratePlanId;
                  const tooManyGuests = o.kind === 'room' && adults + children > o.maxOccupancy;
                  return (
                    <button
                      key={`${o.roomTypeId}-${o.ratePlanId}`}
                      onClick={() => o.sellable && setSelected(o)}
                      disabled={!o.sellable}
                      className={`w-full text-left p-4 rounded-2xl border transition-colors ${
                        isSelected ? 'border-black bg-dash-bg'
                          : o.sellable ? 'border-black/5 hover:bg-dash-bg' : 'border-black/5 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[14px] font-bold">{o.roomType}</p>
                            <Pill tone="grey">{o.ratePlanCode}</Pill>
                            {!o.refundable && <Pill tone="peach">Non-refundable</Pill>}
                            {o.kind === 'dorm' && <Pill tone="lilac">Per bed</Pill>}
                          </div>
                          <p className="text-[11px] text-dash-muted mt-1">{o.ratePlan}</p>
                          {o.inclusions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {o.inclusions.map((i) => <Pill key={i} tone="mint">{i}</Pill>)}
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-[11px]">
                            <span className={o.available > 0 ? 'text-status-ok font-semibold' : 'text-status-bad font-semibold'}>
                              {o.available > 0 ? `${o.available} available` : 'Sold out'}
                            </span>
                            {tooManyGuests && (
                              <span className="text-status-bad font-semibold">
                                Max {o.maxOccupancy} guests
                              </span>
                            )}
                          </div>
                          {o.violations.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {o.violations.map((v, i) => (
                                <p key={i} className="text-[11px] text-status-bad flex items-start gap-1.5">
                                  <Ban className="w-3 h-3 mt-0.5 shrink-0" />{v.message}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[18px] font-black tabular-nums">{money(o.averageNightlyMinor)}</p>
                          <p className="text-[10px] text-dash-muted">avg / night</p>
                          <p className="text-[12px] font-bold tabular-nums mt-2">{money(o.grandTotalMinor)}</p>
                          <p className="text-[10px] text-dash-muted">total incl. tax</p>
                          {isSelected && (
                            <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold">
                              <Check className="w-3 h-3" /> Selected
                            </div>
                          )}
                        </div>
                      </div>

                      {isSelected && o.nights.length > 0 && (
                        <div className="mt-3 pt-3 border-t subtle-divider">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-2">
                            Nightly breakdown
                          </p>
                          <div className="space-y-1">
                            {o.nights.map((n) => (
                              <div key={n.date} className="flex items-baseline justify-between gap-3 text-[11px]">
                                <span className="text-dash-muted">{longDate(n.date)}</span>
                                <span className="flex items-center gap-2">
                                  {n.appliedRules.length > 0 && (
                                    <span className="text-[10px] text-dash-muted">{n.appliedRules.join(' · ')}</span>
                                  )}
                                  <span className="tabular-nums font-bold">{money(n.rateMinor)}</span>
                                </span>
                              </div>
                            ))}
                            {o.taxes.map((t) => (
                              <div key={t.code} className="flex items-baseline justify-between gap-3 text-[11px]">
                                <span className="text-dash-muted">{t.name}</span>
                                <span className="tabular-nums">{money(t.amountMinor)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          {/* ── Step 2: guest ── */}
          {step === 2 && (
            <>
              <Card>
                <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-4">Guest</p>
                <div className="relative mb-4">
                  <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-dash-muted" />
                  <input
                    value={profileSearch}
                    onChange={(e) => setProfileSearch(e.target.value)}
                    placeholder="Search existing guests by name, email or phone…"
                    className="w-full bg-white border border-black/10 rounded-full pl-9 pr-4 py-2 text-[12px] outline-none focus:border-black/30"
                  />
                  {profileSearch.trim().length >= 2 && (profiles.data ?? []).length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 panel p-1.5 max-h-56 overflow-y-auto scroll-thin">
                      {profiles.data!.slice(0, 8).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setProfileId(p.id);
                            setGuestName(p.name);
                            setEmail(p.email ?? '');
                            setPhone(p.phone ?? '');
                            setVip(p.vip);
                            setProfileSearch('');
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-dash-bg text-left"
                        >
                          <User className="w-3.5 h-3.5 text-dash-muted" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-bold truncate">{p.name}</p>
                            <p className="text-[10px] text-dash-muted truncate">
                              {[p.email, p.phone].filter(Boolean).join(' · ')}
                              {p.stays ? ` · ${p.stays} stay(s)` : ''}
                            </p>
                          </div>
                          {p.blacklist && <Pill tone="red">Blacklisted</Pill>}
                          {p.vip && <Pill tone="yellow" solid>VIP</Pill>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Guest name" required>
                    <TextInput value={guestName} onChange={setGuestName} placeholder="Full name" />
                  </Field>
                  <Field label="Email">
                    <TextInput value={email} onChange={setEmail} type="email" />
                  </Field>
                  <Field label="Phone">
                    <TextInput value={phone} onChange={setPhone} />
                  </Field>
                  <Field label="ETA">
                    <TextInput value={eta} onChange={setEta} placeholder="e.g. 15:30" />
                  </Field>
                </div>
                {profileId && (
                  <p className="text-[11px] text-dash-muted mt-3">
                    Linked to an existing guest profile — this stay will join their history.
                  </p>
                )}
              </Card>

              <Card>
                <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-4">Booking details</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Status">
                    <Select value={status} onChange={setStatus} options={[
                      { label: 'Confirmed', value: 'Confirmed' },
                      { label: 'Guaranteed', value: 'Guaranteed' },
                      { label: 'Tentative (hold)', value: 'Tentative' },
                    ]} />
                  </Field>
                  <Field label="Source">
                    <Select value={source} onChange={setSource}
                      options={SOURCES.map((s) => ({ label: s, value: s }))} />
                  </Field>
                  <Field label="Market segment">
                    <Select value={segment} onChange={setSegment}
                      options={SEGMENTS.map((s) => ({ label: s, value: s }))} />
                  </Field>
                  <Field label="Company / travel agent">
                    <Select value={companyId} onChange={setCompanyId} options={[
                      { label: 'None', value: '' },
                      ...(companies.data ?? []).map((c) => ({ label: c.name, value: c.id })),
                    ]} />
                  </Field>
                  {(groups.data ?? []).length > 0 && (
                    <Field label="Group">
                      <Select value={groupId} onChange={setGroupId} options={[
                        { label: 'Not part of a group', value: '' },
                        ...(groups.data ?? []).map((g) => ({ label: `${g.name} (${g.code})`, value: g.id })),
                      ]} />
                    </Field>
                  )}
                  <Field label="Deposit required">
                    <MoneyInput valueMinor={depositMinor} onChange={setDepositMinor} />
                  </Field>
                </div>
                <div className="mt-4">
                  <Field label="Special requests">
                    <textarea
                      value={specialRequests}
                      onChange={(e) => setSpecialRequests(e.target.value)}
                      rows={3}
                      className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-black/40"
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap items-center gap-6 mt-4">
                  <Toggle checked={vip} onChange={setVip} label="VIP guest" />
                  {!isAmend && (
                    <Toggle checked={checkInNow} onChange={setCheckInNow}
                      label="Check in immediately (walk-in)" />
                  )}
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">Rate override</p>
                  <Toggle checked={overrideRate} onChange={setOverrideRate} />
                </div>
                {overrideRate ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    <Field label="Nightly rate" hint="Replaces the resolved rate for every night">
                      <MoneyInput valueMinor={overrideMinor} onChange={setOverrideMinor} />
                    </Field>
                    <Field label="Reason" required hint="Recorded in the audit trail">
                      <TextInput value={overrideReason} onChange={setOverrideReason}
                        placeholder="e.g. service recovery, negotiated rate" />
                    </Field>
                  </div>
                ) : (
                  <p className="text-[11px] text-dash-muted">
                    The rate resolved from your rate plan, occupancy pricing and yield rules will be used.
                  </p>
                )}
              </Card>
            </>
          )}

          {/* ── Step 3: confirm ── */}
          {step === 3 && selected && (
            <Card>
              <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-4">Review</p>
              <div className="grid md:grid-cols-2 gap-x-6 gap-y-3 mb-5">
                <Detail label="Guest" value={guestName || '—'} />
                <Detail label="Contact" value={[email, phone].filter(Boolean).join(' · ') || '—'} />
                <Detail label="Arrival" value={longDate(arrival)} />
                <Detail label="Departure" value={longDate(departure)} />
                <Detail label="Nights" value={String(nights)} />
                <Detail label="Occupancy" value={`${adults} adult${adults > 1 ? 's' : ''}${children ? `, ${children} child` : ''}`} />
                <Detail label="Room type" value={selected.roomType} />
                <Detail label="Rate plan" value={`${selected.ratePlan} (${selected.ratePlanCode})`} />
                <Detail label="Status" value={status} />
                <Detail label="Source" value={source} />
              </div>

              <div className="rounded-2xl bg-dash-bg p-4">
                <div className="space-y-1.5">
                  <Row label={`Room charge (${nights} night${nights > 1 ? 's' : ''})`}
                    value={money(overrideRate ? overrideMinor * nights : selected.roomTotalMinor)} />
                  {selected.taxes.map((t) => (
                    <Row key={t.code} label={t.name} value={money(t.amountMinor)} />
                  ))}
                  <div className="border-t subtle-divider pt-2 mt-2">
                    <Row
                      label="Total"
                      value={money(overrideRate
                        ? overrideMinor * nights + selected.taxTotalMinor
                        : selected.grandTotalMinor)}
                      strong
                    />
                  </div>
                  {depositMinor > 0 && <Row label="Deposit required" value={money(depositMinor)} />}
                </div>
              </div>

              {overrideRate && (
                <div className="mt-3 rounded-xl bg-dash-peach/50 p-3 flex items-start gap-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-status-warn mt-0.5 shrink-0" />
                  <p className="text-[11px]">
                    Rate overridden to {money(overrideMinor)} per night — {overrideReason || 'no reason given'}.
                    This is recorded against your user in the audit trail.
                  </p>
                </div>
              )}
              {checkInNow && (
                <div className="mt-3 rounded-xl bg-dash-mint/40 p-3 flex items-start gap-2.5">
                  <Sparkles className="w-3.5 h-3.5 text-status-ok mt-0.5 shrink-0" />
                  <p className="text-[11px]">
                    The guest will be checked in straight away and a room assigned automatically.
                  </p>
                </div>
              )}
            </Card>
          )}

          {error && <ErrorNote error={error} />}

          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
            {step < 3 ? (
              <Button
                disabled={(step === 0 && !canContinueFromDates) || (step === 1 && !canContinueFromRoom)}
                onClick={() => setStep((s) => s + 1)}
              >
                Continue
              </Button>
            ) : (
              <Button disabled={!canSubmit || busy} onClick={submit}>
                {busy ? 'Saving…' : isAmend ? 'Save changes' : checkInNow ? 'Create & check in' : 'Create reservation'}
              </Button>
            )}
          </div>
        </div>

        {/* Summary rail */}
        <div className="space-y-3">
          <Card tone="dark">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-3">Summary</p>
            <div className="space-y-2">
              <SummaryRow label="Dates" value={`${arrival} → ${departure}`} />
              <SummaryRow label="Nights" value={String(nights)} />
              <SummaryRow label="Guests" value={`${adults}A${children ? ` ${children}C` : ''}`} />
              <SummaryRow label="Room type" value={selected?.roomType ?? 'not chosen'} />
              <SummaryRow label="Rate plan" value={selected?.ratePlanCode ?? '—'} />
              <div className="border-t border-white/10 pt-2 mt-2">
                <SummaryRow
                  label="Total"
                  value={selected
                    ? money(overrideRate ? overrideMinor * nights + selected.taxTotalMinor : selected.grandTotalMinor)
                    : '—'}
                  strong
                />
              </div>
            </div>
          </Card>

          {quote.data && quote.data.availablePromotions.length > 0 && (
            <Card>
              <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
                Promotions available
              </p>
              <div className="space-y-2">
                {quote.data.availablePromotions.map((p) => (
                  <button
                    key={p.code}
                    onClick={() => setPromoCode(p.code)}
                    className="w-full text-left p-2.5 rounded-xl bg-dash-bg hover:bg-dash-grey"
                  >
                    <p className="text-[11px] font-bold">{p.name}</p>
                    <p className="text-[10px] text-dash-muted font-mono">{p.code}</p>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {isAmend && (
            <QueryState query={existing} loadingRows={2}>
              {(r) => (
                <Card>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
                    Current booking
                  </p>
                  <div className="space-y-1.5">
                    <Row label="Confirmation" value={r.confirmation} />
                    <Row label="Status" value={r.status} />
                    <Row label="Booked total" value={money(r.totalMinor)} />
                    <Row label="Folio balance" value={money(r.balanceMinor)} />
                  </div>
                  <p className="text-[10px] text-dash-muted mt-3 leading-relaxed">
                    Nights already posted by the night audit keep their original rate; only unposted
                    nights are re-priced.
                  </p>
                </Card>
              )}
            </QueryState>
          )}
        </div>
      </div>
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

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-dash-muted">{label}</span>
      <span className={`text-[12px] tabular-nums ${strong ? 'font-black' : 'font-bold'}`}>{value}</span>
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-white/50">{label}</span>
      <span className={`text-[12px] tabular-nums text-right ${strong ? 'font-black' : 'font-bold'}`}>{value}</span>
    </div>
  );
}
