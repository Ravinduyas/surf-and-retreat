import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Percent, Ban, Zap, Tag, Save, Clock } from 'lucide-react';
import {
  useRateCalendar, useRoomTypes, useRatePlans, useBulkRates, useRestrictions,
  useCreateRestriction, useDeleteRestriction, useYieldRules, useCreateYieldRule, useUpdateYieldRule,
  useDeleteYieldRule, usePromotions, useCreatePromotion, useUpdatePromotion, useAdjustInventory,
  useCreateRatePlan, useEnsurePackagePlans,
} from '../queries';
import {
  BOOKING_MODELS, BOOKING_MODEL_LABELS, PACKAGE_MODELS, type BookingModel, type RatePlan,
} from '../types';
import { CloseoutsTab, useCloseoutCount } from './Closeouts';
import { CalendarEditor, type GridSelection } from './CalendarEditor';
import { RateChangePreview, PlanningTab, ScheduleModal } from './PricePlanning';
import { useAuthStore } from '../stores';
import { Card, Pill, Button, SectionHeader, Tabs, Field, Select, TextInput, Modal } from '../ui';
import { ChannelPublishNote } from '../ChannelPublishNote';
import {
  QueryState, useToast, MoneyInput, NumberInput, DateInput, PermissionButton, Toggle, ConfirmDialog,
} from '../components';
import {
  money, moneyShort, pct, addDays, dayName, dayNumber, isWeekend, longDate,
  monthName, nightsBetween, percentToBp, bpToPercent,
} from '../format';

const DOW = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/**
 * The rows the rate calendar shows.
 *
 * A package plan prices a website package — bed, desk and lessons together —
 * rather than the room, so it doubles every room type in a grid that is read to
 * answer "what does this room cost tonight". They are hidden here, not removed:
 * the plans, their rates and everything downstream of them are untouched, and
 * picking one in the rate-plan filter above brings its row straight back. A
 * property whose only plans are packages keeps them on screen — an empty grid
 * would be a worse answer than the one it has.
 */
const shownRows = <T extends { ratePlanId: string; bookingModel?: string | null }>(
  rows: T[], pickedRatePlanId: string,
): T[] => {
  const rooms = rows.filter((r) => !r.bookingModel);
  if (!rooms.length) return rows;
  return rows.filter((r) => !r.bookingModel || r.ratePlanId === pickedRatePlanId);
};

/** One calendar row is one room type × rate plan — the scope of a closure. */
const rowKey = (row: { roomTypeId: string; ratePlanId: string }) =>
  `${row.roomTypeId}-${row.ratePlanId}`;
const selKey = (s: GridSelection) => `${s.roomTypeId}-${s.ratePlanId}`;

/**
 * Consecutive dates grouped by the month they fall in, so the header can put a
 * name above each run. Returns the first date of each run and how many days it
 * covers, which is all the band needs to size itself.
 */
function monthSpans(dates: string[]): Array<{ start: string; count: number }> {
  const out: Array<{ start: string; count: number }> = [];
  for (const d of dates) {
    const last = out[out.length - 1];
    if (last && last.start.slice(0, 7) === d.slice(0, 7)) last.count += 1;
    else out.push({ start: d, count: 1 });
  }
  return out;
}

/** "Nov" on its own, "Nov 2027" when the year is not the current one. */
function monthLabel(date: string): string {
  const thisYear = new Date().getFullYear();
  const year = Number(date.slice(0, 4));
  return year === thisYear ? monthName(date) : `${monthName(date)} ${year}`;
}

