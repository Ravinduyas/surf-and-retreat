// Extending and shortening a stay.
//
// One modal serves both. The point of it is the preview: the operator sees the
// nights being added or dropped, what they cost, and whether the room survives
// — before anything is committed. Every refusal the server can give is rendered
// as a sentence, because "409 Conflict" is not something you can read out to a
// guest standing at the desk.
import { useState } from 'react';
import { CalendarPlus, CalendarMinus, DoorOpen, TriangleAlert, Info } from 'lucide-react';
import { useStayPreview, useChangeStayDates } from '../queries';
import { Button, Modal, Field, Select, TextInput, Pill } from '../ui';
import { DateInput, useToast, WarnNote, InfoNote, Loading } from '../components';
import { money, shortDate, addDays } from '../format';

export function StayDatesModal({
  open, onClose, reservation,
}: {
  open: boolean;
  onClose: () => void;
  reservation: {
    id: string; confirmation: string; guest: string;
    arrival: string; departure: string; room?: string; status: string;
  } | null;
}) {
  const toast = useToast();
  const change = useChangeStayDates();
  const [departure, setDeparture] = useState('');
  const [roomId, setRoomId] = useState('');
  const [reason, setReason] = useState('');

  // Reset when a different booking is opened, so a date typed for the last
  // guest never lands on this one.
  const [lastId, setLastId] = useState<string | null>(null);
  if (reservation && reservation.id !== lastId) {
    setLastId(reservation.id);
    setDeparture(reservation.departure);
    setRoomId('');
    setReason('');
  }

  const changed = !!reservation && departure !== reservation.departure;
  const preview = useStayPreview(
    open && reservation && changed ? reservation.id : null, undefined, departure || undefined);
  const p = preview.data;

  const needsRoomChoice = !!p && !p.roomKept && p.alternativeRooms.length > 0;
  const canCommit = !!p && p.ok && p.violations.length === 0 && changed
    && (!needsRoomChoice || !!roomId || roomId === 'release');

  async function commit() {
    if (!reservation || !p) return;
    try {
      const r: any = await change.mutateAsync({
        id: reservation.id,
        body: {
          departure,
          roomId: roomId && roomId !== 'release' ? roomId : undefined,
          releaseRoom: roomId === 'release',
          reason: reason || undefined,
        },
      });
      toast.success(
        r.kind === 'shorten' ? 'Stay shortened' : 'Stay extended',
        `${r.nights} night(s) to ${shortDate(r.departure)}`
        + (r.roomChanged ? ' · room changed' : '')
        + (r.deltaMinor ? ` · ${r.deltaMinor > 0 ? '+' : ''}${money(r.deltaMinor)}` : ''),
      );
      onClose();
    } catch (e: any) {
      // The server returns the offending rules; show them rather than a code.
      const violations = e?.details?.violations as Array<{ message: string }> | undefined;
      if (violations?.length) {
        toast.push({ kind: 'error', title: 'The new dates break a selling rule',
          body: violations.map((v) => v.message).join(' · ') });
      } else {
        toast.fail(e, 'Could not change the stay');
      }
    }
  }

  if (!reservation) return null;

  return (
    <Modal open={open} onClose={onClose}
      title={`Change stay · ${reservation.guest}`}
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-dash-muted">
            {reservation.confirmation} · currently {shortDate(reservation.arrival)} →{' '}
            {shortDate(reservation.departure)}
            {reservation.room && ` · room ${reservation.room}`}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button disabled={!canCommit || change.isPending} onClick={commit}>
              {change.isPending ? 'Saving…'
                : p?.kind === 'shorten' ? 'Shorten stay' : 'Extend stay'}
            </Button>
          </div>
        </div>
      }>
      <div className="space-y-4">
        {reservation.status === 'Checked-in' && (
          <InfoNote>
            This guest is in-house, so arrival is fixed. Change the departure to extend or
            shorten the stay.
          </InfoNote>
        )}

        <div className="flex items-end gap-2 flex-wrap">
          <Field label="New departure">
            <DateInput value={departure} onChange={setDeparture} min={addDays(reservation.arrival, 1)} />
          </Field>
          <div className="flex gap-1.5 pb-0.5">
            {[1, 2, 3, 7].map((n) => (
              <Button key={n} size="sm" variant="secondary"
                icon={<CalendarPlus className="w-3 h-3" />}
                onClick={() => setDeparture(addDays(reservation.departure, n))}>
                +{n}
              </Button>
            ))}
            <Button size="sm" variant="secondary"
              icon={<CalendarMinus className="w-3 h-3" />}
              onClick={() => setDeparture(addDays(reservation.departure, -1))}>
              −1
            </Button>
          </div>
        </div>

        {!changed && (
          <p className="text-[12px] text-dash-muted">
            Pick a new departure date to see what it costs.
          </p>
        )}

        {changed && preview.isPending && <Loading label="Checking availability and price…" rows={2} />}

        {changed && p && (
          <>
            {/* ── Why it cannot proceed ───────────────────────── */}
            {p.blockers.map((b, i) => <WarnNote key={i}>{b}</WarnNote>)}

            {p.violations.length > 0 && (
              <WarnNote>
                <span className="font-bold">These dates break a selling rule:</span>
                <ul className="mt-1 space-y-0.5">
                  {p.violations.map((v, i) => <li key={i}>· {v.message}</li>)}
                </ul>
              </WarnNote>
            )}

            {/* ── What changes ────────────────────────────────── */}
            {p.ok && (
              <div className="rounded-xl border subtle-divider p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Pill tone={p.kind === 'shorten' ? 'yellow' : 'mint'}>
                    {p.kind === 'shorten' ? 'Shortening' : p.kind === 'move' ? 'Moving' : 'Extending'}
                  </Pill>
                  <p className="text-[12px] font-bold">
                    {p.current.nights} → {p.proposed.nights} nights
                  </p>
                </div>

                {p.addedNights.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1">
                      Nights added
                    </p>
                    {p.addedNights.map((n) => (
                      <div key={n.date} className="flex justify-between text-[12px] py-0.5">
                        <span>{shortDate(n.date)}</span>
                        <span className="tabular-nums font-semibold">{money(n.rateMinor)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {p.removedNights.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1">
                      Nights removed
                    </p>
                    {p.removedNights.map((n) => (
                      <div key={n.date} className="flex justify-between text-[12px] py-0.5">
                        <span>{shortDate(n.date)} {n.posted && <Pill tone="red">posted</Pill>}</span>
                        <span className="tabular-nums text-dash-muted line-through">{money(n.rateMinor)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between border-t subtle-divider pt-2 text-[13px] font-black">
                  <span>{p.deltaMinor >= 0 ? 'Extra to pay' : 'Comes off the folio'}</span>
                  <span className="tabular-nums">
                    {p.deltaMinor >= 0 ? '' : '−'}{money(Math.abs(p.deltaMinor))}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-dash-muted">
                  <span>New stay total</span>
                  <span className="tabular-nums">{money(p.proposed.totalMinor)}</span>
                </div>

                {p.keptNights > 0 && p.addedNights.length > 0 && (
                  <p className="text-[10px] text-dash-muted flex items-start gap-1 pt-1">
                    <Info className="w-3 h-3 shrink-0 mt-px" />
                    The {p.keptNights} night(s) already booked keep the rate the guest was quoted.
                    Only the new night(s) are priced at today's rate.
                  </p>
                )}
              </div>
            )}

            {/* ── The room ────────────────────────────────────── */}
            {p.ok && !p.roomKept && (
              <div className="space-y-2">
                <WarnNote>
                  <span className="inline-flex items-center gap-1.5">
                    <TriangleAlert className="w-3.5 h-3.5" />
                    Room {p.roomNumber} is not free for the new dates.
                  </span>
                  {p.alternativeRooms.length === 0 && (
                    <> No other room of this type is free either — the guest would have no room
                    assigned until one is found.</>
                  )}
                </WarnNote>
                <Field label="Move the guest to">
                  <Select value={roomId} onChange={setRoomId} options={[
                    { label: 'Choose a room…', value: '' },
                    ...p.alternativeRooms.map((r) => ({
                      label: `Room ${r.number}${r.floor ? ` · floor ${r.floor}` : ''} · ${r.status}`,
                      value: r.id,
                    })),
                    { label: 'Continue with no room assigned', value: 'release' },
                  ]} />
                </Field>
                {roomId === 'release' && (
                  <p className="text-[11px] text-status-warn flex items-center gap-1.5">
                    <DoorOpen className="w-3.5 h-3.5" />
                    The guest will have no room number until one is assigned.
                  </p>
                )}
              </div>
            )}

            {p.ok && (
              <Field label="Reason (optional)">
                <TextInput value={reason} onChange={setReason} placeholder="Flight delayed, early departure…" />
              </Field>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
