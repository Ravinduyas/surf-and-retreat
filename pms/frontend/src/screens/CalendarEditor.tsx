// The one calendar bar: select dates, change anything.
//
// A revenue manager does not think in screens. They look at a grid, see that
// next weekend is filling, and want to raise the rate, close the cheap channel
// and set a two-night minimum — in one place, on the dates they are already
// looking at. Making them leave for a "bulk edit rates" modal, then a
// "restrictions" tab, then a close-out form, is three chances to type the wrong
// date range.
//
// So the selection made on the calendar drives every change. Four things can be
// done to a run of dates, and they are the four things properties actually do:
//
//   Price · Availability · Stay rules · Open or closed
//
// Price shows a preview before it commits, because a percentage applied to the
// wrong rows is discovered a week later in the folios.
import { useState, useEffect } from 'react';
import {
  Tag, PackageOpen, CalendarClock, Lock, LockOpen, X, TriangleAlert, Check,
} from 'lucide-react';
import {
  useRatePreview, useBulkRates, useAdjustInventory, useCreateRestriction,
  useCloseDates, useOpenDates, useChannels, useRoomTypes,
} from '../queries';
import { Card, Field, Select, TextInput } from '../ui';
import { useToast, PermissionButton, MoneyInput, NumberInput, DateInput, InfoNote, WarnNote } from '../components';
import { money, shortDate } from '../format';
import { CHANNEL_HUB } from '../branding';

export interface GridSelection {
  roomTypeId: string;
  roomTypeName: string;
  ratePlanId: string;
  ratePlanCode: string;
  from: string;
  to: string;
  /** True when every selected night is already closed. */
  allClosed: boolean;
  anyClosed: boolean;
  /** What the selected cells cost today, for the header line. */
  minPriceMinor: number;
  maxPriceMinor: number;
}

type Mode = 'price' | 'availability' | 'rules' | 'open';

const TABS: Array<{ mode: Mode; label: string; icon: typeof Tag }> = [
  { mode: 'price', label: 'Price', icon: Tag },
  { mode: 'availability', label: 'Availability', icon: PackageOpen },
  { mode: 'rules', label: 'Stay rules', icon: CalendarClock },
  { mode: 'open', label: 'Open / close', icon: Lock },
];

