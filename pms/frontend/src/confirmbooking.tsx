// ─────────────────────────────────────────────────────────────
// Confirming a booking the website took.
//
// This is not a check-in. It is the property agreeing to house the guest, and
// it is the moment the booking stops being a form somebody filled in and starts
// holding real inventory: a room, or one bed per guest for a dorm party.
//
// Until it happens the booking sits on the reservations list holding nothing,
// so the bed it wants can still be sold to somebody else. That is why the free
// list is re-read every time this opens rather than cached, and why confirming
// can legitimately fail — the honest answer when the bed has gone is to say so,
// not to double-book the room.
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { BedDouble, Check, Wand2 } from 'lucide-react';
import { useBookingConfirmation, useConfirmBooking } from './queries';
import { Button, Field, Modal, Pill, Select } from './ui';
import { ErrorNote, useToast } from './components';
import { money, shortDate } from './format';

export function ConfirmBookingModal({
  reservationId,
  open,
  onClose,
  onConfirmed,
}: {
  reservationId?: string;
  open: boolean;
  onClose: () => void;
  onConfirmed?: () => void;
}) {
  const toast = useToast();
  const query = useBookingConfirmation(reservationId, open);
  const confirm = useConfirmBooking();
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);

  const data = query.data;
  const isDorm = data?.roomTypeKind === 'dorm';
  const pending = useMemo(
    () => (data?.members ?? []).filter((m) => m.awaitingConfirmation),
    [data],
  );

  // A fresh dialog starts with nothing chosen. Without this, reopening it for a
  // different booking would show the last booking's beds as selected.
  useEffect(() => {
    if (open) { setPicks({}); setError(null); }
  }, [open, reservationId]);

  /**
   * What one part of the booking may be given.
   *
   * Read from that member's own room type, not the booking's first one. A party
   * can span room types — the website lets three guests take a double and a
   * dorm bed, and each is its own reservation in the group — and offering the
   * lead's rooms to all of them is how a bunk bed in a female dorm came to be
   * confirmed by picking a deluxe double.
   */
  const unitsFor = (m: (typeof pending)[number]) => (m.roomTypeKind === 'dorm'
    ? (m.beds ?? []).map((b) => ({ id: b.id, label: `${b.code} · ${b.room} · ${b.bunk}` }))
    : (m.rooms ?? []).map((r) => ({
      id: r.id, label: `Room ${r.number} · floor ${r.floor} · ${r.status}`,
    })));

  const taken = new Set(Object.values(picks).filter(Boolean));
  const chosen = pending.filter((m) => picks[m.id]).length;
  const enough = chosen === pending.length;
  /**
   * Short of somewhere to put people, counted per room type: two guests wanting
   * one dorm with one free bed is short even when the deluxe rooms are empty.
   */
  const shortOf = (() => {
    const need = new Map<string, { need: number; free: number; kind: string; name: string }>();
    for (const m of pending) {
      const row = need.get(m.roomTypeId) ?? {
        need: 0, free: unitsFor(m).length, kind: m.roomTypeKind, name: m.roomType,
      };
      row.need += 1;
      need.set(m.roomTypeId, row);
    }
    return [...need.values()].filter((r) => r.free < r.need);
  })();
  const shortOfUnits = shortOf.length > 0;

  async function submit(auto: boolean) {
    if (!reservationId) return;
    setError(null);
    try {
      const result = await confirm.mutateAsync({
        id: reservationId,
        auto,
        assignments: auto ? [] : pending.map((m) => ({
          reservationId: m.id,
          ...(m.roomTypeKind === 'dorm' ? { bedId: picks[m.id] } : { roomId: picks[m.id] }),
        })),
      });
      const n = result?.confirmed ?? pending.length;
      const allDorm = pending.every((m) => m.roomTypeKind === 'dorm');
      const allRooms = pending.every((m) => m.roomTypeKind !== 'dorm');
      const what = allDorm ? 'bed' : allRooms ? 'room' : 'room or bed';
      toast.success(
        `${data?.guest ?? 'Booking'} confirmed · ${n} ${what}${n === 1 ? '' : 's'}`,
      );
      onConfirmed?.();
      onClose();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirm booking"
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          <Button
            variant="ghost"
            icon={<Wand2 className="w-3.5 h-3.5" />}
            disabled={confirm.isPending || shortOfUnits || !pending.length}
            onClick={() => submit(true)}
          >
            Auto-assign {pending.length === 1 && pending[0].roomTypeKind !== 'dorm' ? 'room' : 'beds and rooms'}
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button
              icon={<Check className="w-3.5 h-3.5" />}
              disabled={!enough || confirm.isPending || !pending.length}
              onClick={() => submit(false)}
            >
              {confirm.isPending ? 'Confirming…' : 'Confirm booking'}
            </Button>
          </div>
        </div>
      }
    >
      {query.isLoading && <p className="text-[12px] text-dash-muted">Loading…</p>}
      {query.isError && <ErrorNote error={query.error} />}

      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[15px] font-bold">{data.guest}</span>
            <span className="text-[11px] font-mono text-dash-muted">{data.confirmation}</span>
            <Pill tone="yellow">{data.source}</Pill>
          </div>
          <p className="text-[12px] text-dash-muted">
            {shortDate(data.arrival)} → {shortDate(data.departure)} · {data.nights} night
            {data.nights === 1 ? '' : 's'} · {data.roomType}
          </p>

          {!pending.length && (
            <p className="text-[12px]">This booking has already been confirmed.</p>
          )}

          {!!pending.length && (
            <>
              <p className="text-[12px]">
                {pending.length === 1
                  ? `Pick the ${pending[0].roomTypeKind === 'dorm' ? 'bed' : 'room'} this guest will have.`
                  : `Pick somewhere for each of the ${pending.length} parts of this booking.`}{' '}
                Confirming takes them out of availability and closes the dates on the calendar.
              </p>

              {shortOfUnits && (
                <div className="rounded-xl border border-status-bad/40 bg-status-bad/5 p-3">
                  <p className="text-[12px] font-bold mb-0.5">
                    Not enough is free for this booking
                  </p>
                  {shortOf.map((r) => (
                    <p key={r.name} className="text-[11px] text-dash-muted">
                      {r.name}: needs {r.need} {r.kind === 'dorm' ? 'bed' : 'room'}
                      {r.need === 1 ? '' : 's'}, {r.free} free for the whole stay.
                    </p>
                  ))}
                  <p className="text-[11px] text-dash-muted mt-1">
                    A website booking holds nothing until it is confirmed, so these may have been
                    sold since the guest booked. Free something up, or cancel the booking and tell
                    the guest.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {pending.map((m, i) => {
                  const memberUnits = unitsFor(m);
                  const dorm = m.roomTypeKind === 'dorm';
                  return (
                    <Field
                      key={m.id}
                      // Named by the room type it is for, because on a mixed
                      // booking two pickers labelled "Room" is exactly how the
                      // wrong one gets chosen.
                      label={`${dorm ? 'Bed' : 'Room'} ${i + 1} of ${pending.length} · ${m.roomType}`}
                      hint={`${m.confirmation} · ${money(m.totalMinor)}`}
                    >
                      <Select
                        value={picks[m.id] ?? ''}
                        onChange={(v) => setPicks((p) => ({ ...p, [m.id]: v }))}
                        options={[
                          { label: dorm ? 'Choose a bed…' : 'Choose a room…', value: '' },
                          // A unit another guest in this party already has is
                          // left off, so the same bed cannot be handed out twice.
                          ...memberUnits
                            .filter((u) => !taken.has(u.id) || picks[m.id] === u.id)
                            .map((u) => ({ label: u.label, value: u.id })),
                        ]}
                      />
                    </Field>
                  );
                })}
              </div>

              <p className="flex items-center gap-1.5 text-[11px] text-dash-muted">
                <BedDouble className="w-3.5 h-3.5" />
                Check-in becomes available once this booking is confirmed.
              </p>
            </>
          )}

          {error != null && <ErrorNote error={error} />}
        </div>
      )}
    </Modal>
  );
}
