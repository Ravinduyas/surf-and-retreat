// Diagrams for the user manual.
//
// Drawn as inline SVG rather than shipped as images for three reasons that all
// matter to a manual: they stay sharp at any size, they re-colour themselves in
// a dark theme because they use the app's own CSS variables, and — the one that
// actually decides it — they cannot go stale in the way a screenshot does. A
// screenshot of a screen that has since gained a column is worse than no
// picture at all, because the reader trusts it.
//
// Every diagram here shows a *mechanism*: where a booking comes from, what
// order things happen in, what state something can be in. None of them is
// decoration, and none of them is a picture of a button.
import type { ReactNode } from 'react';

/* ── shared bits ─────────────────────────────────────────── */

const INK = 'var(--dash-ink, #1c1917)';
const MUTED = 'var(--dash-muted, #6f6a63)';
const LINE = 'rgba(0,0,0,.14)';

function Arrow({ id }: { id: string }) {
  return (
    <defs>
      <marker id={id} viewBox="0 0 10 10" refX="9" refY="5"
        markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={MUTED} />
      </marker>
    </defs>
  );
}

function Box({ x, y, w, h, label, sub, tone = 'plain' }: {
  x: number; y: number; w: number; h: number;
  label: string; sub?: string; tone?: 'plain' | 'accent' | 'soft';
}) {
  const fill = tone === 'accent' ? 'rgba(180,73,31,.10)'
    : tone === 'soft' ? 'rgba(0,0,0,.035)' : 'transparent';
  const stroke = tone === 'accent' ? 'rgba(180,73,31,.45)' : LINE;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="10" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <text x={x + w / 2} y={sub ? y + h / 2 - 3 : y + h / 2 + 4}
        textAnchor="middle" fontSize="12" fontWeight="700" fill={INK}>{label}</text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 13} textAnchor="middle"
          fontSize="10" fill={MUTED}>{sub}</text>
      )}
    </g>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return <p className="text-[11px] text-dash-muted leading-relaxed mt-2">{children}</p>;
}

function Frame({ viewBox, children, caption }: {
  viewBox: string; children: ReactNode; caption: ReactNode;
}) {
  return (
    <figure className="my-4">
      <div className="rounded-task border border-black/10 bg-white/50 p-3 overflow-x-auto">
        <svg viewBox={viewBox} className="w-full min-w-[520px]" role="img">{children}</svg>
      </div>
      <figcaption><Caption>{caption}</Caption></figcaption>
    </figure>
  );
}

/* ── 1. Where bookings come from ─────────────────────────── */

export function BookingSourcesDiagram() {
  return (
    <Frame viewBox="0 0 700 250"
      caption={<>
        Every bed is sold from one pool. A bed taken on your own page is a bed the OTAs
        can no longer sell, because the PMS recalculates availability and pushes the new
        number out within seconds. This is the whole reason a channel manager exists.
      </>}>
      <Arrow id="a1" />
      {/* sources */}
      <Box x={10} y={20} w={150} h={46} label="Your booking page" sub="/book — no commission" tone="accent" />
      <Box x={10} y={80} w={150} h={46} label="Booking.com, etc." sub="via the channel manager" />
      <Box x={10} y={140} w={150} h={46} label="Front desk" sub="walk-in, phone, email" />

      {/* arrows in */}
      <path d="M 165 43 L 255 118" stroke={MUTED} strokeWidth="1.5" fill="none" markerEnd="url(#a1)" />
      <path d="M 165 103 L 255 120" stroke={MUTED} strokeWidth="1.5" fill="none" markerEnd="url(#a1)" />
      <path d="M 165 163 L 255 130" stroke={MUTED} strokeWidth="1.5" fill="none" markerEnd="url(#a1)" />

      {/* the pms */}
      <Box x={262} y={80} w={160} h={90} label="The Fun Bunk PMS" sub="one pool of beds" tone="accent" />
      <text x={342} y={196} textAnchor="middle" fontSize="10" fill={MUTED}>
        availability = beds − sold − held − blocked
      </text>

      {/* arrows out */}
      <path d="M 425 110 L 520 60" stroke={MUTED} strokeWidth="1.5" fill="none" markerEnd="url(#a1)" />
      <path d="M 425 140 L 520 140" stroke={MUTED} strokeWidth="1.5" fill="none" markerEnd="url(#a1)" />

      <Box x={527} y={38} w={160} h={46} label="Rates &amp; availability" sub="pushed out to the OTAs" />
      <Box x={527} y={117} w={160} h={46} label="Front desk screens" sub="arrivals, tape chart" />
    </Frame>
  );
}