export function CalendarEditor({
  selection, onDone, onCancel,
}: {
  selection: GridSelection;
  onDone: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('price');

  // Applies the change to every room type rather than only the row that was
  // dragged. This is the common case — a property raises all rates for a
  // holiday, or shuts everything for a refurbishment — and doing it row by row
  // is where mistakes happen.
  const [allTypes, setAllTypes] = useState(false);

  /**
   * The dates being changed, which start as whatever was selected on the grid
   * and can then be typed.
   *
   * Dragging is a fine way to say "this weekend" and a poor way to say "all of
   * December": the grid shows a fortnight, so a longer run meant dragging to
   * the edge, waiting for it to scroll, and hoping. It also did not work at all
   * on a phone — the selection is built from `mousedown`/`mouseenter`/`mouseup`,
   * and a touch screen sends none of those. Two date fields make the range
   * sayable directly, and keep the drag for the cases where it is quicker.
   */
  const [range, setRange] = useState({ from: selection.from, to: selection.to });

  // A new selection on the grid replaces whatever was typed.
  useEffect(() => {
    setRange({ from: selection.from, to: selection.to });
  }, [selection.from, selection.to]);

  // Typing a start after the end is a half-finished thought, not an error worth
  // shouting about: the later date wins and the range stays valid either way.
  const from = range.from <= range.to ? range.from : range.to;
  const to = range.from <= range.to ? range.to : range.from;

  const nights = Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  ) + 1;

  /**
   * The "now costs X" line describes the cells that were selected on the grid.
   * Once the dates have been typed past them it is describing something else,
   * so it stops claiming to.
   */
  const priceKnown = from === selection.from && to === selection.to;

  const scope = {
    from,
    to,
    roomTypeIds: allTypes ? undefined : [selection.roomTypeId],
    ratePlanIds: allTypes ? undefined : [selection.ratePlanId],
  };

  return (
    <div className="sticky bottom-3 z-20 mt-3">
      <Card className="shadow-lg border border-black/10">
        {/* ── What is selected ───────────────────────────────── */}
        <div className="flex items-start gap-3 flex-wrap pb-3 mb-3 border-b subtle-divider">
          <div className="flex items-end gap-2">
            <div className="w-[9.5rem]">
              <Field label="From">
                <DateInput value={range.from} onChange={(v) => v && setRange((r) => ({ ...r, from: v }))} />
              </Field>
            </div>
            <div className="w-[9.5rem]">
              <Field label="To">
                <DateInput value={range.to} min={range.from} onChange={(v) => v && setRange((r) => ({ ...r, to: v }))} />
              </Field>
            </div>
          </div>

          <div className="pt-4">
            <p className="text-[13px] font-black leading-tight">
              {nights} night{nights === 1 ? '' : 's'}
            </p>
            <p className="text-[10px] text-dash-muted">
              {allTypes
                ? 'Every room type and rate plan'
                : `${selection.roomTypeName} · ${selection.ratePlanCode}`}
              {priceKnown && <>
                {' · now '}
                {selection.minPriceMinor === selection.maxPriceMinor
                  ? money(selection.minPriceMinor)
                  : `${money(selection.minPriceMinor)}–${money(selection.maxPriceMinor)}`}
              </>}
            </p>
          </div>

          <label className="flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer">
            <input type="checkbox" checked={allTypes} onChange={(e) => setAllTypes(e.target.checked)}
              className="accent-black" />
            Apply to all room types
          </label>

          <button onClick={onCancel} className="ml-auto text-dash-muted hover:text-dash-text"
            title="Clear the selection">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── What to change ─────────────────────────────────── */}
        <div className="flex items-center gap-1 mb-3 flex-wrap">
          {TABS.map((t) => (
            <button key={t.mode} onClick={() => setMode(t.mode)}
              className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-colors ${
                mode === t.mode ? 'bg-dash-text text-white' : 'hover:bg-dash-bg'}`}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {mode === 'price' && (
          <PriceEditor
            scope={scope} onDone={onDone} toast={toast}
            roomTypeId={allTypes ? null : selection.roomTypeId}
            // What the selected nights cost today. The new-price box opens on
            // it rather than on nothing, so the figure the per-guest prices are
            // measured against is on screen from the start and a change that
            // only moves the per-guest prices does not have to retype the rate.
            currentPriceMinor={selection.minPriceMinor}
            priceVaries={priceKnown && selection.minPriceMinor !== selection.maxPriceMinor} />
        )}
        {mode === 'availability' && (
          <AvailabilityEditor
            from={from} to={to}
            roomTypeId={allTypes ? null : selection.roomTypeId}
            onDone={onDone} toast={toast} />
        )}
        {mode === 'rules' && (
          <RulesEditor
            from={from} to={to}
            roomTypeId={allTypes ? null : selection.roomTypeId}
            ratePlanId={allTypes ? null : selection.ratePlanId}
            onDone={onDone} toast={toast} />
        )}
        {mode === 'open' && (
          <OpenCloseEditor
            selection={selection} from={from} to={to} rangeChanged={!priceKnown}
            allTypes={allTypes} onDone={onDone} toast={toast} />
        )}
      </Card>
    </div>
  );
}

// ─── Price ───────────────────────────────────────────────────

function PriceEditor({ scope, roomTypeId, currentPriceMinor, priceVaries, onDone, toast }: {
  scope: Record<string, unknown>; roomTypeId: string | null;
  /** What the selected nights cost now — where the new-price box starts. */
  currentPriceMinor: number;
  /** True when the selected nights do not all cost the same. */
  priceVaries: boolean;
  onDone: () => void; toast: ReturnType<typeof useToast>;
}) {
  const [how, setHow] = useState<'set' | 'percent' | 'amount'>('set');
  const [priceMinor, setPriceMinor] = useState(currentPriceMinor);

  // A new selection on the grid is a different rate, so the box follows it.
  // Typing in the box after that is the operator's own figure and is left
  // alone until the selection moves again.
  useEffect(() => { setPriceMinor(currentPriceMinor); }, [currentPriceMinor]);
  const [percent, setPercent] = useState(0);
  const [amountMinor, setAmountMinor] = useState(0);
  const [days, setDays] = useState<string[]>([]);
  const apply = useBulkRates();

  // ── Price by number of guests ──────────────────────────────
  //
  // A four-person suite is not one price. The database has carried
  // `occupancy_prices` since the beginning and `quoteStay` already reads it, so
  // a direct booking for two in a family room has always been able to cost less
  // than a booking for four — there was simply no way to enter the numbers.
  //
  // It also matters off-property. What Helio sends the channel is a single
  // figure, and the channel decides how many guests that figure covers; get
  // those two out of step and a suite priced at 74 is advertised at 148. Prices
  // stated per occupancy leave far less for anything downstream to infer.
  const roomTypes = useRoomTypes();
  const roomType = roomTypeId
    ? (roomTypes.data ?? []).find((r) => r.id === roomTypeId)
    : undefined;
  // Only worth offering where occupancy can actually vary. A dorm bed is sold
  // per person by definition, and every one here has maxOccupancy 1.
  const occupancies = roomType && roomType.kind === 'room' && roomType.maxOccupancy > 1
    ? Array.from({ length: roomType.maxOccupancy }, (_, i) => i + 1)
    : [];
  const [byGuests, setByGuests] = useState(false);
  const [guestPrices, setGuestPrices] = useState<Record<number, number>>({});

  /**
   * Which end of the scale the price above is.
   *
   * A per-occupancy table has to be anchored, or the room has a rate that
   * belongs to nobody. Properties anchor it one of two ways, so the form asks
   * which: `first` — the price is what one guest pays and a fuller room pays
   * more, the boxes above one guest being the operator's to set; or `last` —
   * the price is what a full room pays, and every smaller party pays it too,
   * which is a room sold at one price whatever the occupancy. One of the two
   * is always chosen, so the price on screen is always in the table.
   */
  const [basis, setBasis] = useState<'first' | 'last'>('first');
  const lastOccupancy = occupancies.length ? occupancies[occupancies.length - 1] : 0;

  // Per-guest prices are read off the price above, so they need a price rather
  // than a movement: a percentage says nothing about what two guests pay.
  useEffect(() => { if (how !== 'set') setByGuests(false); }, [how]);

  /**
   * What each occupancy box shows. The anchored end is the price above itself,
   * and under `last` the smaller parties are not priced separately at all —
   * they fall through to that same price, which is what the table means by an
   * occupancy it does not name.
   */
  const guestPriceFor = (n: number) => (basis === 'first'
    ? (n === 1 ? priceMinor : guestPrices[n] ?? 0)
    : (n === lastOccupancy ? priceMinor : 0));
  /** Only the boxes the operator owns can be typed in. */
  const guestPriceEditable = (n: number) => basis === 'first' && n !== 1;

  const occupancyPrices = byGuests
    ? Object.fromEntries(
      occupancies
        .filter((n) => guestPriceFor(n) > 0)
        .map((n) => [String(n), guestPriceFor(n)]),
    )
    : undefined;

  const change =
    how === 'set' ? (priceMinor > 0 ? { priceMinor } : null)
      : how === 'percent' ? (percent !== 0 ? { adjustPercentBp: Math.round(percent * 100) } : null)
        : (amountMinor !== 0 ? { adjustMinor: amountMinor } : null);

  const body = change
    ? {
      ...scope, ...change,
      ...(days.length ? { daysOfWeek: days } : {}),
      ...(occupancyPrices && Object.keys(occupancyPrices).length ? { occupancyPrices } : {}),
    }
    : null;

  // Previewed as the operator types. The same code plans and applies, so what
  // this says cannot disagree with what happens.
  const preview = useRatePreview(body);

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2 flex-wrap">
        <div className="w-full sm:w-[150px]">
          <Field label="Change">
            <Select value={how} onChange={(v) => setHow(v as any)} options={[
              { label: 'Set price to', value: 'set' },
              { label: 'Adjust by %', value: 'percent' },
              { label: 'Adjust by amount', value: 'amount' },
            ]} />
          </Field>
        </div>
        <div className="w-full sm:w-[140px]">
          {how === 'set' && (
            <Field label="New price"><MoneyInput valueMinor={priceMinor} onChange={setPriceMinor} /></Field>
          )}
          {how === 'percent' && (
            <Field label="Percent"><NumberInput value={percent} onChange={setPercent} min={-99} max={500} /></Field>
          )}
          {how === 'amount' && (
            <Field label="Amount"><MoneyInput valueMinor={amountMinor} onChange={setAmountMinor} /></Field>
          )}
        </div>
        <DayPicker value={days} onChange={setDays} />
      </div>

      {/* ── Price by number of guests ─────────────────────────── */}
      {occupancies.length > 0 && how === 'set' && (
        <div className="rounded-xl bg-dash-bg p-3 space-y-2.5">
          <label className="flex items-center gap-2 text-[11px] font-bold cursor-pointer">
            <input type="checkbox" checked={byGuests} className="accent-black"
              onChange={(e) => setByGuests(e.target.checked)} />
            Charge a different price by number of guests
            <span className="text-dash-muted font-semibold">
              · {roomType?.name} sleeps {roomType?.maxOccupancy}
            </span>
          </label>

          {byGuests && (
            <>
              <div className="flex items-start gap-2 flex-wrap">
                {occupancies.map((n) => {
                  const anchor = n === 1 ? 'first' : n === lastOccupancy ? 'last' : null;
                  const anchored = anchor !== null && basis === anchor;
                  return (
                    <div key={n} className="w-[7.5rem] space-y-1">
                      <Field label={n === 1 ? '1 guest' : `${n} guests`}>
                        <MoneyInput
                          valueMinor={guestPriceFor(n)}
                          disabled={!guestPriceEditable(n)}
                          onChange={(v) => setGuestPrices((p) => ({ ...p, [n]: v }))} />
                      </Field>
                      {/* The anchor sits under the box it fills, because that
                          is the box it is a statement about. */}
                      {anchor && (
                        <button type="button" onClick={() => setBasis(anchor)}
                          className={`w-full inline-flex items-center justify-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-colors ${
                            anchored ? 'bg-dash-text text-white' : 'bg-white hover:bg-black/5 text-dash-muted'}`}>
                          {anchored && <Check className="w-3 h-3" />}
                          Base price here
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-dash-muted leading-relaxed max-w-2xl">
                {basis === 'first'
                  ? `${money(priceMinor)} is what one guest pays; type what a larger party pays.`
                  : `${money(priceMinor)} is what ${lastOccupancy} guests pay, and a smaller party pays it too — one price whatever the occupancy.`}
                {' '}
                Leave a box at zero to charge the price above for that occupancy. These
                figures are what a direct booking is quoted; the channel is sent the single
                price above, so check that the rate on {CHANNEL_HUB} is defined as covering
                the whole room — a rate set to cover fewer guests than the room sleeps is
                charged more than once.
              </p>
            </>
          )}
        </div>
      )}

      {preview.data && (
        <PreviewLine plan={preview.data} savesGuestPrices={!!occupancyPrices} />
      )}

      <div className="flex justify-end">
        <PermissionButton permission="rates.write" disabled={!body || apply.isPending}
          onClick={async () => {
            if (!body) return;
            try {
              const r: any = await apply.mutateAsync(body);
              toast.success('Prices updated', `${r.written} night(s) changed`);
              onDone();
            } catch (e) { toast.fail(e, 'Could not change those prices'); }
          }}>
          {apply.isPending ? 'Applying…' : 'Apply price'}
        </PermissionButton>
      </div>
    </div>
  );
}

/** What the change will do, before it does it. */
function PreviewLine({ plan, savesGuestPrices }: { plan: any; savesGuestPrices?: boolean }) {
  if (!plan.changedCount) {
    // Leaving the nightly rate where it is and pricing the occupancies under it
    // is a real edit, and the commonest one now that the box opens on the
    // current price — so it must not read as "nothing happens".
    return (
      <InfoNote>
        {savesGuestPrices
          ? 'The nightly price stays as it is — the per-guest prices are saved on these nights.'
          : 'Nothing would change — those cells already hold this price.'}
      </InfoNote>
    );
  }
  return (
    <div className="rounded-xl bg-dash-bg p-3 space-y-1.5">
      <p className="text-[12px] font-bold">
        {plan.changedCount} of {plan.cellCount} night{plan.cellCount === 1 ? '' : 's'} would change
        <span className="text-dash-muted font-semibold">
          {' · '}{money(plan.averageFromMinor)} → {money(plan.averageToMinor)} on average
        </span>
      </p>
      {plan.biggestMovers?.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {plan.biggestMovers.slice(0, 5).map((c: any, i: number) => (
            <span key={i} className="text-[10px] bg-white rounded-lg px-2 py-1 tabular-nums">
              {shortDate(c.date)} {money(c.fromMinor)}→{money(c.toMinor)}
            </span>
          ))}
        </div>
      )}
      {plan.warnings?.map((w: string, i: number) => (
        <p key={i} className="text-[10px] text-status-warn flex items-start gap-1">
          <TriangleAlert className="w-3 h-3 shrink-0 mt-px" />{w}
        </p>
      ))}
    </div>
  );
}

// ─── Availability ────────────────────────────────────────────

function AvailabilityEditor({ from, to, roomTypeId, onDone, toast }: {
  from: string; to: string; roomTypeId: string | null;
  onDone: () => void; toast: ReturnType<typeof useToast>;
}) {
  const [hold, setHold] = useState(0);
  const [overbook, setOverbook] = useState(0);
  const adjust = useAdjustInventory();

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="w-full sm:w-[130px]">
          <Field label="Hold back">
            <NumberInput value={hold} onChange={setHold} min={0} max={99} />
          </Field>
        </div>
        <div className="w-full sm:w-[150px]">
          <Field label="Allow overbooking by">
            <NumberInput value={overbook} onChange={setOverbook} min={0} max={20} />
          </Field>
        </div>
      </div>

      <p className="text-[10px] text-dash-muted leading-relaxed max-w-2xl">
        A <span className="font-semibold">hold</span> takes rooms out of sale without closing the
        dates — for a group still deciding, or a room you want to keep back.
        An <span className="font-semibold">overbooking allowance</span> deliberately sells past
        capacity on the expectation of no-shows; it is the one setting here that can create the
        problem the overbooking desk exists to solve, so it starts at zero.
      </p>

      <div className="flex justify-end">
        <PermissionButton permission="rates.write" disabled={adjust.isPending || !roomTypeId}
          onClick={async () => {
            try {
              await adjust.mutateAsync({ from, to, roomTypeId, hold, overbook });
              toast.success('Inventory adjusted');
              onDone();
            } catch (e) { toast.fail(e, 'Could not adjust inventory'); }
          }}>
          {adjust.isPending ? 'Applying…' : 'Apply'}
        </PermissionButton>
      </div>
      {!roomTypeId && (
        <p className="text-[10px] text-status-warn text-right">
          Inventory is held per room type — clear "all room types" to set it.
        </p>
      )}
    </div>
  );
}

// ─── Stay rules ──────────────────────────────────────────────

function RulesEditor({ from, to, roomTypeId, ratePlanId, onDone, toast }: {
  from: string; to: string; roomTypeId: string | null; ratePlanId: string | null;
  onDone: () => void; toast: ReturnType<typeof useToast>;
}) {
  const [type, setType] = useState('min-stay');
  const [value, setValue] = useState(2);
  const create = useCreateRestriction();

  const needsValue = ['min-stay', 'max-stay', 'min-stay-through', 'min-advance', 'max-advance'];

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2 flex-wrap">
        <div className="w-full sm:w-[190px]">
          <Field label="Rule">
            <Select value={type} onChange={setType} options={[
              { label: 'Minimum stay', value: 'min-stay' },
              { label: 'Maximum stay', value: 'max-stay' },
              { label: 'Minimum stay through', value: 'min-stay-through' },
              { label: 'Closed to arrival', value: 'cta' },
              { label: 'Closed to departure', value: 'ctd' },
              { label: 'Book at least N days ahead', value: 'min-advance' },
              { label: 'Book at most N days ahead', value: 'max-advance' },
            ]} />
          </Field>
        </div>
        {needsValue.includes(type) && (
          <div className="w-[110px]">
            <Field label={type.includes('advance') ? 'Days' : 'Nights'}>
              <NumberInput value={value} onChange={setValue} min={1} max={99} />
            </Field>
          </div>
        )}
      </div>

      <p className="text-[10px] text-dash-muted max-w-2xl">
        {type === 'cta' && 'Guests may stay through these dates but cannot start a stay on them.'}
        {type === 'ctd' && 'Guests may stay through these dates but cannot check out on them.'}
        {type === 'min-stay' && 'A stay starting on these dates must be at least this many nights.'}
        {type === 'min-stay-through' && 'Any stay covering these dates must be this long — stricter than a minimum stay, and the right rule for a peak weekend.'}
        {type === 'max-stay' && 'A stay starting on these dates may be at most this many nights.'}
        {type.includes('advance') && 'Applies to when the booking is made, relative to arrival.'}
      </p>

      <div className="flex justify-end">
        <PermissionButton permission="rates.write" disabled={create.isPending}
          onClick={async () => {
            try {
              await create.mutateAsync({
                type, dateFrom: from, dateTo: to, roomTypeId, ratePlanId,
                value: needsValue.includes(type) ? value : undefined,
              });
              toast.success('Rule added');
              onDone();
            } catch (e) { toast.fail(e, 'Could not add that rule'); }
          }}>
          {create.isPending ? 'Adding…' : 'Add rule'}
        </PermissionButton>
      </div>
    </div>
  );
}

// ─── Open / close ────────────────────────────────────────────

function OpenCloseEditor({ selection, from, to, rangeChanged, allTypes, onDone, toast }: {
  selection: GridSelection; from: string; to: string; rangeChanged: boolean; allTypes: boolean;
  onDone: () => void; toast: ReturnType<typeof useToast>;
}) {
  const close = useCloseDates();
  const open = useOpenDates();
  const channels = useChannels();
  const [reason, setReason] = useState('');
  const [channelCode, setChannelCode] = useState('');
  const [blocked, setBlocked] = useState<Array<{ from: string; to: string; reason: string | null }>>([]);

  // `anyClosed` was worked out from the cells the grid had selected. Once the
  // dates have been typed beyond those, it no longer describes what is on
  // screen — so Reopen is offered unconditionally rather than hidden on a stale
  // answer. Reopening dates that were already open is harmless; not being able
  // to reopen the ones you just typed is not.
  const canReopen = rangeChanged || selection.anyClosed;

  const scope = {
    roomTypeId: allTypes ? null : selection.roomTypeId,
    ratePlanId: allTypes ? null : selection.ratePlanId,
    channelCode: channelCode || null,
    from,
    to,
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2 flex-wrap">
        <div className="w-full sm:w-[170px]">
          <Field label="On">
            <Select value={channelCode} onChange={setChannelCode} options={[
              { label: 'All channels', value: '' },
              ...(channels.data ?? []).filter((c: any) => c.code)
                .map((c: any) => ({ label: `${c.name} only`, value: c.code })),
            ]} />
          </Field>
        </div>
        <div className="flex-1 min-w-[180px]">
          <Field label="Reason (optional)">
            <TextInput value={reason} onChange={setReason} placeholder="Refurbishment, private event…" />
          </Field>
        </div>
        <div className="flex gap-2 pb-0.5">
          {canReopen && (
            <PermissionButton permission="rates.write" variant="secondary"
              icon={<LockOpen className="w-3.5 h-3.5" />} disabled={open.isPending}
              onClick={async () => {
                try {
                  const r: any = await open.mutateAsync(scope);
                  if (r.stillClosedBy?.length) { setBlocked(r.stillClosedBy); return; }
                  toast.success('Dates reopened');
                  onDone();
                } catch (e) { toast.fail(e); }
              }}>
              Open
            </PermissionButton>
          )}
          {!selection.allClosed && (
            <PermissionButton permission="rates.write"
              icon={<Lock className="w-3.5 h-3.5" />} disabled={close.isPending}
              onClick={async () => {
                try {
                  const r: any = await close.mutateAsync({ ...scope, reason: reason || undefined });
                  toast.success(r.extended ? 'Closure extended' : 'Dates closed',
                    `${shortDate(r.from)} → ${shortDate(r.to)} is off sale`);
                  onDone();
                } catch (e) { toast.fail(e); }
              }}>
              Close
            </PermissionButton>
          )}
        </div>
      </div>

      {blocked.length > 0 && (
        <WarnNote>
          Nothing was changed. These dates are held by a wider closure than what you selected —
          {blocked.map((b) => ` ${shortDate(b.from)}–${shortDate(b.to)}${b.reason ? ` (${b.reason})` : ''}`)}.
          Reopen it from the Close-outs tab, or narrow it first.
        </WarnNote>
      )}

      <p className="text-[10px] text-dash-muted flex items-center gap-1.5">
        <Check className="w-3 h-3" />
        Closing is pushed to every connected channel automatically; direct bookings stop at once.
      </p>
    </div>
  );
}

// ─── Day-of-week filter ──────────────────────────────────────

const DAYS = [
  ['mon', 'M'], ['tue', 'T'], ['wed', 'W'], ['thu', 'T'],
  ['fri', 'F'], ['sat', 'S'], ['sun', 'S'],
] as const;

/** "Weekends only" is the single most common qualifier on a rate change. */
function DayPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1.5">
        Only these days
      </p>
      <div className="flex gap-1">
        {DAYS.map(([code, letter]) => {
          const on = value.includes(code);
          return (
            <button key={code}
              title={code}
              onClick={() => onChange(on ? value.filter((d) => d !== code) : [...value, code])}
              className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-colors ${
                on ? 'bg-dash-text text-white' : 'bg-dash-bg hover:bg-black/10'}`}>
              {letter}
              <span className="sr-only">{code}</span>
            </button>
          );
        })}
        {value.length > 0 && (
          <button onClick={() => onChange([])}
            className="text-[10px] text-dash-muted underline ml-1">all</button>
        )}
      </div>
    </div>
  );
}
