# Tape chart — continuous scrolling and real controls

The tape chart is the screen a front desk lives in. Today it shows a **fixed
window** — 7, 14 or 30 days — and you page through time with two arrow buttons.
Two things are wrong with that:

- **You cannot see a stay in context.** A three-week booking straight through a
  window boundary is two disconnected bars in two separate views, and the only
  way to follow it is to click forward and lose your place.
- **There is one filter.** Room type. Everything else a receptionist actually
  asks — *which rooms are dirty, who is unassigned, where is the Hostelworld
  booking, show me only floor 2* — has to be answered on another screen.

This document is the checklist. Items are built one at a time, in order.

---

## What "unlimited scrolling" has to mean

Scrolling sideways forever is easy to fake and hard to get right. Four problems
have to be solved together, or the result is worse than paging:

**1 · The server will not return unlimited days.**
`/api/calendar/tape` refuses a range over 400 days ([rates.ts:28](../apps/pms-api/src/routes/rates.ts#L28)),
and it should — one query returning five years of nights would lock the database
for everyone else. So the client fetches in **chunks** and stitches them.

**2 · Stitching clips stays at the seam.**
The endpoint computes a span as `MIN(date)`/`MAX(date)` *within the window it was
asked about*. A stay from 1 → 20 August, fetched as two chunks, comes back
clipped to each chunk and would draw as two touching bars with a hairline
between them. Chunks must be merged per lane by taking the earliest start and
latest end, not concatenated.

**3 · Growing leftward moves the content under the cursor.**
Prepending a month to the left shifts everything right by exactly that width. If
`scrollLeft` is not corrected in the same frame, the chart jumps and the user
loses the day they were looking at. This is the defect that makes most infinite
scrollers unpleasant.

**4 · The DOM does not survive a year.**
35 lanes × 365 days is 12,775 grid cells, plus a background div each. Rendering
only the visible slice is not an optimisation here — it is what makes the
feature possible at all.

---

## The checklist

### Scrolling

- [x] **T1 · Chunked date window.** Replace the fixed `days` window with a range
      that grows. Fetch in fixed chunks (60 days) keyed by chunk start, so each
      chunk is cached independently and revisiting a month costs nothing.
- [x] **T2 · Merge chunks correctly.** Stitch rooms, beds, spans, blocks and
      availability across chunks. Spans merge per `(lane, reservation)` by
      earliest start / latest end. A stay crossing a seam draws as one bar.
- [x] **T3 · Extend on scroll, without jumping.** When the viewport comes within
      one chunk of either edge, load the next chunk. On a left-side extension,
      correct `scrollLeft` by the inserted width in the same layout pass so the
      view does not move.
- [x] **T4 · Virtualise the X axis.** Render only the visible date columns plus
      an overscan margin. Lanes stay fully rendered — a property has tens of
      rooms, not thousands, and vertical virtualisation would cost more than it
      saves.
- [x] **T5 · Natural panning.** Shift + wheel and trackpad horizontal gestures
      scroll time. Arrow keys pan by a day, Page Up/Down by a screen, `T` returns
      to today. Drag-to-pan on empty grid.
- [x] **T6 · Keep "today" findable.** A permanent marker on the current business
      date, and a "Today" control that scrolls back to it rather than resetting
      the range.

### Controls and filters

- [x] **T7 · Filter bar.** Replace the lone room-type dropdown with a bar that
      collapses to a single "Filters (3)" button when narrow:
      - room type (multi-select)
      - floor / wing
      - housekeeping status (Vacant Clean, Occupied Dirty, …)
      - reservation status (Tentative / Confirmed / In-house / Departed)
      - source and OTA — now that a Beds24 booking records which OTA it came
        from, "show me only Hostelworld arrivals" is a question with an answer
      - VIP only, unassigned only
- [x] **T8 · Search.** Free text over guest name and confirmation number.
      Matching bars are highlighted and everything else dims, rather than lanes
      disappearing — you need to see the room the match is *in*.
- [x] **T9 · Density and zoom.** Cell width compact (30px) / normal (46px) /
      wide (64px), and row height tight / normal / tall. Changing the width
      keeps the same **date** at the left edge rather than the same pixel —
      otherwise zooming out throws you months away from what you were reading.
- [x] **T10 · Group and sort lanes.** Collapsible sections by room type or
      floor, each header carrying a "sold tonight / total" count that stays
      visible while the section is folded. Sort by room number (numerically, so
      10 follows 9), room type, or housekeeping status.
- [x] **T11 · Remember the setup.** Filters, density, grouping and the last
      viewed date persist per user in local storage. A receptionist should not
      re-pick their filters after every refresh.
- [x] **T12 · Say what is filtered.** When filters hide lanes, the header states
      how many are hidden and offers one click to clear — a chart that silently
      omits half the property is how a room gets sold twice.

### Verification

- [x] **T13 · `scripts/tapechart-check.ts`** — 52 checks, registered in
      `verify-all.ts`. Chunk merging produces one span for a stay crossing a
      seam; a stay wholly inside one chunk is unaffected; two beds in one dorm
      stay separate; merged availability matches a single wide query cell for
      cell; filters compose; and no single request can breach the 400-day cap.
- [x] **T14 · `scripts/calendar-ui.ts`** — 27 checks driving the real screen in
      a real browser, because the arithmetic being right does not mean the
      screen is. It measures the viewport before and after a left-side
      extension, which is the only way to catch the chart lurching; confirms a
      lane renders far fewer columns than the days loaded; and folds, filters,
      searches and zooms while watching for console errors.

      **It earned its place immediately.** It caught the "N hidden" warning
      being permanently zero — `lanes` was built from already-filtered rooms, so
      the count that exists to stop the chart silently showing half a property
      could never fire. Unit tests could not have seen that; it only appears
      when something actually filters.

---

## Round two — what continuous scrolling broke

Making time scroll without end exposed a fault that a 14-day window had been
hiding, and it is the worst kind: the screen looks *empty* rather than broken.

- [x] **T15 · The room labels must not scroll away.** The name column lived
      inside the horizontally scrolling area, so scrolling to January took the
      room numbers with it. Measured at `labelX: -1864` against a viewport
      starting at 296 — nearly two thousand pixels off the left of the screen.
      With a fixed fortnight there was almost nothing to scroll and the bug
      never showed; with unlimited scrolling it means the chart appears to have
      no rooms at all. The label column is now pinned with `position: sticky`,
      as are the date header's corner and the occupancy row's label.
- [x] **T16 · Dorms and private rooms are separated, and said out loud.** A bed
      and a room are not the same unit and must not read as one list: a dorm
      line sells *one bed* of eight, a room line sells the whole room. The chart
      now has a banner for each — "Dormitory beds" and "Private rooms" — with
      its own totals, and each room type beneath it as its own foldable section.
- [x] **T17 · Labels say what the unit actually is.** A dorm lane reads
      `BEDI-1-03 · bed 3/8 · bottom · room 1/2` — which bed of how many, which
      bunk, and which physical room — instead of an opaque code. The room is
      only named when the type has more than one; on a single-room dorm it is
      noise in a column where space is scarce. The column widened to fit,
      because truncating to `bed 3/8 · bo…` costs the reader the one thing the
      line was labelled with.
- [x] **T18 · The chart says where it is.** A month band above the dates, so a
      chart scrolled five months out still tells you it is looking at January.

---

## Deliberately not doing

**Dragging a booking to another room.** The tape chart is the obvious place for
it and it is a genuinely separate feature: it needs a move endpoint, an
availability re-check, a folio consequence when the rate differs, and an undo.
Bolting it onto a scrolling change would produce a room move nobody can reverse.

**Vertical infinite scroll.** Properties have tens of rooms. The cost is real
and the benefit is not.