/* ── 2. The day ──────────────────────────────────────────── */

export function DayFlowDiagram() {
  const stops = [
    { label: 'Arrivals', sub: 'who is due in' },
    { label: 'Check-in', sub: 'give them a bed' },
    { label: 'In-house', sub: 'guests staying' },
    { label: 'Departures', sub: 'settle the folio' },
    { label: 'Check-out', sub: 'bed goes dirty' },
    { label: 'Night audit', sub: 'roll the date' },
  ];
  return (
    <Frame viewBox="0 0 700 120"
      caption={<>
        The front desk day, left to right. Only the night audit moves the business date —
        it posts the night&rsquo;s room charges, flags no-shows, freezes the day&rsquo;s
        statistics and advances to tomorrow, all in one transaction.
      </>}>
      <Arrow id="a2" />
      {stops.map((s, i) => (
        <g key={s.label}>
          <Box x={8 + i * 115} y={30} w={100} h={48} label={s.label} sub={s.sub}
            tone={i === 5 ? 'accent' : 'plain'} />
          {i < stops.length - 1 && (
            <path d={`M ${110 + i * 115} 54 L ${120 + i * 115} 54`}
              stroke={MUTED} strokeWidth="1.5" markerEnd="url(#a2)" />
          )}
        </g>
      ))}
    </Frame>
  );
}

/* ── 3. Reservation status lifecycle ─────────────────────── */

export function StatusDiagram() {
  return (
    <Frame viewBox="0 0 700 220"
      caption={<>
        A booking from your own page is the only one that arrives <em>awaiting confirmation</em>.
        It still holds its bed — the bed is off the market from the moment the guest books — but
        you decide whether to accept it. If nobody does within the hold window, it cancels itself
        and the bed goes back on sale everywhere.
      </>}>
      <Arrow id="a3" />
      <Box x={10} y={88} w={130} h={46} label="Awaiting" sub="holds a bed, no room" tone="accent" />
      <path d="M 145 100 L 215 70" stroke={MUTED} strokeWidth="1.5" markerEnd="url(#a3)" />
      <path d="M 145 122 L 215 160" stroke={MUTED} strokeWidth="1.5" markerEnd="url(#a3)" />
      <text x={175} y={78} fontSize="9" fill={MUTED}>you confirm</text>
      <text x={150} y={158} fontSize="9" fill={MUTED}>hold runs out</text>

      <Box x={220} y={45} w={120} h={46} label="Confirmed" sub="has a room or bed" />
      <Box x={220} y={140} w={120} h={46} label="Cancelled" sub="bed back on sale" />

      <path d="M 345 68 L 405 68" stroke={MUTED} strokeWidth="1.5" markerEnd="url(#a3)" />
      <Box x={410} y={45} w={120} h={46} label="Checked-in" sub="guest is here" />
      <path d="M 535 68 L 595 68" stroke={MUTED} strokeWidth="1.5" markerEnd="url(#a3)" />
      <Box x={600} y={45} w={90} h={46} label="Checked-out" sub="folio settled" />

      <text x={10} y={30} fontSize="11" fontWeight="700" fill={INK}>From your booking page</text>
      <text x={220} y={30} fontSize="11" fontWeight="700" fill={MUTED}>
        OTA and front-desk bookings start here
      </text>
    </Frame>
  );
}

/* ── 4. Where a price comes from ─────────────────────────── */

export function PricingChainDiagram() {
  const steps = [
    'Rate calendar cell', 'Parent plan ± offset', 'Plan base rate', 'Room type default',
  ];
  return (
    <Frame viewBox="0 0 700 170"
      caption={<>
        The first one that has an answer wins. Then occupancy supplements, length-of-stay
        pricing, yield rules, promotions and tax are applied on top, and finally the
        channel&rsquo;s own price multiplier. Everything quotes from this one chain — the
        booking page, the front desk and the OTAs cannot disagree about a price.
      </>}>
      <Arrow id="a4" />
      {steps.map((s, i) => (
        <g key={s}>
          <Box x={10 + i * 172} y={20} w={155} h={44} label={`${i + 1}`} sub={s}
            tone={i === 0 ? 'accent' : 'soft'} />
          {i < steps.length - 1 && (
            <path d={`M ${167 + i * 172} 42 L ${180 + i * 172} 42`}
              stroke={MUTED} strokeWidth="1.5" markerEnd="url(#a4)" />
          )}
        </g>
      ))}
      <text x={10} y={95} fontSize="11" fontWeight="700" fill={INK}>then, on top:</text>
      {['occupancy', 'length of stay', 'yield rules', 'promotions', 'tax', 'channel multiplier']
        .map((s, i) => (
          <g key={s}>
            <rect x={10 + i * 113} y={108} width={104} height={28} rx="14"
              fill="rgba(0,0,0,.035)" stroke={LINE} />
            <text x={62 + i * 113} y={126} textAnchor="middle" fontSize="10" fill={MUTED}>{s}</text>
          </g>
        ))}
    </Frame>
  );
}