export function RatesInventoryScreen() {
  const toast = useToast();
  const property = useAuthStore((s) => s.property);
  const today = property?.businessDate ?? new Date().toISOString().slice(0, 10);

  const [tab, setTab] = useState<
    'calendar' | 'closeouts' | 'planning' | 'plans' | 'restrictions' | 'yield' | 'promotions'
  >('calendar');
  /**
   * The window the grid shows, held as two dates rather than a start and a
   * length.
   *
   * A fixed set of window sizes is the wrong shape for the job. Rates are set
   * against a season, a school holiday, a festival — periods with their own
   * start and end that rarely fall on a 7, 14 or 30 day boundary from today.
   * The old control could not express "1 December to 6 January" at all, and its
   * longest option was a month, which meant a property pricing next summer
   * paged through it a fortnight at a time.
   *
   * The API has always accepted up to 400 days; the ceiling was only ever in
   * this screen.
   */
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(addDays(today, 13));
  const [roomTypeId, setRoomTypeId] = useState('');
  const [ratePlanId, setRatePlanId] = useState('');

  // Inclusive nights on screen; `to` is the exclusive end the API wants.
  const days = Math.max(1, nightsBetween(start, end) + 1);
  const to = addDays(end, 1);

  /** Move the window by its own length, so paging never overlaps or skips. */
  const shift = (direction: -1 | 1) => {
    setStart(addDays(start, direction * days));
    setEnd(addDays(end, direction * days));
  };

  const setSpan = (n: number) => { setEnd(addDays(start, n - 1)); };

  const jumpTo = (from: string, until: string) => { setStart(from); setEnd(until); };

  const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
  const monthEnd = (iso: string) => {
    const [y, m] = iso.split('-').map(Number);
    return addDays(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`, -1);
  };
  const roomTypes = useRoomTypes();
  const ratePlans = useRatePlans();
  const calendar = useRateCalendar(start, to, roomTypeId || undefined, ratePlanId || undefined);
  const restrictions = useRestrictions();
  const yieldRules = useYieldRules();
  const promotions = usePromotions();

  /**
   * Where the grid is scrolled to, which is a separate question from which
   * dates it holds — and the one that made "Today" look broken.
   *
   * With a 180-day window starting today, scrolled out to February, pressing
   * Today set the range to today…+179 — exactly what it already was. No state
   * changed, so nothing re-rendered, so the grid stayed in February and the
   * button appeared to do nothing at all.
   */
  const scroller = useRef<HTMLDivElement | null>(null);
  const CELL_W = 78;

  /** Put a date's column just right of the pinned labels. */
  const scrollToDate = (date: string, smooth = true) => {
    const el = scroller.current;
    if (!el) return;
    const index = Math.max(0, nightsBetween(start, date));
    el.scrollTo({ left: index * CELL_W, behavior: smooth ? 'smooth' : 'auto' });
  };

  /**
   * A new window lands on today when today is inside it, and on its first day
   * when it is not. "This month" on the 19th should open on the 19th, not on
   * three weeks of the past.
   *
   * This has to wait for the data, not just the dates. Changing the window
   * changes the query key, which puts the screen into its loading state, which
   * unmounts the grid — so a scroll issued when the dates changed is applied to
   * an element that is about to be replaced, and the replacement arrives at
   * zero. Positioning once the rows are actually rendered is the only version
   * that holds.
   *
   * `landedFor` keys on the window the *data* describes, so a refetch of the
   * same window — every fifteen seconds, and on every window focus — leaves the
   * operator's scroll position alone.
   */
  const landedFor = useRef('');
  useEffect(() => {
    const el = scroller.current;
    const data = calendar.data;
    if (!el || !data) return;
    const window_ = `${data.from}|${data.to}`;
    if (landedFor.current === window_) return;
    landedFor.current = window_;
    const left = today >= start && today <= end
      ? Math.max(0, nightsBetween(start, today)) * CELL_W
      : 0;
    el.scrollTo({ left, behavior: 'auto' });
  }, [calendar.data, start, end, today]);

  const goToToday = () => {
    jumpTo(today, addDays(today, days - 1));
    // Explicitly, rather than leaving it to the effect above: when the window
    // already starts today the state does not change and the effect never
    // runs. This is the case that was reported.
    requestAnimationFrame(() => scrollToDate(today));
  };


  const bulkRates = useBulkRates();
  const adjustInventory = useAdjustInventory();
  const createRestriction = useCreateRestriction();
  const deleteRestriction = useDeleteRestriction();
  const createYield = useCreateYieldRule();
  const updateYield = useUpdateYieldRule();
  const deleteYield = useDeleteYieldRule();
  const createPromo = useCreatePromotion();
  const updatePromo = useUpdatePromotion();
  const createRatePlan = useCreateRatePlan();
  const ensurePackages = useEnsurePackagePlans();

  /**
   * Which booking-engine packages have no rate plan behind them.
   *
   * Until one exists, the site prices that package by adding the room rate to
   * the extras table — a figure the property never set and cannot move on its
   * own. The Rate plans tab offers to create the missing ones.
   */
  const missingPackages = PACKAGE_MODELS.filter(
    (m) => !(ratePlans.data ?? []).some((p: RatePlan) => p.bookingModel === m && p.active),
  );

  const [bulkOpen, setBulkOpen] = useState(false);
  const [restrictionOpen, setRestrictionOpen] = useState(false);
  const [yieldOpen, setYieldOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [deleteRestrictionId, setDeleteRestrictionId] = useState<string | null>(null);

  // ─── Selecting dates on the calendar to close or open ──────
  // A closure is scoped by the row it is drawn on, so the selection carries the
  // row's room type and rate plan along with the dates. Dragging within a row
  // extends it; dragging into another row is ignored rather than silently
  // re-scoping what is about to be closed.
  const [drag, setDrag] = useState<{ rowKey: string; anchor: string; hover: string } | null>(null);
  const [selection, setSelection] = useState<GridSelection | null>(null);
  const closeoutCount = useCloseoutCount();

  const dragRange = drag
    ? { from: drag.anchor <= drag.hover ? drag.anchor : drag.hover,
        to: drag.anchor <= drag.hover ? drag.hover : drag.anchor }
    : null;

  /** Is this cell inside the live drag, or the committed selection? */
  function isPicked(rowKey: string, date: string): boolean {
    if (drag?.rowKey === rowKey && dragRange) return date >= dragRange.from && date <= dragRange.to;
    if (selection && selKey(selection) === rowKey) {
      return date >= selection.from && date <= selection.to;
    }
    return false;
  }

  function commitDrag(row: any) {
    if (!drag || !dragRange || drag.rowKey !== rowKey(row)) { setDrag(null); return; }
    const picked = row.cells.filter((c: any) => c.date >= dragRange.from && c.date <= dragRange.to);
    const prices = picked.map((c: any) => c.priceMinor);
    setSelection({
      roomTypeId: row.roomTypeId,
      ratePlanId: row.ratePlanId,
      roomTypeName: row.roomType,
      ratePlanCode: row.ratePlanCode,
      from: dragRange.from,
      to: dragRange.to,
      allClosed: picked.length > 0 && picked.every((c: any) => c.stopSell),
      anyClosed: picked.some((c: any) => c.stopSell),
      // Carried so the bar can say what these nights cost *now*, above the box
      // that is about to change it.
      minPriceMinor: prices.length ? Math.min(...prices) : 0,
      maxPriceMinor: prices.length ? Math.max(...prices) : 0,
    });
    setDrag(null);
  }

  // Bulk edit form
  const [bulkFrom, setBulkFrom] = useState(today);
  const [bulkTo, setBulkTo] = useState(addDays(today, 30));
  const [bulkMode, setBulkMode] = useState<'set' | 'percent' | 'amount'>('set');
  const [bulkPrice, setBulkPrice] = useState(0);
  const [bulkPercent, setBulkPercent] = useState(0);
  const [bulkAmount, setBulkAmount] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [bulkRoomTypes, setBulkRoomTypes] = useState<string[]>([]);
  const [bulkPlans, setBulkPlans] = useState<string[]>([]);
  const [bulkDows, setBulkDows] = useState<string[]>([]);

  // The one description of the change, shared by the preview, the apply call
  // and the scheduler — so all three are talking about the same thing.
  const bulkBody: Record<string, unknown> | null = bulkFrom && bulkTo && bulkTo >= bulkFrom
    ? {
      from: bulkFrom, to: bulkTo,
      roomTypeIds: bulkRoomTypes.length ? bulkRoomTypes : undefined,
      ratePlanIds: bulkPlans.length ? bulkPlans : undefined,
      daysOfWeek: bulkDows.length ? bulkDows : undefined,
      ...(bulkMode === 'set' ? { priceMinor: bulkPrice }
        : bulkMode === 'percent' ? { adjustPercentBp: percentToBp(bulkPercent) }
          : { adjustMinor: bulkAmount }),
    }
    : null;

  return (
    <div>
      <SectionHeader
        eyebrow="Revenue"
        title="Rates & inventory"
        // Seven tabs are too tall to sit on the title's baseline — pinned to the
        // top right they read as the screen's own navigation, which is what they
        // are, rather than as something hanging off the heading.
        actionAlign="top"
        action={
          <Tabs
            tabs={[
              { value: 'calendar', label: 'Rate calendar' },
              { value: 'closeouts', label: 'Close-outs', count: closeoutCount },
              { value: 'planning', label: 'Planning' },
              { value: 'plans', label: 'Rate plans', count: ratePlans.data?.length },
              { value: 'restrictions', label: 'Restrictions', count: restrictions.data?.filter((r) => r.active).length },
              { value: 'yield', label: 'Yield rules', count: yieldRules.data?.filter((y) => y.active).length },
              { value: 'promotions', label: 'Promotions', count: promotions.data?.filter((p) => p.active).length },
            ]}
            active={tab}
            onChange={setTab}
          />
        }
      />

      {/* Above the grid, not below it: this is the screen where a price is
          changed, so it is where "that change is not going anywhere" has to be
          said. */}
      <ChannelPublishNote className="mb-4" />

      {tab === 'calendar' && (
        <>
          <div className="space-y-2 mb-4">
            {/* Where the window is, and how wide. */}
            <div className="flex items-end gap-2 flex-wrap">
              <Button size="sm" variant="secondary" onClick={() => shift(-1)} title={`Back ${days} days`}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="secondary" onClick={goToToday}>Today</Button>
              <Button size="sm" variant="secondary" onClick={() => shift(1)} title={`Forward ${days} days`}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>

              {/* The pair wraps together. Split across two lines on a phone,
                  "From" ends up beside the arrows and "To" beside the night
                  count, which reads as four unrelated controls. */}
              <div className="flex items-end gap-2">
                <div className="w-[9.5rem]">
                  <Field label="From">
                    <DateInput value={start} onChange={(v) => {
                      if (!v) return;
                      setStart(v);
                      // Keep the window the same width when the start moves, and
                      // never let it invert.
                      if (v > end) setEnd(addDays(v, days - 1));
                    }} />
                  </Field>
                </div>
                <div className="w-[9.5rem]">
                  <Field label="To">
                    <DateInput value={end} min={start} onChange={(v) => v && setEnd(v)} />
                  </Field>
                </div>
              </div>

              <div className="pb-1.5 text-[11px] font-bold text-dash-muted whitespace-nowrap">
                {days} night{days === 1 ? '' : 's'}
                {days > 200 && <span className="text-status-warn"> · wide view, slower to draw</span>}
              </div>
            </div>

            {/* The spans people actually ask for. */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[7, 14, 30, 60, 90, 180].map((n) => (
                <button key={n} onClick={() => setSpan(n)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                    days === n ? 'bg-dash-text text-white border-dash-text'
                      : 'border-black/10 hover:bg-dash-bg'}`}>
                  {n}d
                </button>
              ))}
              <span className="w-px h-4 bg-black/10 mx-1" />
              <button onClick={() => jumpTo(monthStart(today), monthEnd(today))}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full border border-black/10 hover:bg-dash-bg">
                This month
              </button>
              <button
                onClick={() => {
                  const next = addDays(monthEnd(today), 1);
                  jumpTo(next, monthEnd(next));
                }}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full border border-black/10 hover:bg-dash-bg">
                Next month
              </button>
              <button onClick={() => jumpTo(monthStart(today), monthEnd(addDays(monthEnd(today), 62)))}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full border border-black/10 hover:bg-dash-bg">
                This quarter
              </button>

              <div className="w-full sm:w-[180px] sm:ml-auto">
                <Select value={roomTypeId} onChange={setRoomTypeId} options={[
                  { label: 'All room types', value: '' },
                  ...(roomTypes.data ?? []).map((rt) => ({ label: rt.name, value: rt.id })),
                ]} />
              </div>
              <div className="w-full sm:w-[180px]">
                <Select value={ratePlanId} onChange={setRatePlanId} options={[
                  { label: 'All rate plans', value: '' },
                  ...(ratePlans.data ?? []).map((rp) => ({ label: `${rp.code} · ${rp.name}`, value: rp.id })),
                ]} />
              </div>
            </div>
          </div>

          <QueryState query={calendar} loadingRows={6} isEmpty={(d) => d.rows.length === 0}
            empty="No room type and rate plan to price"
            emptyHint="Create room types and a rate plan in Configuration first.">
            {(cal) => (
              <Card padded={false} className="p-4 overflow-hidden">
                <div className="overflow-x-auto scroll-thin" ref={scroller}>
                  <div style={{ minWidth: 230 + cal.dates.length * 78 }}>
                    {/* A month band above the days. Over a fortnight the dates
                        speak for themselves; over ninety days "17" means
                        nothing without knowing which month it belongs to. */}
                    <div className="flex sticky top-0 bg-white z-20 pt-0.5">
                      <div className="w-full sm:w-[230px] shrink-0 sticky left-0 bg-white z-10" />
                      {monthSpans(cal.dates).map((m) => (
                        <div key={m.start} style={{ width: m.count * 78 }}
                          className="shrink-0 border-l border-black/10 pl-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-dash-muted">
                            {monthLabel(m.start)}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="flex sticky top-0 bg-white z-10 border-b subtle-divider pb-2 mb-2">
                      {/* Pinned: scrolled to November, the row labels must not
                          be somewhere off to the left with the numbers they
                          belong to still on screen. */}
                      <div className="w-full sm:w-[230px] shrink-0 sticky left-0 bg-white z-10" />
                      {cal.dates.map((d) => (
                        <div key={d} style={{ width: 78 }}
                          className={`shrink-0 text-center ${isWeekend(d) ? 'bg-dash-bg/60 rounded-lg' : ''}`}>
                          <p className="text-[9px] text-dash-muted uppercase">{dayName(d)}</p>
                          <p className={`text-[13px] font-black leading-none ${d === today ? 'text-status-warn' : ''}`}>
                            {dayNumber(d)}
                          </p>
                        </div>
                      ))}
                    </div>

                    {shownRows(cal.rows, ratePlanId).map((row) => (
                      <div key={`${row.roomTypeId}-${row.ratePlanId}`} className="mb-4">
                        {/* Pinned with the metric labels below it. Scrolled to
                            November you would otherwise be reading four rows of
                            numbers with nothing on screen saying which room
                            they belong to. */}
                        <div className="flex items-center gap-2 mb-1.5 sticky left-0 bg-white z-10
                                        w-full sm:w-[230px] pr-3">
                          <p className="text-[12px] font-bold truncate" title={row.roomType}>{row.roomType}</p>
                          <Pill tone="grey">{row.ratePlanCode}</Pill>
                          {/* A package row prices the whole website package for
                              this room — bed, desk and lessons — not the bed. */}
                          {row.bookingModel && (
                            <Pill tone="mint">
                              package
                            </Pill>
                          )}
                          {row.derived && <Pill tone="lilac">derived</Pill>}
                        </div>
                        <div className="flex">
                          <div className="w-full sm:w-[230px] shrink-0 pr-3 space-y-[3px] pt-1 sticky left-0 bg-white z-10">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-dash-muted h-5">Rate</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-dash-muted h-5">Available</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-dash-muted h-5">Occupancy</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-dash-muted h-5">Rules</p>
                          </div>
                          {row.cells.map((c) => (
                            <div key={c.date} style={{ width: 78 }}
                              onMouseDown={() => {
                                setSelection(null);
                                setDrag({ rowKey: rowKey(row), anchor: c.date, hover: c.date });
                              }}
                              onMouseEnter={() => {
                                if (drag && drag.rowKey === rowKey(row)) {
                                  setDrag({ ...drag, hover: c.date });
                                }
                              }}
                              onMouseUp={() => commitDrag(row)}
                              title={c.stopSell
                                ? `Closed for sale${c.closeReason ? ` — ${c.closeReason}` : ''}`
                                : 'Drag to select dates to close'}
                              className={`shrink-0 px-1 space-y-[3px] cursor-pointer select-none rounded-lg
                                ${c.stopSell ? 'bg-status-bad/10 ring-1 ring-inset ring-status-bad/25' : ''}
                                ${isPicked(rowKey(row), c.date) ? 'ring-2 ring-inset ring-dash-text bg-dash-text/[0.06]' : ''}
                                ${!c.stopSell && !isPicked(rowKey(row), c.date) && isWeekend(c.date) ? 'bg-dash-bg/40' : ''}`}>
                              <div className="h-5 flex items-center justify-center">
                                <span className={`text-[11px] font-bold tabular-nums ${c.source === 'calendar' ? '' : 'text-dash-muted'}`}
                                  title={`Source: ${c.source}`}>
                                  {moneyShort(c.priceMinor)}
                                </span>
                              </div>
                              <div className="h-5 flex items-center justify-center">
                                <span className={`text-[11px] font-bold tabular-nums ${
                                  c.stopSell ? 'text-status-bad' : c.available <= 0 ? 'text-status-bad' : c.available <= 2 ? 'text-status-warn' : ''
                                }`}>
                                  {c.stopSell ? 'closed' : c.available}
                                </span>
                              </div>
                              <div className="h-5 flex items-center justify-center">
                                <span className="text-[10px] text-dash-muted tabular-nums">{pct(c.occupancyBp, 0)}</span>
                              </div>
                              <div className="h-5 flex items-center justify-center gap-0.5">
                                {c.minStay ? <Tiny label={`${c.minStay}+`} title={`Min stay ${c.minStay}`} /> : null}
                                {c.cta ? <Tiny label="A" tone="red" title="Closed to arrival" /> : null}
                                {c.ctd ? <Tiny label="D" tone="red" title="Closed to departure" /> : null}
                                {c.stopSell ? <Tiny label="S" tone="red" title="Stop sell" /> : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-dash-muted mt-2">
                  Bold prices come from the rate calendar; grey prices are resolved from the plan's base rate or
                  its parent. Availability is live: physical rooms minus blocks, bookings and group holds.
                  Drag across dates in a row to close or reopen them for sale.
                </p>
              </Card>
            )}
          </QueryState>

          {selection && (
            <CalendarEditor
              selection={selection}
              onDone={() => setSelection(null)}
              onCancel={() => setSelection(null)}
            />
          )}
        </>
      )}

      {tab === 'closeouts' && <CloseoutsTab />}

      {tab === 'planning' && <PlanningTab today={today} />}

      {tab === 'plans' && (
        <>
          {/* The booking engine sells two things as packages. Each needs a plan
              of its own or its price is arithmetic on the room rate, which the
              property cannot move for a shoulder season without moving every
              room booking with it. */}
          {missingPackages.length > 0 && (
            <Card className="mb-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold mb-1">
                    {missingPackages.length === 1
                      ? 'One booking-engine package has no rate plan'
                      : 'The booking-engine packages have no rate plans'}
                  </p>
                  <p className="text-[11px] text-dash-muted max-w-[46rem]">
                    {missingPackages.map((m) => BOOKING_MODEL_LABELS[m]).join(' and ')}
                    {missingPackages.length === 1 ? ' is' : ' are'} priced on the website by adding the
                    room rate to the surf and coworking prices. Give each one a plan and it becomes a row
                    in the rate calendar, priced per date like any other rate — and priced separately from
                    the other.
                  </p>
                </div>
                <PermissionButton permission="rates.write" disabled={ensurePackages.isPending}
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={async () => {
                    try {
                      await ensurePackages.mutateAsync();
                      toast.success('Package rate plans created — set their prices in the rate calendar');
                    } catch (e) { toast.fail(e); }
                  }}>
                  Create package plans
                </PermissionButton>
              </div>
            </Card>
          )}
          <div className="flex justify-end mb-3">
            <PermissionButton permission="rates.write" icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setPlanOpen(true)}>
              New rate plan
            </PermissionButton>
          </div>
          <QueryState query={ratePlans} loadingRows={4} empty="No rate plans yet"
            emptyHint="A rate plan is what you sell: BAR, a corporate rate, a non-refundable derived rate…">
            {(plans) => (
              <div className="space-y-2">
                {plans.map((p) => (
                  <Card key={p.id}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-[14px] font-bold">{p.name}</p>
                          <Pill tone="grey">{p.code}</Pill>
                          {p.bookingModel && (
                            <Pill tone="mint">
                              Website package · {BOOKING_MODEL_LABELS[p.bookingModel]}
                            </Pill>
                          )}
                          {!p.active && <Pill tone="peach">Inactive</Pill>}
                          {!p.refundable && <Pill tone="peach">Non-refundable</Pill>}
                          {p.parentCode && (
                            <Pill tone="lilac">
                              {p.offsetType === 'percent'
                                ? `${p.parentCode} ${p.offsetValue >= 0 ? '+' : ''}${bpToPercent(p.offsetValue)}%`
                                : `${p.parentCode} ${p.offsetValue >= 0 ? '+' : ''}${money(p.offsetValue)}`}
                            </Pill>
                          )}
                        </div>
                        {p.description && <p className="text-[11px] text-dash-muted">{p.description}</p>}
                        <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-dash-muted">
                          {p.minLos && <span>Min {p.minLos}n</span>}
                          {p.maxLos && <span>Max {p.maxLos}n</span>}
                          {p.minAdvance !== null && p.minAdvance !== undefined && <span>Book {p.minAdvance}d ahead</span>}
                          {p.depositPctBp > 0 && <span>{bpToPercent(p.depositPctBp)}% deposit</span>}
                          <span>{p.kind}</span>
                        </div>
                        {p.inclusions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {p.inclusions.map((i) => <Pill key={i} tone="mint">{i}</Pill>)}
                          </div>
                        )}
                        {p.roomTypes.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {p.roomTypes.map((rt) => (
                              <span key={rt.roomTypeId} className="text-[11px] px-2 py-1 rounded-lg bg-dash-bg">
                                {rt.roomType}: <span className="font-bold">{money(rt.baseRateMinor)}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <PermissionButton permission="rates.write" size="sm" variant="ghost"
                        onClick={() => { setRatePlanId(p.id); setTab('calendar'); }}>
                        View rates
                      </PermissionButton>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </QueryState>
        </>
      )}

      {tab === 'restrictions' && (
        <>
          <div className="flex justify-end mb-3">
            <PermissionButton permission="rates.write" icon={<Ban className="w-3.5 h-3.5" />}
              onClick={() => setRestrictionOpen(true)}>
              Add restriction
            </PermissionButton>
          </div>
          <QueryState query={restrictions} loadingRows={4} empty="No restrictions set"
            emptyHint="Minimum stays, closed-to-arrival dates and stop-sells all live here.">
            {(rows) => (
              <Card>
                <div className="overflow-x-auto scroll-thin">
                  <table className="w-full min-w-[52rem] text-[12px]">
                    <thead>
                      <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                        <th className="pb-2">Type</th>
                        <th className="pb-2">Room type</th>
                        <th className="pb-2">Rate plan</th>
                        <th className="pb-2">Channel</th>
                        <th className="pb-2">From</th>
                        <th className="pb-2">To</th>
                        <th className="pb-2 text-right">Value</th>
                        <th className="pb-2 text-right" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className={`border-b border-black/[0.03] ${r.active ? '' : 'opacity-40'}`}>
                          <td className="py-2.5"><Pill tone={r.type === 'stop-sell' ? 'red' : 'grey'}>{r.type}</Pill></td>
                          <td className="py-2.5">{r.roomType}</td>
                          <td className="py-2.5 text-dash-muted">{r.ratePlan}</td>
                          <td className="py-2.5 text-dash-muted">{r.channelCode ?? 'All channels'}</td>
                          <td className="py-2.5">{longDate(r.dateFrom)}</td>
                          <td className="py-2.5">{longDate(r.dateTo)}</td>
                          <td className="py-2.5 text-right font-bold">{r.value ?? '—'}</td>
                          <td className="py-2.5 text-right">
                            <PermissionButton permission="rates.write" size="sm" variant="ghost"
                              onClick={() => setDeleteRestrictionId(r.id)}>
                              Remove
                            </PermissionButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </QueryState>
        </>
      )}

      {tab === 'yield' && (
        <>
          <div className="flex justify-end mb-3">
            <PermissionButton permission="rates.write" icon={<Zap className="w-3.5 h-3.5" />}
              onClick={() => setYieldOpen(true)}>
              Add yield rule
            </PermissionButton>
          </div>
          <QueryState query={yieldRules} loadingRows={3} empty="No yield rules"
            emptyHint="Rules adjust the resolved rate automatically — e.g. +10% when occupancy is above 80%.">
            {(rows) => (
              <div className="space-y-2">
                {rows.map((y) => (
                  <Card key={y.id}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[13px] font-bold">{y.name}</p>
                          <Pill tone={y.active ? 'mint' : 'grey'}>{y.active ? 'Active' : 'Paused'}</Pill>
                        </div>
                        <p className="text-[11px] text-dash-muted">
                          When <span className="font-bold">{describeMetric(y.metric)}</span>{' '}
                          {describeOperator(y.operator)}{' '}
                          <span className="font-bold">{describeThreshold(y.metric, y.threshold)}</span>
                          {y.secondaryMetric && (
                            <> and <span className="font-bold">{describeMetric(y.secondaryMetric)}</span>{' '}
                              {describeOperator(y.secondaryOperator ?? '')}{' '}
                              <span className="font-bold">{y.secondaryThreshold}</span></>
                          )}
                          {' → '}
                          <span className="font-bold text-black">
                            {y.adjustType === 'percent'
                              ? `${y.adjustValue >= 0 ? '+' : ''}${bpToPercent(y.adjustValue)}%`
                              : `${y.adjustValue >= 0 ? '+' : ''}${money(y.adjustValue)}`}
                          </span>
                        </p>
                        <p className="text-[10px] text-dash-muted mt-1">
                          {y.roomType} · {y.ratePlan} · priority {y.priority}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Toggle checked={y.active}
                          onChange={(v) => updateYield.mutate({ id: y.id, body: { active: v } })} />
                        <PermissionButton permission="rates.write" size="sm" variant="ghost"
                          onClick={async () => {
                            try {
                              await deleteYield.mutateAsync({ id: y.id });
                              toast.success('Yield rule removed');
                            } catch (e) { toast.fail(e); }
                          }}>
                          Remove
                        </PermissionButton>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </QueryState>
        </>
      )}

      {tab === 'promotions' && (
        <>
          <div className="flex justify-end mb-3">
            <PermissionButton permission="rates.write" icon={<Tag className="w-3.5 h-3.5" />}
              onClick={() => setPromoOpen(true)}>
              New promotion
            </PermissionButton>
          </div>
          <QueryState query={promotions} loadingRows={3} empty="No promotions">
            {(rows) => (
              <div className="space-y-2">
                {rows.map((p) => (
                  <Card key={p.id}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-[13px] font-bold">{p.name}</p>
                          <Pill tone="grey">{p.code}</Pill>
                          <Pill tone={p.active ? 'mint' : 'grey'}>{p.active ? 'Active' : 'Paused'}</Pill>
                          <Pill tone="lilac">
                            {p.discountType === 'percent' ? `${bpToPercent(p.discountValue)}% off` : `${money(p.discountValue)} off`}
                          </Pill>
                          {p.deliveryMode === 'native_promo' && <Pill tone="sky">Native OTA promo</Pill>}
                        </div>
                        <p className="text-[11px] text-dash-muted">
                          {p.stayFrom ? `Stays ${p.stayFrom} → ${p.stayTo ?? 'open'}` : 'Any stay date'}
                          {p.minLos ? ` · min ${p.minLos} nights` : ''}
                          {p.minAdvance !== null && p.minAdvance !== undefined ? ` · book ${p.minAdvance}d ahead` : ''}
                          {p.usageLimit > 0 ? ` · used ${p.usedCount}/${p.usageLimit}` : ` · used ${p.usedCount}`}
                        </p>
                        {p.channels.length > 0 && (
                          <div className="flex gap-1.5 mt-2">
                            {p.channels.map((c) => <Pill key={c} tone="sky">{c}</Pill>)}
                          </div>
                        )}
                      </div>
                      <Toggle checked={p.active}
                        onChange={(v) => updatePromo.mutate({ id: p.id, body: { active: v } })} />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </QueryState>
        </>
      )}

      {/* ── Bulk rate edit ── */}
      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Bulk edit rates" size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button variant="secondary" disabled={!bulkBody}
              icon={<Clock className="w-3.5 h-3.5" />}
              onClick={() => { setBulkOpen(false); setScheduleOpen(true); }}>
              Schedule for later
            </Button>
            <Button disabled={bulkRates.isPending || !bulkBody}
              onClick={async () => {
                try {
                  const res = await bulkRates.mutateAsync(bulkBody!);
                  toast.success(`${res.written} rate cell(s) updated`, `${res.dates} date(s) affected`);
                  setBulkOpen(false);
                } catch (e) { toast.fail(e, 'Could not update rates'); }
              }}>
              {bulkRates.isPending ? 'Applying…' : 'Apply now'}
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="From" required><DateInput value={bulkFrom} onChange={setBulkFrom} /></Field>
            <Field label="To" required hint="Inclusive"><DateInput value={bulkTo} onChange={setBulkTo} min={bulkFrom} /></Field>
          </div>

          <Field label="Room types" hint="Leave empty to apply to every active room type">
            <div className="flex flex-wrap gap-1.5">
              {(roomTypes.data ?? []).map((rt) => (
                <button key={rt.id}
                  onClick={() => setBulkRoomTypes((prev) =>
                    prev.includes(rt.id) ? prev.filter((x) => x !== rt.id) : [...prev, rt.id])}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${
                    bulkRoomTypes.includes(rt.id) ? 'bg-black text-white border-black' : 'bg-white border-black/10'
                  }`}>
                  {rt.name}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Rate plans" hint="Leave empty to apply to every parent (non-derived) plan — derived plans follow automatically">
            <div className="flex flex-wrap gap-1.5">
              {(ratePlans.data ?? []).map((rp) => (
                <button key={rp.id}
                  onClick={() => setBulkPlans((prev) =>
                    prev.includes(rp.id) ? prev.filter((x) => x !== rp.id) : [...prev, rp.id])}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${
                    bulkPlans.includes(rp.id) ? 'bg-black text-white border-black' : 'bg-white border-black/10'
                  }`}>
                  {rp.code}{rp.parentCode ? ` (from ${rp.parentCode})` : ''}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Days of week" hint="Leave empty for every day">
            <div className="flex flex-wrap gap-1.5">
              {DOW.map((d) => (
                <button key={d}
                  onClick={() => setBulkDows((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold border uppercase ${
                    bulkDows.includes(d) ? 'bg-black text-white border-black' : 'bg-white border-black/10'
                  }`}>
                  {d}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Change">
            <Select value={bulkMode} onChange={(v) => setBulkMode(v as any)} options={[
              { label: 'Set a fixed price', value: 'set' },
              { label: 'Adjust by a percentage', value: 'percent' },
              { label: 'Adjust by an amount', value: 'amount' },
            ]} />
          </Field>
          {bulkMode === 'set' && (
            <Field label="New nightly price" required><MoneyInput valueMinor={bulkPrice} onChange={setBulkPrice} /></Field>
          )}
          {bulkMode === 'percent' && (
            <Field label="Percentage" required hint="Use a negative number to discount">
              <input type="number" value={bulkPercent} onChange={(e) => setBulkPercent(Number(e.target.value))}
                className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-black/40" />
            </Field>
          )}
          {bulkMode === 'amount' && (
            <Field label="Amount" required hint="Use a negative number to reduce">
              <MoneyInput valueMinor={bulkAmount} onChange={setBulkAmount} />
            </Field>
          )}
          <p className="text-[11px] text-dash-muted">
            Rate changes queue an availability &amp; rate push to any connected channel.
          </p>

          {/* The preview runs the same planning code the apply call runs, so
              what is shown here is what will happen — not a client-side guess. */}
          <div className="border-t subtle-divider pt-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-2">
              Before you apply
            </p>
            <RateChangePreview body={bulkBody} />
          </div>
        </div>
      </Modal>

      <ScheduleModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        change={bulkBody}
        today={today}
      />

      {/* ── Restriction ── */}
      <RestrictionModal
        open={restrictionOpen}
        onClose={() => setRestrictionOpen(false)}
        roomTypes={roomTypes.data ?? []}
        ratePlans={ratePlans.data ?? []}
        defaultFrom={start}
        defaultTo={addDays(to, -1)}
        busy={createRestriction.isPending}
        onSave={async (body) => {
          try {
            await createRestriction.mutateAsync(body);
            toast.success('Restriction added');
            setRestrictionOpen(false);
          } catch (e) { toast.fail(e); }
        }}
      />

      {/* ── Yield rule ── */}
      <YieldModal
        open={yieldOpen}
        onClose={() => setYieldOpen(false)}
        roomTypes={roomTypes.data ?? []}
        ratePlans={ratePlans.data ?? []}
        busy={createYield.isPending}
        onSave={async (body) => {
          try {
            await createYield.mutateAsync(body);
            toast.success('Yield rule created');
            setYieldOpen(false);
          } catch (e) { toast.fail(e); }
        }}
      />

      {/* ── Promotion ── */}
      <PromotionModal
        open={promoOpen}
        onClose={() => setPromoOpen(false)}
        ratePlans={ratePlans.data ?? []}
        busy={createPromo.isPending}
        onSave={async (body) => {
          try {
            await createPromo.mutateAsync(body);
            toast.success('Promotion created');
            setPromoOpen(false);
          } catch (e) { toast.fail(e); }
        }}
      />

      {/* ── Rate plan ── */}
      <RatePlanModal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        roomTypes={roomTypes.data ?? []}
        ratePlans={ratePlans.data ?? []}
        busy={createRatePlan.isPending}
        onSave={async (body) => {
          try {
            await createRatePlan.mutateAsync(body);
            toast.success('Rate plan created');
            setPlanOpen(false);
          } catch (e) { toast.fail(e); }
        }}
      />

      <ConfirmDialog
        open={!!deleteRestrictionId}
        title="Remove this restriction?"
        body="It stops applying immediately and any connected channel is re-pushed."
        confirmLabel="Remove"
        danger
        busy={deleteRestriction.isPending}
        onCancel={() => setDeleteRestrictionId(null)}
        onConfirm={async () => {
          if (!deleteRestrictionId) return;
          try {
            await deleteRestriction.mutateAsync({ id: deleteRestrictionId });
            toast.success('Restriction removed');
          } catch (e) { toast.fail(e); }
          setDeleteRestrictionId(null);
        }}
      />
    </div>
  );
}

// ─── Sub-modals ──────────────────────────────────────────────
function RestrictionModal({
  open, onClose, roomTypes, ratePlans, defaultFrom, defaultTo, onSave, busy,
}: any) {
  const [type, setType] = useState('min-stay');
  const [roomTypeId, setRoomTypeId] = useState('');
  const [ratePlanId, setRatePlanId] = useState('');
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [value, setValue] = useState(2);
  const needsValue = ['min-stay', 'max-stay', 'min-stay-through', 'min-advance', 'max-advance', 'release'].includes(type);

  return (
    <Modal open={open} onClose={onClose} title="Add a selling restriction"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={busy}
            onClick={() => onSave({
              type,
              roomTypeId: roomTypeId || undefined,
              ratePlanId: ratePlanId || undefined,
              dateFrom: from, dateTo: to,
              value: needsValue ? value : undefined,
            })}>
            Add restriction
          </Button>
        </div>
      }>
      <div className="space-y-4">
        <Field label="Type" required>
          <Select value={type} onChange={setType} options={[
            { label: 'Minimum stay (on arrival)', value: 'min-stay' },
            { label: 'Maximum stay (on arrival)', value: 'max-stay' },
            { label: 'Minimum stay through', value: 'min-stay-through' },
            { label: 'Closed to arrival', value: 'cta' },
            { label: 'Closed to departure', value: 'ctd' },
            { label: 'Stop sell', value: 'stop-sell' },
            { label: 'Minimum advance booking', value: 'min-advance' },
            { label: 'Maximum advance booking', value: 'max-advance' },
            { label: 'Release / cut-off', value: 'release' },
          ]} />
        </Field>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Room type" hint="Leave blank for all">
            <Select value={roomTypeId} onChange={setRoomTypeId} options={[
              { label: 'All room types', value: '' },
              ...roomTypes.map((rt: any) => ({ label: rt.name, value: rt.id })),
            ]} />
          </Field>
          <Field label="Rate plan" hint="Leave blank for all">
            <Select value={ratePlanId} onChange={setRatePlanId} options={[
              { label: 'All rate plans', value: '' },
              ...ratePlans.map((rp: any) => ({ label: rp.code, value: rp.id })),
            ]} />
          </Field>
          <Field label="From" required><DateInput value={from} onChange={setFrom} /></Field>
          <Field label="To" required hint="Inclusive"><DateInput value={to} onChange={setTo} min={from} /></Field>
          {needsValue && (
            <Field label="Value" required hint={type.includes('advance') || type === 'release' ? 'Days' : 'Nights'}>
              <NumberInput value={value} onChange={setValue} min={0} max={365} />
            </Field>
          )}
        </div>
      </div>
    </Modal>
  );
}

function YieldModal({ open, onClose, roomTypes, ratePlans, onSave, busy }: any) {
  const [name, setName] = useState('');
  const [metric, setMetric] = useState('occupancy');
  const [operator, setOperator] = useState('gt');
  const [threshold, setThreshold] = useState('80');
  const [adjustType, setAdjustType] = useState('percent');
  const [adjustValue, setAdjustValue] = useState(10);
  const [roomTypeId, setRoomTypeId] = useState('');
  const [ratePlanId, setRatePlanId] = useState('');
  const [priority, setPriority] = useState(0);

  return (
    <Modal open={open} onClose={onClose} title="New yield rule"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!name.trim() || busy}
            onClick={() => onSave({
              name: name.trim(), metric, operator,
              threshold: metric === 'occupancy' ? String(percentToBp(Number(threshold))) : threshold,
              adjustType,
              adjustValue: adjustType === 'percent' ? percentToBp(adjustValue) : adjustValue,
              roomTypeId: roomTypeId || undefined,
              ratePlanId: ratePlanId || undefined,
              priority,
            })}>
            Create rule
          </Button>
        </div>
      }>
      <div className="space-y-4">
        <Field label="Rule name" required>
          <TextInput value={name} onChange={setName} placeholder="e.g. High occupancy uplift" />
        </Field>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="When">
            <Select value={metric} onChange={setMetric} options={[
              { label: 'Occupancy %', value: 'occupancy' },
              { label: 'Days until arrival', value: 'lead_time' },
              { label: 'Length of stay', value: 'los' },
              { label: 'Day of week', value: 'dow' },
            ]} />
          </Field>
          <Field label="Is">
            <Select value={operator} onChange={setOperator} options={[
              { label: 'greater than', value: 'gt' },
              { label: 'less than', value: 'lt' },
              { label: 'at least', value: 'gte' },
              { label: 'at most', value: 'lte' },
              { label: 'equal to', value: 'eq' },
              { label: 'one of', value: 'in' },
            ]} />
          </Field>
          <Field label={metric === 'dow' ? 'Days (csv)' : 'Value'}>
            <TextInput value={threshold} onChange={setThreshold}
              placeholder={metric === 'dow' ? 'fri,sat' : '80'} />
          </Field>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Adjust by">
            <Select value={adjustType} onChange={setAdjustType} options={[
              { label: 'Percentage', value: 'percent' }, { label: 'Fixed amount', value: 'fixed' },
            ]} />
          </Field>
          <Field label={adjustType === 'percent' ? 'Percent (negative to discount)' : 'Amount'}>
            {adjustType === 'percent' ? (
              <input type="number" value={adjustValue} onChange={(e) => setAdjustValue(Number(e.target.value))}
                className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-black/40" />
            ) : (
              <MoneyInput valueMinor={adjustValue} onChange={setAdjustValue} />
            )}
          </Field>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Room type">
            <Select value={roomTypeId} onChange={setRoomTypeId} options={[
              { label: 'All', value: '' }, ...roomTypes.map((rt: any) => ({ label: rt.name, value: rt.id })),
            ]} />
          </Field>
          <Field label="Rate plan">
            <Select value={ratePlanId} onChange={setRatePlanId} options={[
              { label: 'All', value: '' }, ...ratePlans.map((rp: any) => ({ label: rp.code, value: rp.id })),
            ]} />
          </Field>
          <Field label="Priority" hint="Higher runs first">
            <NumberInput value={priority} onChange={setPriority} min={0} max={100} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function PromotionModal({ open, onClose, ratePlans, onSave, busy }: any) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState('basic');
  const [discountType, setDiscountType] = useState('percent');
  const [discountValue, setDiscountValue] = useState(10);
  const [stayFrom, setStayFrom] = useState('');
  const [stayTo, setStayTo] = useState('');
  const [minLos, setMinLos] = useState(0);
  const [minAdvance, setMinAdvance] = useState(0);
  const [usageLimit, setUsageLimit] = useState(0);
  const [deliveryMode, setDeliveryMode] = useState('price');

  return (
    <Modal open={open} onClose={onClose} title="New promotion"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!code.trim() || !name.trim() || busy}
            onClick={() => onSave({
              code: code.trim().toUpperCase(), name: name.trim(), kind,
              discountType,
              discountValue: discountType === 'percent' ? percentToBp(discountValue) : discountValue,
              stayFrom: stayFrom || undefined, stayTo: stayTo || undefined,
              minLos: minLos || undefined, minAdvance: minAdvance || undefined,
              usageLimit, deliveryMode,
            })}>
            Create promotion
          </Button>
        </div>
      }>
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Code" required><TextInput value={code} onChange={(v) => setCode(v.toUpperCase())} /></Field>
          <Field label="Name" required><TextInput value={name} onChange={setName} /></Field>
          <Field label="Kind">
            <Select value={kind} onChange={setKind} options={[
              { label: 'Basic discount', value: 'basic' },
              { label: 'Early bird', value: 'early_bird' },
              { label: 'Last minute', value: 'last_minute' },
              { label: 'Long stay', value: 'long_stay' },
            ]} />
          </Field>
          <Field label="Discount type">
            <Select value={discountType} onChange={setDiscountType} options={[
              { label: 'Percentage', value: 'percent' }, { label: 'Fixed amount', value: 'fixed' },
            ]} />
          </Field>
          <Field label={discountType === 'percent' ? 'Percent off' : 'Amount off'}>
            {discountType === 'percent' ? (
              <input type="number" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))}
                className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-black/40" />
            ) : (
              <MoneyInput valueMinor={discountValue} onChange={setDiscountValue} />
            )}
          </Field>
          <Field label="Usage limit" hint="0 = unlimited">
            <NumberInput value={usageLimit} onChange={setUsageLimit} min={0} />
          </Field>
          <Field label="Stays from"><DateInput value={stayFrom} onChange={setStayFrom} /></Field>
          <Field label="Stays to"><DateInput value={stayTo} onChange={setStayTo} /></Field>
          <Field label="Minimum nights"><NumberInput value={minLos} onChange={setMinLos} min={0} /></Field>
          <Field label="Book at least (days ahead)"><NumberInput value={minAdvance} onChange={setMinAdvance} min={0} /></Field>
        </div>
        <Field label="Delivery to channels"
          hint="OTAs must receive a discounted price or a native promotion — never a raw discount rule they cannot interpret">
          <Select value={deliveryMode} onChange={setDeliveryMode} options={[
            { label: 'Send as a discounted price', value: 'price' },
            { label: 'Send as a native OTA promotion', value: 'native_promo' },
          ]} />
        </Field>
      </div>
    </Modal>
  );
}

function RatePlanModal({ open, onClose, roomTypes, ratePlans, onSave, busy }: any) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [offsetType, setOffsetType] = useState('percent');
  const [offsetValue, setOffsetValue] = useState(-10);
  const [refundable, setRefundable] = useState(true);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [inclusions, setInclusions] = useState('');
  const [bookingModel, setBookingModel] = useState('');

  /** Models already spoken for — one plan per model, or the price is ambiguous. */
  const takenModels = new Set(
    ratePlans.map((p: RatePlan) => p.bookingModel).filter(Boolean) as BookingModel[],
  );

  return (
    <Modal open={open} onClose={onClose} title="New rate plan" size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!code.trim() || !name.trim() || busy}
            onClick={() => onSave({
              code: code.trim().toUpperCase(), name: name.trim(),
              parentId: parentId || undefined,
              offsetType: parentId ? offsetType : undefined,
              offsetValue: parentId ? (offsetType === 'percent' ? percentToBp(offsetValue) : offsetValue) : 0,
              refundable,
              bookingModel: bookingModel || undefined,
              inclusions: inclusions.split(',').map((s) => s.trim()).filter(Boolean),
              roomTypes: Object.entries(rates)
                .filter(([, v]) => v > 0)
                .map(([roomTypeId, baseRateMinor]) => ({ roomTypeId, baseRateMinor })),
            })}>
            Create rate plan
          </Button>
        </div>
      }>
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Code" required hint="Short code, e.g. BAR or CORP">
            <TextInput value={code} onChange={(v) => setCode(v.toUpperCase())} />
          </Field>
          <Field label="Name" required><TextInput value={name} onChange={setName} /></Field>
        </div>

        <Field label="Derive from another plan" hint="A derived plan recalculates from its parent every time">
          <Select value={parentId} onChange={setParentId} options={[
            { label: 'Independent plan', value: '' },
            ...ratePlans.filter((p: any) => !p.parentId).map((p: any) => ({ label: `${p.code} · ${p.name}`, value: p.id })),
          ]} />
        </Field>

        {parentId && (
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Offset type">
              <Select value={offsetType} onChange={setOffsetType} options={[
                { label: 'Percentage', value: 'percent' }, { label: 'Fixed amount', value: 'fixed' },
              ]} />
            </Field>
            <Field label={offsetType === 'percent' ? 'Percent (negative discounts)' : 'Amount'}>
              {offsetType === 'percent' ? (
                <input type="number" value={offsetValue} onChange={(e) => setOffsetValue(Number(e.target.value))}
                  className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-black/40" />
              ) : (
                <MoneyInput valueMinor={offsetValue} onChange={setOffsetValue} />
              )}
            </Field>
          </div>
        )}

        {!parentId && (
          <Field label="Base rate per room type" hint="The starting price before calendar overrides">
            <div className="space-y-2">
              {roomTypes.map((rt: any) => (
                <div key={rt.id} className="flex items-center gap-3">
                  <span className="text-[12px] font-semibold flex-1">{rt.name}</span>
                  <div className="w-[140px]">
                    <MoneyInput valueMinor={rates[rt.id] ?? 0}
                      onChange={(v) => setRates({ ...rates, [rt.id]: v })} />
                  </div>
                </div>
              ))}
              {roomTypes.length === 0 && (
                <p className="text-[11px] text-status-bad">Create room types first in Configuration.</p>
              )}
            </div>
          </Field>
        )}

        <Field label="Website package"
          hint="Set this and the plan becomes the price of that package on the booking engine — one figure covering the room and everything the package includes">
          <Select value={bookingModel} onChange={setBookingModel} options={[
            { label: 'Not a website package', value: '' },
            ...BOOKING_MODELS.map((m) => ({
              label: takenModels.has(m)
                ? `${BOOKING_MODEL_LABELS[m]} — already has a plan`
                : BOOKING_MODEL_LABELS[m],
              value: m,
            })),
          ]} />
        </Field>

        <Field label="Inclusions" hint="Comma separated — shown to the guest at booking">
          <TextInput value={inclusions} onChange={setInclusions} placeholder="Breakfast for 2, Airport transfer" />
        </Field>

        <Toggle checked={refundable} onChange={setRefundable} label="Refundable" />
      </div>
    </Modal>
  );
}

function Tiny({ label, tone, title }: { label: string; tone?: 'red'; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center justify-center w-4 h-4 rounded text-[8px] font-black ${
        tone === 'red' ? 'bg-red-100 text-status-bad' : 'bg-black/[0.06] text-dash-muted'
      }`}
    >
      {label}
    </span>
  );
}

function describeMetric(m: string) {
  return { occupancy: 'occupancy', lead_time: 'days until arrival', los: 'length of stay', dow: 'day of week' }[m] ?? m;
}
function describeOperator(o: string) {
  return { gt: 'is above', lt: 'is below', gte: 'is at least', lte: 'is at most', eq: 'equals', in: 'is one of' }[o] ?? o;
}
function describeThreshold(metric: string, threshold: string) {
  if (metric === 'occupancy') return `${bpToPercent(Number(threshold))}%`;
  return threshold;
}
