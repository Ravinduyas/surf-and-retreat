// ─────────────────────────────────────────────────────────────
// The tape chart.
//
// Time runs sideways and does not end: scroll right and the next months load
// and stitch on, scroll left and the previous ones do the same. That is worth
// the machinery because the alternative — a fixed 14-day window paged with two
// arrows — cuts long stays in half and loses your place every time you look
// forward.
//
// Three things here are load-bearing and easy to break:
//
//   · **The grid is virtualised on X.** A year across thirty-five sellable
//     units is over twelve thousand cells; only the visible slice is rendered.
//   · **Growing leftward corrects the scroll position in the same frame.**
//     Prepending a chunk shifts every pixel right by its width, and without the
//     correction the chart lurches away from whatever the user was reading.
//   · **A stay crossing a chunk seam is one bar, not two** — see `mergeChunks`.
// ─────────────────────────────────────────────────────────────
import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Ban, Users, Search, X, SlidersHorizontal } from 'lucide-react';
import { useNav } from '../nav';
import { useTapeChunks, useAssignRoom, useHostelworldSettings } from '../queries';
import { useAuthStore } from '../stores';
import { HostelworldBadge, HostelworldMoney, isHostelworldName } from '../hostelworld';
import { Card, Pill, Button, SectionHeader, Select } from '../ui';
import { useToast, PermissionButton, statusTone, OccupancyBar, Loading, Toggle } from '../components';
import { money, addDays, dayName, dayNumber, isWeekend, monthName, monthLongName, longDate, nightsBetween } from '../format';
import {
  CHUNK_DAYS, chunkStart, mergeChunks, laneKeyOf, visibleSlice,
  activeFilterCount, spanMatches, spanMatchesSearch, roomMatches, NO_FILTERS,
  type TapeFilters, type TapeRoom, type MergedSpan,
} from '../tapechart';

/**
 * The room-name column.
 *
 * Wide enough for a dorm bed's full description — "bed 3/8 · top · room 2" —
 * because truncating it to "bed 3/8 · to…" costs the reader the one thing the
 * line was labelled with.
 */
const LABEL_W = 232;

/** How close to an edge before the next chunk is fetched, in days. */
const PREFETCH_DAYS = 20;

const DENSITIES = [
  { label: 'Compact', value: '30' },
  { label: 'Normal', value: '46' },
  { label: 'Wide', value: '64' },
];

/**
 * The room-name column, pinned to the left edge while time scrolls past it.
 *
 * This is not decoration. The column used to sit inside the scrolling area, so
 * scrolling to January took the room numbers with it — measured at 1,864px off
 * the left of the screen — and the chart read as *empty* rather than as scrolled.
 * A fixed fortnight had almost nothing to scroll and hid it; unlimited
 * scrolling does not.
 */
const STICKY_LABEL: React.CSSProperties = {
  width: LABEL_W, position: 'sticky', left: 0,
  // The grid's bars are absolutely positioned and slide underneath this column
  // as it scrolls. Without an opaque background covering the *whole* row they
  // show through above and below the text, so the pinned column has to stretch
  // and paint, not just sit there.
  alignSelf: 'stretch',
};

const ROW_HEIGHTS = [
  { label: 'Tight rows', value: '30' },
  { label: 'Normal rows', value: '38' },
  { label: 'Tall rows', value: '48' },
];

type SortBy = 'number' | 'roomType' | 'housekeeping';
type GroupBy = 'none' | 'roomType' | 'floor';

/** Everything the user can set, remembered between sessions. */
interface TapePrefs {
  cellWidth: number;
  rowHeight: number;
  groupBy: GroupBy;
  sortBy: SortBy;
  collapsed: string[];
  filters: TapeFilters;
}

const PREFS_KEY = 'helio.tape.prefs.v1';

const DEFAULT_PREFS: TapePrefs = {
  cellWidth: 46, rowHeight: 38, groupBy: 'roomType', sortBy: 'number',
  collapsed: [], filters: { ...NO_FILTERS },
};

function loadPrefs(): TapePrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    // Merged rather than trusted: a preferences blob written by an older
    // version is missing whatever was added since, and a missing filter array
    // would throw on `.length` the first time it was read.
    return {
      ...DEFAULT_PREFS,
      cellWidth: Number(parsed.cellWidth) || DEFAULT_PREFS.cellWidth,
      rowHeight: Number(parsed.rowHeight) || DEFAULT_PREFS.rowHeight,
      groupBy: parsed.groupBy ?? DEFAULT_PREFS.groupBy,
      sortBy: parsed.sortBy ?? DEFAULT_PREFS.sortBy,
      collapsed: Array.isArray(parsed.collapsed) ? parsed.collapsed : [],
      filters: { ...NO_FILTERS, ...(parsed.filters ?? {}) },
    };
  } catch { return DEFAULT_PREFS; }
}