/* ── 5. Money ────────────────────────────────────────────── */

export function FolioDiagram() {
  return (
    <Frame viewBox="0 0 700 200"
      caption={<>
        A folio is a ledger, never a stored total. Its balance is always the sum of its
        lines that have not been voided, recalculated every time you look — which is why
        it cannot drift, and why a posting is voided rather than deleted.
      </>}>
      <Arrow id="a5" />
      <Box x={10} y={20} w={150} h={40} label="Room charge" sub="posted by night audit" tone="soft" />
      <Box x={10} y={68} w={150} h={40} label="Extras" sub="bar, laundry, late check-out" tone="soft" />
      <Box x={10} y={116} w={150} h={40} label="Tax" sub="per the tax rules" tone="soft" />

      <path d="M 165 40 L 245 85" stroke={MUTED} strokeWidth="1.5" markerEnd="url(#a5)" />
      <path d="M 165 88 L 245 90" stroke={MUTED} strokeWidth="1.5" markerEnd="url(#a5)" />
      <path d="M 165 136 L 245 100" stroke={MUTED} strokeWidth="1.5" markerEnd="url(#a5)" />

      <Box x={250} y={60} w={170} h={70} label="Guest folio" sub="a list of lines" tone="accent" />

      <path d="M 425 95 L 495 95" stroke={MUTED} strokeWidth="1.5" markerEnd="url(#a5)" />
      <Box x={500} y={45} w={190} h={40} label="Balance = sum of lines" />
      <Box x={500} y={100} w={190} h={40} label="Payments reduce it" sub="cash, card, transfer" />
      <text x={250} y={155} fontSize="10" fill={MUTED}>
        every amount is whole cents — never a decimal fraction
      </text>
    </Frame>
  );
}

/* ── 6. The channel connection ───────────────────────────── */

export function ChannelSetupDiagram() {
  const steps = [
    { n: '1', label: 'Invite code', sub: 'made in Beds24' },
    { n: '2', label: 'Refresh token', sub: 'stored here, encrypted' },
    { n: '3', label: 'Access token', sub: 'minted as needed, 24h' },
    { n: '4', label: 'Rooms matched', sub: 'both sides paired' },
  ];
  return (
    <Frame viewBox="0 0 700 150"
      caption={<>
        You only ever handle the invite code. It is exchanged once, straight away, for a
        long-lived refresh token — the code itself is never stored. Everything after that
        happens without you: the short-lived access token on every call is minted and
        renewed automatically.
      </>}>
      <Arrow id="a6" />
      {steps.map((s, i) => (
        <g key={s.n}>
          <Box x={10 + i * 172} y={30} w={155} h={52} label={s.label} sub={s.sub}
            tone={i < 2 ? 'accent' : 'soft'} />
          <text x={16 + i * 172} y={24} fontSize="10" fontWeight="700" fill={MUTED}>step {s.n}</text>
          {i < steps.length - 1 && (
            <path d={`M ${168 + i * 172} 56 L ${178 + i * 172} 56`}
              stroke={MUTED} strokeWidth="1.5" markerEnd="url(#a6)" />
          )}
        </g>
      ))}
      <text x={10} y={112} fontSize="10" fill={MUTED}>
        Nothing is pushed until every room is matched — an unmatched room has nowhere to send its prices.
      </text>
    </Frame>
  );
}

/* ── 7. Dorm beds vs private rooms ───────────────────────── */

export function DormDiagram() {
  return (
    <Frame viewBox="0 0 700 180"
      caption={<>
        This is the difference that makes a hostel PMS different from a hotel one. A private
        room is sold whole — one booking takes the room. A dorm is sold by the bed, so four
        guests in one dorm are four reservations that happen to share a room number.
      </>}>
      <text x={10} y={22} fontSize="11" fontWeight="700" fill={INK}>Private room — sold whole</text>
      <rect x={10} y={32} width={310} height={52} rx="10" fill="rgba(0,0,0,.035)" stroke={LINE} />
      <text x={24} y={62} fontSize="12" fontWeight="700" fill={INK}>Room 101</text>
      <rect x={110} y={42} width={200} height={32} rx="8" fill="rgba(180,73,31,.12)" stroke="rgba(180,73,31,.45)" />
      <text x={210} y={62} textAnchor="middle" fontSize="11" fill={INK}>one booking · 2 guests</text>

      <text x={370} y={22} fontSize="11" fontWeight="700" fill={INK}>Dorm — sold by the bed</text>
      <rect x={370} y={32} width={320} height={130} rx="10" fill="rgba(0,0,0,.035)" stroke={LINE} />
      <text x={384} y={52} fontSize="12" fontWeight="700" fill={INK}>Room 202 · 6 beds</text>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const sold = i < 4;
        return (
          <g key={i}>
            <rect x={384 + (i % 3) * 100} y={62 + Math.floor(i / 3) * 46} width={92} height={36} rx="8"
              fill={sold ? 'rgba(180,73,31,.12)' : 'transparent'}
              stroke={sold ? 'rgba(180,73,31,.45)' : LINE} />
            <text x={430 + (i % 3) * 100} y={85 + Math.floor(i / 3) * 46} textAnchor="middle"
              fontSize="10" fill={sold ? INK : MUTED}>
              {sold ? `booking ${i + 1}` : 'free'}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}

/* ── 8. A screen map ─────────────────────────────────────── */

export function ScreenMapDiagram() {
  return (
    <Frame viewBox="0 0 700 260"
      caption={<>
        Every screen sits in the same frame. The sidebar is where you are, the top bar is
        what is true right now — the property, the business date, whether the channels are
        live — and the strip along the bottom is the fastest route to the four things a
        receptionist does most.
      </>}>
      <rect x={6} y={6} width={688} height={248} rx="12" fill="transparent" stroke={LINE} strokeWidth="1.5" />

      {/* sidebar */}
      <rect x={14} y={14} width={120} height={232} rx="9" fill="rgba(0,0,0,.05)" stroke={LINE} />
      <text x={74} y={38} textAnchor="middle" fontSize="11" fontWeight="700" fill={INK}>Sidebar</text>
      <text x={74} y={54} textAnchor="middle" fontSize="9" fill={MUTED}>every screen</text>
      {['Dashboard', 'Calendar', 'Front Office', 'Reservations', 'Rates', 'Booking Page',
        'Channel Manager', 'Cashier', 'Configuration'].map((s, i) => (
          <text key={s} x={26} y={78 + i * 17} fontSize="9.5" fill={MUTED}>{s}</text>
        ))}

      {/* top bar */}
      <rect x={144} y={14} width={542} height={40} rx="9" fill="rgba(180,73,31,.08)" stroke="rgba(180,73,31,.35)" />
      <text x={158} y={31} fontSize="10" fontWeight="700" fill={INK}>The Fun Bunk</text>
      <text x={158} y={45} fontSize="9" fill={MUTED}>property</text>
      <text x={268} y={31} fontSize="10" fontWeight="700" fill={INK}>2026-09-20</text>
      <text x={268} y={45} fontSize="9" fill={MUTED}>business date — only the night audit moves it</text>
      <text x={560} y={31} fontSize="10" fontWeight="700" fill={INK}>Channels</text>
      <text x={560} y={45} fontSize="9" fill={MUTED}>live / not connected</text>

      {/* body */}
      <rect x={144} y={62} width={542} height={140} rx="9" fill="transparent" stroke={LINE} strokeDasharray="4 4" />
      <text x={415} y={128} textAnchor="middle" fontSize="12" fontWeight="700" fill={MUTED}>
        the screen you chose
      </text>
      <text x={415} y={146} textAnchor="middle" fontSize="9.5" fill={MUTED}>
        tabs across the top of it split one subject into views
      </text>

      {/* quick bar */}
      <rect x={260} y={212} width={310} height={34} rx="17" fill="rgba(0,0,0,.05)" stroke={LINE} />
      {['Home', 'Check-in', 'New', 'Housekeeping', 'Cashier'].map((s, i) => (
        <text key={s} x={295 + i * 62} y={233} textAnchor="middle" fontSize="9" fill={MUTED}>{s}</text>
      ))}
    </Frame>
  );
}