export function CalendarScreen() {
  const { navigate } = useNav();
  const toast = useToast();
  const property = useAuthStore((s) => s.property);
  const today = property?.businessDate ?? new Date().toISOString().slice(0, 10);

  const [prefs, setPrefs] = useState<TapePrefs>(loadPrefs);
  const { cellWidth: CELL_W, rowHeight: ROW_H, groupBy, sortBy, filters } = prefs;
  const setFilters = useCallback(
    (f: TapeFilters) => setPrefs((p) => ({ ...p, filters: f })), []);
  const collapsed = useMemo(() => new Set(prefs.collapsed), [prefs.collapsed]);
  const toggleGroup = useCallback((group: string) => setPrefs((p) => ({
    ...p,
    collapsed: p.collapsed.includes(group)
      ? p.collapsed.filter((g) => g !== group)
      : [...p.collapsed, group],
  })), []);

  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* private mode */ }
  }, [prefs]);

  // ── The window of time currently loaded ────────────────────
  // Held as chunk *starts* rather than a from/to pair, so extending is an
  // append or a prepend and every chunk keeps its own cache entry.
  const [chunks, setChunks] = useState<string[]>(() => {
    const here = chunkStart(today);
    return [addDays(here, -CHUNK_DAYS), here, addDays(here, CHUNK_DAYS)];
  });

  const rangeStart = chunks[0];
  const totalDays = chunks.length * CHUNK_DAYS;
  const gridWidth = totalDays * CELL_W;

  const results = useTapeChunks(chunks, CHUNK_DAYS);
  const loadedCount = results.filter((r) => r.data).length;
  const anyError = results.find((r) => r.error)?.error as Error | undefined;

  const merged = useMemo(
    () => mergeChunks(results.map((r) => r.data)),
    // `results` is a fresh array each render; the data identities are what
    // actually change, so the merge is keyed on those.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [results.map((r) => (r.data ? 1 : 0)).join(''), loadedCount, results.map((r) => r.dataUpdatedAt).join(',')],
  );

  // ── Scrolling ──────────────────────────────────────────────
  const scroller = useRef<HTMLDivElement | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(1200);

  // Set when a chunk is prepended, consumed by the layout effect below.
  const pendingShift = useRef(0);
  // Guards against firing another extension while one is being applied.
  const extending = useRef(false);

  useLayoutEffect(() => {
    // Prepending a chunk moves all existing content right by exactly its width.
    // Correcting scrollLeft here — before the browser paints — is what keeps
    // the day under the user's eye from sliding away.
    if (pendingShift.current && scroller.current) {
      scroller.current.scrollLeft += pendingShift.current;
      setScrollLeft(scroller.current.scrollLeft);
      pendingShift.current = 0;
    }
    extending.current = false;
  }, [chunks]);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setScrollLeft(el.scrollLeft);

    if (extending.current) return;
    const dayAtLeft = el.scrollLeft / CELL_W;
    const dayAtRight = (el.scrollLeft + el.clientWidth) / CELL_W;

    if (dayAtLeft < PREFETCH_DAYS) {
      extending.current = true;
      pendingShift.current = CHUNK_DAYS * CELL_W;
      setChunks((cs) => [addDays(cs[0], -CHUNK_DAYS), ...cs]);
    } else if (dayAtRight > totalDays - PREFETCH_DAYS) {
      extending.current = true;
      setChunks((cs) => [...cs, addDays(cs[cs.length - 1], CHUNK_DAYS)]);
    }
  }, [CELL_W, totalDays]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setViewportWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /**
   * Change the day width, keeping the date at the left edge where it is.
   *
   * Without this, zooming out jumps you months away from what you were reading:
   * `scrollLeft` is a pixel count, and the same pixels mean a different date at
   * a different day width. Scaling it by the ratio keeps the view anchored.
   */
  const setCellWidth = useCallback((next: number) => {
    const el = scroller.current;
    const anchorDay = el ? el.scrollLeft / CELL_W : 0;
    setPrefs((p) => ({ ...p, cellWidth: next }));
    requestAnimationFrame(() => {
      if (!el) return;
      el.scrollLeft = anchorDay * next;
      setScrollLeft(el.scrollLeft);
    });
  }, [CELL_W]);

  // Drag anywhere on the grid to pan, the way a map does. Bars keep their own
  // click because a drag that moved is suppressed below, not the button.
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only a plain left-button drag on the background, never on a booking.
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    const el = scroller.current;
    if (!el) return;
    drag.current = { x: e.clientX, left: el.scrollLeft, moved: false };
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const el = scroller.current;
    if (!drag.current || !el) return;
    const dx = e.clientX - drag.current.x;
    if (Math.abs(dx) > 3) drag.current.moved = true;
    el.scrollLeft = drag.current.left - dx;
  }, []);
  const endDrag = useCallback(() => { drag.current = null; }, []);

  /** Scroll so `date` sits a little in from the left edge. */
  const scrollToDate = useCallback((date: string, offsetDays = 2) => {
    const el = scroller.current;
    if (!el) return;
    const index = nightsBetween(rangeStart, date) - offsetDays;
    el.scrollTo({ left: Math.max(0, index * CELL_W), behavior: 'smooth' });
  }, [rangeStart, CELL_W]);

  // Land on today the first time the grid is measured, not on the far past.
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current || !scroller.current || !loadedCount) return;
    landed.current = true;
    const index = nightsBetween(rangeStart, today) - 2;
    scroller.current.scrollLeft = Math.max(0, index * CELL_W);
    setScrollLeft(scroller.current.scrollLeft);
  }, [loadedCount, rangeStart, today, CELL_W]);

  // Shift+wheel and trackpad gestures pan time; arrows and T do too, but only
  // when focus is not in a text field — a receptionist typing a guest name in
  // the search box must not scroll the chart with every arrow key.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey && e.deltaY !== 0) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') { el.scrollLeft += CELL_W; e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { el.scrollLeft -= CELL_W; e.preventDefault(); }
      else if (e.key === 'PageDown') { el.scrollLeft += el.clientWidth; e.preventDefault(); }
      else if (e.key === 'PageUp') { el.scrollLeft -= el.clientWidth; e.preventDefault(); }
      else if (e.key === 't' || e.key === 'T') { scrollToDate(today); }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => { el.removeEventListener('wheel', onWheel); window.removeEventListener('keydown', onKey); };
  }, [CELL_W, scrollToDate, today]);

  // ── What to draw ───────────────────────────────────────────
  const { startIndex, endIndex } = visibleSlice(totalDays, scrollLeft, viewportWidth, CELL_W);
  const visibleDates = useMemo(() => {
    const out: string[] = [];
    for (let i = startIndex; i < endIndex; i++) out.push(addDays(rangeStart, i));
    return out;
  }, [startIndex, endIndex, rangeStart]);

  const assignRoom = useAssignRoom();
  const [hovered, setHovered] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const rooms: TapeRoom[] = merged.rooms;
  const visibleRooms = rooms.filter((r) => roomMatches(r, filters));

  // Lanes: a dorm sells beds, so it gets a line per bed; anything else is one
  // line for the room.
  type Lane = {
    key: string; label: string; sublabel: string; room: TapeRoom;
    bedId: string | null; status: string; group: string;
  };
  const spansByLane = useMemo(() => {
    const map = new Map<string, MergedSpan[]>();
    for (const s of merged.spans) {
      if (!spanMatches(s, filters)) continue;
      const key = laneKeyOf(s);
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [merged.spans, filters]);

  const sortRooms = (source: TapeRoom[]): TapeRoom[] => [...source].sort((a, b) => {
    if (sortBy === 'roomType') {
      const t = a.roomType.localeCompare(b.roomType);
      if (t) return t;
    } else if (sortBy === 'housekeeping') {
      const s = a.status.localeCompare(b.status);
      if (s) return s;
    }
    // Room numbers are text but read as numbers — "10" belongs after "9".
    return a.number.localeCompare(b.number, undefined, { numeric: true });
  });

  const lanesOf = (unsorted: TapeRoom[]): Lane[] => {
    const out: Lane[] = [];
    for (const room of sortRooms(unsorted)) {
      const group = groupBy === 'floor' ? `Floor ${room.floor}`
        : groupBy === 'roomType' ? room.roomType : '';
      if (room.kind === 'dorm' && room.beds?.length) {
        // A room type with several physical dorm rooms needs the room named on
        // each bed; a type with one room does not, and saying "room 1" on every
        // line of a single-room dorm is noise where the space is scarce.
        const ofType = unsorted.filter((r) => r.roomTypeId === room.roomTypeId)
          .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
        // "room 2 of 2", not the room's code — the code is already the first
        // half of the bed's own label, so repeating it says nothing.
        const roomOrdinal = ofType.findIndex((r) => r.id === room.id) + 1;
        room.beds.forEach((bed, i) => {
          out.push({
            key: bed.id,
            label: bed.code,
            // What this line actually sells: one numbered bed, on a bunk. The
            // bed code alone does not say which of eight it is.
            sublabel: `bed ${i + 1}/${room.beds.length} · ${bed.bunk}`
              + (ofType.length > 1 ? ` · room ${roomOrdinal}/${ofType.length}` : ''),
            room, bedId: bed.id, status: room.status, group,
          });
        });
      } else {
        out.push({
          key: room.id, label: room.number, sublabel: room.roomType,
          room, bedId: null, status: room.status, group,
        });
      }
    }
    return out;
  };

  // Counted from *every* room, not the filtered set. The "N hidden" warning
  // exists to stop the chart quietly showing half a property, and computing it
  // from rooms that survived the filter makes it permanently zero — which is
  // exactly the silence it was added to prevent.
  const allLanes = lanesOf(rooms);
  const lanes = lanesOf(visibleRooms);
  const filteredLanes = filters.occupiedOnly
    ? lanes.filter((l) => (spansByLane.get(l.key)?.length ?? 0) > 0)
    : lanes;

  // How many units each group holds, and how many are sold tonight. Counted
  // before collapsing, so a collapsed section still reports what is inside it —
  // a folded group that says nothing is just a hidden part of the property.
  const groupStats = new Map<string, { total: number; sold: number }>();
  for (const l of filteredLanes) {
    const st = groupStats.get(l.group) ?? { total: 0, sold: 0 };
    st.total++;
    if ((spansByLane.get(l.key) ?? []).some((s) => s.from <= today && s.to > today)) st.sold++;
    groupStats.set(l.group, st);
  }

  const shownLanes = groupBy === 'none'
    ? filteredLanes
    : filteredLanes.filter((l) => !collapsed.has(l.group));

  /**
   * Sections, in the order they are drawn.
   *
   * Two levels, because a dorm bed and a private room are not the same thing to
   * sell and a single flat list of lanes reads as though they were: a dorm line
   * sells *one bed of eight*, a room line sells the whole room. So the chart
   * carries a banner for each kind, and each room type sits beneath its own
   * kind as a foldable section.
   *
   * Headers come from the *filtered* lanes rather than the shown ones, so a
   * folded section keeps a header to unfold it with.
   */
  const groupOrder: string[] = [];
  for (const l of filteredLanes) if (!groupOrder.includes(l.group)) groupOrder.push(l.group);

  const kindOf = (group: string) =>
    filteredLanes.find((l) => l.group === group)?.room.kind === 'dorm' ? 'dorm' : 'room';
  // Dorms first: they are the larger part of this property's inventory and the
  // part that needs watching bed by bed.
  groupOrder.sort((a, b) => {
    const k = (kindOf(a) === 'dorm' ? 0 : 1) - (kindOf(b) === 'dorm' ? 0 : 1);
    return k || a.localeCompare(b);
  });

  const kindStats = (kind: string) => {
    const ls = filteredLanes.filter((l) => (l.room.kind === 'dorm' ? 'dorm' : 'room') === kind);
    const sold = ls.filter((l) =>
      (spansByLane.get(l.key) ?? []).some((s) => s.from <= today && s.to > today)).length;
    return { total: ls.length, sold, types: new Set(ls.map((l) => l.group)).size };
  };

  const availByDate = useMemo(() => {
    const map = new Map<string, { available: number; sold: number; physical: number; blocked: number }>();
    const allowed = new Set(visibleRooms.map((r) => r.roomTypeId));
    for (const c of merged.availability) {
      if (!allowed.has(c.roomTypeId)) continue;
      const agg = map.get(c.date) ?? { available: 0, sold: 0, physical: 0, blocked: 0 };
      agg.available += c.available; agg.sold += c.sold;
      agg.physical += c.physical; agg.blocked += c.blocked;
      map.set(c.date, agg);
    }
    return map;
  }, [merged.availability, visibleRooms]);

  const blocksByRoom = useMemo(() => {
    const map = new Map<string, typeof merged.blocks>();
    for (const b of merged.blocks) {
      const list = map.get(b.roomId) ?? [];
      list.push(b);
      map.set(b.roomId, list);
    }
    return map;
  }, [merged.blocks]);

  // What the viewport is actually showing. Scrolled months out, the day numbers
  // alone say nothing about where you are — and the tiny month under each
  // number is not what the eye reads first.
  const monthSpan = useMemo(() => {
    if (!visibleDates.length) return '';
    const first = visibleDates[0];
    const last = visibleDates[visibleDates.length - 1];
    const label = (d: string) => `${monthLongName(d)} ${d.slice(0, 4)}`;
    return label(first) === label(last) ? label(first) : `${label(first)} – ${label(last)}`;
  }, [visibleDates]);

  const searching = filters.search.trim().length > 0;
  // Hidden *by filters*. A collapsed group is not counted: the user folded it
  // themselves and its header is still on screen saying what is inside.
  const hiddenLanes = allLanes.length - filteredLanes.length;
  const filterCount = activeFilterCount(filters);

  const roomTypes = useMemo(() => {
    const out: { id: string; name: string }[] = [];
    for (const r of rooms) if (!out.find((t) => t.id === r.roomTypeId)) {
      out.push({ id: r.roomTypeId, name: r.roomType });
    }
    return out;
  }, [rooms]);
  const floors = useMemo(() => [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b), [rooms]);
  const hkStatuses = useMemo(() => [...new Set(rooms.map((r) => r.status))].sort(), [rooms]);
  const otaChannels = useMemo(
    () => [...new Set(merged.spans.map((s) => s.otaChannel ?? s.channel ?? '').filter(Boolean))].sort(),
    [merged.spans]);
  // Whether Hostelworld bookings show total / collected / business price.
  // The badge itself does not depend on this — a Hostelworld bar is marked
  // whatever Configuration says, so the desk can always see where it came from.
  const hwSplitOn = useHostelworldSettings().data?.enabled === true;

  if (anyError && !loadedCount) {
    return (
      <div>
        <SectionHeader eyebrow="Reservations" title="Tape chart" />
        <Card tone="peach">
          <p className="text-[12px] font-bold">The chart could not be loaded.</p>
          <p className="text-[11px] text-dash-muted mt-1">{anyError.message}</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Reservations"
        title="Tape chart"
        action={
          // Three buttons, two selects and a "New reservation" is far wider than
          // a phone. Wrapping keeps the whole toolbar reachable; without it the
          // last controls sit off the right edge of a header that does not scroll.
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="secondary" title="Back a fortnight"
              onClick={() => { const el = scroller.current; if (el) el.scrollLeft -= 14 * CELL_W; }}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="secondary" onClick={() => scrollToDate(today)}
              title="Jump to today (T)">Today</Button>
            <Button size="sm" variant="secondary" title="Forward a fortnight"
              onClick={() => { const el = scroller.current; if (el) el.scrollLeft += 14 * CELL_W; }}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            {/* These two are a pair — column width and row height — and at
                110 + 140 they still sit side by side on a phone. Stretching
                either to full width would split the pair across two lines. */}
            <div className="w-[110px]">
              <Select value={String(CELL_W)} onChange={(v) => setCellWidth(Number(v))}
                options={DENSITIES} />
            </div>
            <div className="w-[140px]">
              <Select value={String(ROW_H)}
                onChange={(v) => setPrefs((p) => ({ ...p, rowHeight: Number(v) }))}
                options={ROW_HEIGHTS} />
            </div>
            <PermissionButton permission="reservations.write" size="sm" icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => navigate('new-reservation')}>
              New booking
            </PermissionButton>
          </div>
        }
      />

      {/* ── Controls ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative w-full sm:w-auto">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-dash-muted" />
          <input
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Find a guest or confirmation…"
            className="w-full sm:w-[240px] pl-9 pr-8 py-2 rounded-full border border-black/10 bg-white text-[12px]
                       focus:outline-none focus:ring-2 focus:ring-black/10"
          />
          {searching && (
            <button onClick={() => setFilters({ ...filters, search: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dash-muted hover:text-dash-text"
              title="Clear search">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <Button size="sm" variant={showFilters || filterCount ? 'primary' : 'secondary'}
          onClick={() => setShowFilters((v) => !v)}
          icon={<SlidersHorizontal className="w-3.5 h-3.5" />}>
          Filters{filterCount ? ` (${filterCount})` : ''}
        </Button>

        <div className="w-full sm:w-[140px]">
          <Select value={groupBy} onChange={(v) => setPrefs((p) => ({ ...p, groupBy: v as GroupBy }))}
            options={[
              { label: 'Group by type', value: 'roomType' },
              { label: 'Group by floor', value: 'floor' },
              { label: 'No grouping', value: 'none' },
            ]} />
        </div>
        <div className="w-full sm:w-[150px]">
          <Select value={sortBy} onChange={(v) => setPrefs((p) => ({ ...p, sortBy: v as SortBy }))}
            options={[
              { label: 'Sort by number', value: 'number' },
              { label: 'Sort by type', value: 'roomType' },
              { label: 'Sort by cleaning', value: 'housekeeping' },
            ]} />
        </div>

        <p className="text-[11px] text-dash-muted">
          {shownLanes.length} sellable unit{shownLanes.length === 1 ? '' : 's'}
          {/* Never let a filter hide part of the property silently — that is how
              a room gets sold twice. */}
          {hiddenLanes > 0 && (
            <>
              {' · '}
              <span className="text-status-warn font-bold">{hiddenLanes} hidden</span>
              {' '}
              <button className="underline hover:no-underline"
                onClick={() => setFilters({ ...NO_FILTERS })}>clear</button>
            </>
          )}
        </p>

        {/* Five colour keys in a row need about 360px; on a narrow phone they
            wrap onto a second line rather than running off the edge. */}
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap sm:ml-auto text-[10px] text-dash-muted">
          <Legend color="bg-dash-sky" label="Confirmed" />
          <Legend color="bg-dash-mint" label="In-house" />
          <Legend color="bg-dash-yellow" label="Tentative" />
          <Legend color="bg-dash-grey" label="Departed" />
          <Legend color="bg-red-100" label="Out of order" />
          <span className="flex items-center gap-1.5"><HostelworldBadge compact /> Hostelworld</span>
        </div>
      </div>

      {showFilters && (
        <Card className="mb-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FilterGroup label="Room type"
              options={roomTypes.map((t) => ({ value: t.id, label: t.name }))}
              selected={filters.roomTypeIds}
              onChange={(v) => setFilters({ ...filters, roomTypeIds: v })} />
            <FilterGroup label="Floor"
              options={floors.map((f) => ({ value: String(f), label: `Floor ${f}` }))}
              selected={filters.floors.map(String)}
              onChange={(v) => setFilters({ ...filters, floors: v.map(Number) })} />
            <FilterGroup label="Housekeeping"
              options={hkStatuses.map((s) => ({ value: s, label: s }))}
              selected={filters.housekeeping}
              onChange={(v) => setFilters({ ...filters, housekeeping: v })} />
            <FilterGroup label="Booking status"
              options={['Tentative', 'Confirmed', 'Guaranteed', 'Checked-in', 'Checked-out']
                .map((s) => ({ value: s, label: s }))}
              selected={filters.reservationStatus}
              onChange={(v) => setFilters({ ...filters, reservationStatus: v })} />
            <FilterGroup label="Source"
              options={['Direct', 'OTA', 'Corporate', 'Group', 'Walk-in'].map((s) => ({ value: s, label: s }))}
              selected={filters.sources}
              onChange={(v) => setFilters({ ...filters, sources: v })} />
            {/* Through a hub every booking's channel is BEDS24, so this filters
                on the OTA the booking actually came from. */}
            <FilterGroup label="Channel / OTA"
              options={otaChannels.map((c) => ({ value: c, label: c }))}
              selected={filters.otaChannels}
              onChange={(v) => setFilters({ ...filters, otaChannels: v })}
              empty="No channel bookings in view" />
          </div>
          <div className="flex items-center gap-4 mt-4 pt-3 border-t subtle-divider">
            <Toggle label="VIP only" checked={filters.vipOnly}
              onChange={(v) => setFilters({ ...filters, vipOnly: v })} />
            <Toggle label="Only rooms with bookings" checked={filters.occupiedOnly}
              onChange={(v) => setFilters({ ...filters, occupiedOnly: v })} />
            <button className="text-[11px] underline hover:no-underline ml-auto text-dash-muted"
              onClick={() => setFilters({ ...NO_FILTERS })}>
              Clear all filters
            </button>
          </div>
        </Card>
      )}

      {merged.unassigned.length > 0 && (
        <Card tone="peach" className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-status-warn" />
            <p className="text-[12px] font-bold">
              {merged.unassigned.length} reservation{merged.unassigned.length > 1 ? 's' : ''} without a room
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {merged.unassigned.slice(0, 12).map((u) => (
              <button
                key={u.reservationId}
                onClick={async () => {
                  try {
                    await assignRoom.mutateAsync({ id: u.reservationId, body: { auto: true } });
                    toast.success(`Room assigned to ${u.guest}`);
                  } catch (e) { toast.fail(e, 'No free room of that type'); }
                }}
                className="px-3 py-1.5 rounded-full bg-white border border-black/10 text-[11px] font-bold hover:bg-dash-bg"
                title="Click to auto-assign a room"
              >
                {u.guest} · {u.roomType} · {u.arrival}
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card padded={false} className="p-4 overflow-hidden">
        {!loadedCount ? (
          <Loading rows={8} />
        ) : (
          <div
            ref={scroller}
            data-testid="tape-scroller"
            onScroll={onScroll}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
            className="overflow-x-auto scroll-thin select-none"
            tabIndex={0}
          >
            <div style={{ width: LABEL_W + gridWidth, position: 'relative' }}>
              {/* Which month we are looking at. Scrolled five months out, the
                  day numbers alone tell you nothing about where you are. */}
              <div className="flex">
                <div style={STICKY_LABEL} className="shrink-0 bg-white z-30">
                  <p className="text-[11px] font-black">{monthSpan}</p>
                </div>
                <div style={{ width: gridWidth }} />
              </div>

              {/* Date header */}
              <div className="flex sticky top-0 bg-white z-10">
                <div style={STICKY_LABEL} className="shrink-0 bg-white z-30" />
                <div style={{ width: gridWidth, position: 'relative', height: 54 }}>
                  {visibleDates.map((d, i) => {
                    const agg = availByDate.get(d);
                    const soldOut = agg && agg.available <= 0;
                    const isToday = d === today;
                    return (
                      <div
                        key={d}
                        style={{ position: 'absolute', left: (startIndex + i) * CELL_W, width: CELL_W }}
                        className={`text-center ${isWeekend(d) ? 'bg-dash-bg/60' : ''} ${
                          isToday ? 'bg-amber-50 rounded-t-md' : ''}`}
                      >
                        <p className="text-[9px] text-dash-muted uppercase">{dayName(d)}</p>
                        <p className={`text-[13px] font-black leading-none ${isToday ? 'text-status-warn' : ''}`}>
                          {dayNumber(d)}
                        </p>
                        <p className="text-[8px] text-dash-muted">{monthName(d)}</p>
                        <p className={`text-[9px] font-bold mt-1 ${soldOut ? 'text-status-bad' : 'text-dash-muted'}`}>
                          {agg?.available ?? 0}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Occupancy strip */}
              <div className="flex items-center border-b subtle-divider pb-2 mb-2">
                <div style={STICKY_LABEL}
                  className="shrink-0 pr-3 bg-white z-30 flex items-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">Occupancy</p>
                </div>
                <div style={{ width: gridWidth, position: 'relative', height: 22 }}>
                  {visibleDates.map((d, i) => {
                    const agg = availByDate.get(d);
                    const denom = (agg?.physical ?? 0) - (agg?.blocked ?? 0);
                    const bp = denom > 0 ? ((agg?.sold ?? 0) / denom) * 10000 : 0;
                    return (
                      <div key={d} className="px-1"
                        style={{ position: 'absolute', left: (startIndex + i) * CELL_W, width: CELL_W }}>
                        <OccupancyBar bp={bp} />
                        <p className="text-[8px] text-center text-dash-muted mt-0.5">{Math.round(bp / 100)}%</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {filteredLanes.length === 0 && (
                <p className="text-[12px] text-dash-muted py-10 text-center">
                  {allLanes.length
                    ? 'Every room is hidden by the current filters.'
                    : 'No rooms configured — add them in Configuration.'}
                </p>
              )}

              {/* Group headers are driven by the *filtered* lanes, not the shown
                  ones, so a folded section keeps a header to unfold it with. */}
              {groupBy !== 'none' && groupOrder.map((group, gi) => {
                const st = groupStats.get(group) ?? { total: 0, sold: 0 };
                const isCollapsed = collapsed.has(group);
                const kind = kindOf(group);
                // A banner each time the kind changes — so "Dormitory beds" and
                // "Private rooms" are two visibly separate parts of the chart,
                // not one undifferentiated list of lines.
                const newKind = gi === 0 || kindOf(groupOrder[gi - 1]) !== kind;
                const ks = newKind ? kindStats(kind) : null;
                return (
                  <div key={group}>
                    {ks && (
                      <div className="flex" style={{ width: LABEL_W + gridWidth }}>
                        <div style={STICKY_LABEL}
                          className="shrink-0 bg-white z-20 pt-4 pb-1.5 pr-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-4 rounded-sm ${
                              kind === 'dorm' ? 'bg-dash-yellow' : 'bg-dash-sky'}`} />
                            <p className="text-[11px] font-black">
                              {kind === 'dorm' ? 'Dormitory beds' : 'Private rooms'}
                            </p>
                          </div>
                          <p className="text-[9px] text-dash-muted mt-0.5 ml-3.5 tabular-nums">
                            {ks.sold}/{ks.total} sold tonight · {ks.types} type{ks.types === 1 ? '' : 's'}
                          </p>
                        </div>
                        <div className="flex-1 self-end pb-2">
                          <span className="block h-px bg-black/10" />
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => toggleGroup(group)}
                      className="flex items-center w-full text-left"
                      style={{ width: LABEL_W + gridWidth }}
                      title={isCollapsed ? `Show ${group}` : `Hide ${group}`}
                    >
                      <span style={STICKY_LABEL}
                        className="shrink-0 bg-white z-20 flex items-center gap-1.5 py-1.5 pr-3">
                        <ChevronRight
                          className={`w-3 h-3 shrink-0 text-dash-muted transition-transform ${
                            isCollapsed ? '' : 'rotate-90'}`}
                        />
                        <span className="text-[10px] font-bold uppercase tracking-widest
                                         text-dash-muted truncate">
                          {group}
                        </span>
                        <span className="text-[9px] text-dash-muted tabular-nums shrink-0 ml-auto">
                          {st.sold}/{st.total}
                        </span>
                      </span>
                      <span className="h-px flex-1 bg-black/[0.04]" />
                    </button>
                    {!isCollapsed && filteredLanes.filter((l) => l.group === group)
                      .map((lane) => renderLane(lane))}
                  </div>
                );
              })}

              {groupBy === 'none' && shownLanes.map((lane) => renderLane(lane))}
            </div>
          </div>
        )}
      </Card>

      <p className="text-[10px] text-dash-muted mt-2">
        {longDate(rangeStart)} → {longDate(addDays(rangeStart, totalDays - 1))} loaded ·
        scroll sideways for more · drag, shift + wheel, arrow keys, or T for today
      </p>

      {hovered && (() => {
        const s = merged.spans.find((x) => x.reservationId === hovered);
        if (!s) return null;
        return (
          <Card className="mt-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <p className="text-[13px] font-bold">{s.guest}</p>
                <p className="text-[11px] text-dash-muted">{s.confirmation}</p>
              </div>
              <Pill tone={statusTone(s.status)}>{s.status}</Pill>
              {isHostelworldName(s.otaChannel) && <HostelworldBadge />}
              <span className="text-[11px] text-dash-muted">
                {longDate(s.arrival)} → {longDate(s.departure)} · {s.nights}n
              </span>
              <span className="text-[11px] text-dash-muted">{s.adults}A{s.children ? ` ${s.children}C` : ''}</span>
              <span className="text-[11px] text-dash-muted">
                {s.source}{s.otaChannel ? ` · ${s.otaChannel}` : s.channel ? ` · ${s.channel}` : ''}
              </span>
              {/* Total · what Hostelworld collected · business price, when the
                  split is on and the booking carries a collected figure. */}
              {hwSplitOn && isHostelworldName(s.otaChannel) && s.otaCollectedMinor != null
                ? (
                  <HostelworldMoney compact className="ml-auto" split={{
                    totalMinor: s.totalMinor,
                    collectedMinor: s.otaCollectedMinor,
                    businessMinor: Math.max(0, s.totalMinor - s.otaCollectedMinor),
                  }} />
                )
                : <span className="text-[12px] font-bold tabular-nums ml-auto">{money(s.totalMinor)}</span>}
            </div>
          </Card>
        );
      })()}
    </div>
  );

  /**
   * One line of the chart: a room, or a bed in a dorm.
   *
   * A closure rather than a component so it keeps the parent's scroll window
   * and filters without threading a dozen props through — and because a lane is
   * cheap: the expensive part, the day columns, is already virtualised.
   */
  function renderLane(lane: Lane) {
    const room = lane.room;
    const spans = spansByLane.get(lane.key) ?? [];
    const blocks = blocksByRoom.get(room.id) ?? [];
    return (
      <div key={lane.key}>
                    <div className="flex items-center relative" style={{ height: ROW_H }}>
                      <div style={STICKY_LABEL}
                        className="shrink-0 pr-3 pl-1 flex items-center gap-2 bg-white z-20
                                   border-r border-black/[0.06]">
                        {/* A dorm bed and a private room are different things to
                            sell, so they do not look the same in the margin. */}
                        <span className={`shrink-0 rounded-sm ${lane.bedId
                          ? 'w-1 h-4 bg-dash-yellow' : 'w-1 h-4 bg-dash-sky'}`} />
                        <span className={`font-black shrink-0 ${
                          lane.bedId ? 'text-[10px]' : 'text-[12px]'}`}>
                          {lane.label}
                        </span>
                        <span className="text-[9px] text-dash-muted truncate flex-1">{lane.sublabel}</span>
                        {!lane.bedId && (
                          <Pill tone={statusTone(lane.status)}>
                            {lane.status.replace('Vacant ', 'V.').replace('Occupied ', 'O.')}
                          </Pill>
                        )}
                      </div>

                      <div className="relative shrink-0" style={{ width: gridWidth, height: ROW_H }}>
                        {visibleDates.map((d, i) => (
                          <div
                            key={d}
                            className={`absolute top-0 bottom-0 border-l border-black/[0.04] ${
                              d === today ? 'bg-amber-50/70' : isWeekend(d) ? 'bg-dash-bg/40' : ''}`}
                            style={{ left: (startIndex + i) * CELL_W, width: CELL_W }}
                          />
                        ))}

                        {blocks.map((b) => {
                          const offset = nightsBetween(rangeStart, b.from);
                          const width = Math.max(1, nightsBetween(b.from, b.to));
                          if (offset + width < startIndex || offset > endIndex) return null;
                          return (
                            <div
                              key={b.id}
                              className="absolute top-1.5 bottom-1.5 rounded-lg bg-red-100 border border-red-200 flex items-center px-2"
                              style={{ left: offset * CELL_W + 2, width: width * CELL_W - 4 }}
                              title={`${b.kind}: ${b.reason ?? ''}`}
                            >
                              <Ban className="w-3 h-3 text-status-bad shrink-0" />
                              <span className="text-[9px] font-bold text-status-bad ml-1 truncate">{b.kind}</span>
                            </div>
                          );
                        })}

                        {spans.map((s) => {
                          const offset = nightsBetween(rangeStart, s.from);
                          const width = Math.max(1, nightsBetween(s.from, s.to));
                          // Only draw what is near the viewport.
                          if (offset + width < startIndex || offset > endIndex) return null;
                          const tone =
                            s.status === 'Checked-in' ? 'bg-dash-mint border-emerald-200'
                              : s.status === 'Tentative' ? 'bg-dash-yellow border-amber-200'
                                : s.status === 'Checked-out' ? 'bg-dash-grey border-black/10'
                                  : 'bg-dash-sky border-sky-200';
                          // A search dims what does not match rather than
                          // removing it — "which room is she in?" needs the
                          // rooms around the answer to still be there.
                          const dim = searching && !spanMatchesSearch(s, filters.search);
                          const hit = searching && !dim;
                          // A Hostelworld bar carries its own mark: an orange
                          // edge and a tag. The status colour is untouched, so
                          // in-house, tentative and confirmed still read as before.
                          const hw = isHostelworldName(s.otaChannel);
                          const hwSplit = hw && hwSplitOn && s.otaCollectedMinor != null
                            ? ` · HW collected ${money(s.otaCollectedMinor)}`
                              + ` · business ${money(Math.max(0, s.totalMinor - s.otaCollectedMinor))}`
                            : '';
                          return (
                            <button
                              key={s.reservationId}
                              onClick={() => navigate('guest-dashboard', { reservationId: s.reservationId })}
                              onMouseEnter={() => setHovered(s.reservationId)}
                              onMouseLeave={() => setHovered(null)}
                              className={`absolute top-1.5 bottom-1.5 rounded-lg border px-2 flex items-center
                                          overflow-hidden hover:shadow-md transition-all ${tone}
                                          ${hw ? 'border-l-[3px] border-l-orange-500' : ''}
                                          ${dim ? 'opacity-25' : ''}
                                          ${hit ? 'ring-2 ring-status-warn shadow-md z-10' : ''}`}
                              style={{ left: offset * CELL_W + 2, width: width * CELL_W - 4 }}
                              title={`${s.guest} · ${s.confirmation} · ${s.arrival} → ${s.departure}`
                                + `${hw ? ' · Hostelworld' : ''} · ${money(s.totalMinor)}${hwSplit}`}
                            >
                              {s.vip && <span className="w-1.5 h-1.5 rounded-full bg-black mr-1.5 shrink-0" />}
                              {hw && <HostelworldBadge compact className="mr-1.5" />}
                              <span className="text-[10px] font-bold truncate">{s.guest}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
      </div>
    );
  }
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded ${color} border border-black/10`} />
      {label}
    </span>
  );
}

function FilterGroup({ label, options, selected, onChange, empty }: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  empty?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1.5">{label}</p>
      {options.length === 0 ? (
        <p className="text-[11px] text-dash-muted italic">{empty ?? 'Nothing to filter'}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <button
                key={o.value}
                onClick={() => onChange(on ? selected.filter((v) => v !== o.value) : [...selected, o.value])}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                  on ? 'bg-dash-text text-white border-transparent'
                    : 'bg-white border-black/10 hover:bg-dash-bg'}`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
