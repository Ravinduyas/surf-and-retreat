// The user manual's content.
//
// Written for whoever is standing at the desk of The Fun Bunk, not for whoever
// wrote the code. Three rules it tries to keep:
//
//   · Say what a thing is *for* before saying which button does it. Somebody
//     who understands why a business date exists can work out the rest; a list
//     of buttons teaches nothing.
//   · Name the trap. Every section that has a way to lose money or double-sell
//     a bed says so plainly, because that is what somebody needs at 2am.
//   · Never describe pixels. Layouts change and a manual that describes them
//     rots. It describes the model, and the diagrams show the mechanism.
//
// Kept separate from the screen that renders it so the writing can be edited
// without touching any React.
import type { ReactNode } from 'react';
import type { ScreenName } from '../types';
import {
  BookingSourcesDiagram, DayFlowDiagram, StatusDiagram, PricingChainDiagram,
  FolioDiagram, ChannelSetupDiagram, DormDiagram, ScreenMapDiagram,
} from './diagrams';

export interface Task {
  /** What somebody is trying to do, in their words. */
  title: string;
  steps: ReactNode[];
  /** The thing that goes wrong if they do it slightly differently. */
  warning?: ReactNode;
}

export interface Topic {
  id: string;
  title: string;
  /** One line, shown in the contents list. */
  summary: string;
  /** Which sidebar screen this is about, so the manual can open it. */
  screen?: ScreenName;
  body: ReactNode;
  tasks?: Task[];
  /** Words somebody might search for that are not in the title. */
  keywords?: string[];
}

export interface Section {
  id: string;
  title: string;
  topics: Topic[];
}

/** Shorthand for a term-and-meaning list, used all through the manual. */
export function Terms({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="space-y-2 my-3">
      {items.map(([term, meaning]) => (
        <div key={term} className="grid sm:grid-cols-[160px_1fr] gap-1 sm:gap-3">
          <dt className="text-[12px] font-bold">{term}</dt>
          <dd className="text-[12px] text-dash-muted leading-relaxed">{meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-relaxed mb-3">{children}</p>;
}

function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return (
    <div className={`rounded-xl p-3 my-3 text-[12px] leading-relaxed border ${
      tone === 'warn'
        ? 'border-status-warn/30 bg-status-warn/[.07]'
        : 'border-black/10 bg-black/[.03]'}`}>
      {children}
    </div>
  );
}

export const MANUAL: Section[] = [
  /* ══════════════════════════════════════════ getting started ══ */
  {
    id: 'start',
    title: 'Getting started',
    topics: [
      {
        id: 'what-this-is',
        title: 'What this system is',
        summary: 'The shape of the whole thing, in one page.',
        keywords: ['overview', 'introduction', 'basics'],
        body: (
          <>
            <P>
              This is the system of record for The Fun Bunk. Every bed, every booking, every
              payment and every night&rsquo;s takings live in one database on this machine.
              There is no cloud service behind it and nothing to log in to somewhere else.
            </P>
            <P>
              The single idea everything else follows from: <strong>there is one pool of
              beds</strong>. A bed sold on your own booking page, a bed sold on Booking.com and
              a bed given to somebody at the desk all come out of the same pool, and the
              moment one goes the others can no longer have it.
            </P>
            <BookingSourcesDiagram />
            <P>
              If you only remember one thing from this manual, remember that. Almost every
              serious mistake a property can make with a PMS is a version of two things
              believing they own the same bed.
            </P>
          </>
        ),
      },
      {
        id: 'screen-layout',
        title: 'Finding your way around',
        summary: 'What the sidebar, the top bar and the bottom strip are for.',
        keywords: ['navigation', 'menu', 'sidebar', 'layout'],
        body: (
          <>
            <P>Every screen sits in the same frame, so once you know the frame you know where
              everything is.</P>
            <ScreenMapDiagram />
            <Terms items={[
              ['Business date', <>The day the property is trading, shown in the top bar. It is
                <em> not</em> today&rsquo;s calendar date and only the night audit moves it. If
                it is behind, check-ins start being refused — see <strong>The night audit</strong>.</>],
              ['Channels', <>Whether distribution is live. &ldquo;Not connected&rdquo; means your
                rooms are sold only here and on your own booking page.</>],
              ['⌘K / Ctrl-K', <>Search from anywhere — a guest name, a confirmation number, a
                room number or a company.</>],
              ['The bottom strip', <>The four things a receptionist does most, one tap away on a
                phone or a tablet.</>],
            ]} />
          </>
        ),
      },
      {
        id: 'first-week',
        title: 'Your first week',
        summary: 'The order to do things in, so nothing blocks anything else.',
        keywords: ['setup', 'checklist', 'onboarding'],
        body: (
          <>
            <P>Each step needs the one before it, so this order saves redoing work.</P>
            <Terms items={[
              ['1. Room types', <>What you sell: the two private rooms and the four dorms.
                Configuration → Room types.</>],
              ['2. Rooms and beds', <>Your actual floor plan. A dorm&rsquo;s beds are created with
                it — six beds is six things that can be sold.</>],
              ['3. Rates', <>A price per room type per night. Nothing can be quoted or sold on a
                date with no rate. Rates &amp; Inventory.</>],
              ['4. Taxes', <>If you charge any. They compound in the order you set.</>],
              ['5. Your booking page', <>Already live. Set the deposit and the hold window, then
                share the link. Booking Page.</>],
              ['6. The channel manager', <>Last, deliberately. Connecting it publishes whatever
                the four steps above say, so they want to be right first.</>],
              ['7. Staff logins', <>One account each, never a shared one. Administration.</>],
            ]} />
            <Note tone="warn">
              Step 6 last is not a style preference. Connecting distribution before your rates are
              right publishes the wrong prices to every OTA you sell on, and they are live
              immediately.
            </Note>
          </>
        ),
      },
    ],
  },

  /* ══════════════════════════════════════════════ front desk ══ */
  {
    id: 'desk',
    title: 'The front desk',
    topics: [
      {
        id: 'the-day',
        title: 'The shape of a day',
        summary: 'Arrivals, in-house, departures, and the night audit that closes it.',
        screen: 'arrivals',
        keywords: ['daily', 'routine', 'shift'],
        body: (
          <>
            <DayFlowDiagram />
            <P>
              <strong>Arrivals</strong> is who is due in today. <strong>In-house</strong> is who
              is here now. <strong>Departures</strong> is who is leaving. All three read the
              business date in the top bar, which is why a business date that has not been rolled
              shows you yesterday&rsquo;s work.
            </P>
            <Terms items={[
              ['Check-in', <>Turns a booking into a guest in a bed. Refused if the arrival date
                is later than the business date — that is the system telling you the date has
                not been rolled, not that the guest is early.</>],
              ['Check-out', <>Settles the folio and marks the room or bed dirty, which is what
                puts it on the housekeeping list.</>],
              ['No-show', <>Flagged by the night audit for anyone who was due in and was neither
                checked in nor cancelled. It is a judgement, so it waits for you.</>],
            ]} />
          </>
        ),
        tasks: [
          {
            title: 'Check somebody in',
            steps: [
              'Front Office → Arrivals, or the Check-in button on the bottom strip.',
              'Find the booking. Search by name or confirmation if the list is long.',
              'Give them a room, or for a dorm a specific bed.',
              'Take the identity document if you keep them, and any payment due.',
              'Check in. The bed is now occupied and the guest appears in In-House.',
            ],
            warning: <>If check-in is refused with &ldquo;early arrival&rdquo;, the business date
              is behind. Run the night audit for the missing days rather than changing the
              booking.</>,
          },
          {
            title: 'Take a walk-in',
            steps: [
              'Quick actions → Walk-in, or New reservation.',
              'Pick the dates and the room type. The price comes from your rate plan automatically.',
              'Fill in the guest. A phone number is worth having even when it is optional.',
              'Save, then check them in — a walk-in is a booking that happens to start now.',
            ],
          },
        ],
      },
      {
        id: 'dorms',
        title: 'Dorm beds and private rooms',
        summary: 'Why four guests in one dorm are four bookings.',
        keywords: ['dorm', 'bed', 'bunk', 'hostel'],
        body: (
          <>
            <P>
              This is the difference between a hostel system and a hotel one, and it explains a
              lot of what you will see on screen.
            </P>
            <DormDiagram />
            <P>
              A bed is what gets priced, sold, assigned, cleaned and drawn on the tape chart. So
              a group of four sharing a dorm is four reservations linked together — they share a
              confirmation and are handled as one party, but each one is a bed.
            </P>
            <Note>
              A <strong>bunk</strong> is one piece of furniture and two berths, so it sleeps two.
              Getting this wrong is the single most common setup mistake in a hostel: a six-bunk
              dorm holds twelve people, not six.
            </Note>
          </>
        ),
      },
      {
        id: 'housekeeping',
        title: 'Housekeeping',
        summary: 'Who cleans what, and why a bed is not sellable until it is clean.',
        screen: 'housekeeping',
        keywords: ['cleaning', 'dirty', 'clean', 'rooms'],
        body: (
          <>
            <P>
              A check-out marks the bed dirty. A dirty bed can still be sold for a future date,
              but the system knows it is not ready now, which is what keeps somebody being sent
              to a bed that has not been stripped.
            </P>
            <Terms items={[
              ['Vacant Clean', 'Empty and ready. The only state a guest should be sent to.'],
              ['Vacant Dirty', 'Empty, needs cleaning. Usually the moment after a check-out.'],
              ['Occupied Clean / Dirty', 'Somebody is staying; whether it has been serviced today.'],
              ['Out of order', <>Deliberately unsellable — a broken window, a repaint. This one
                <em> does</em> remove the bed from availability, and therefore from what the OTAs
                are told.</>],
            ]} />
          </>
        ),
      },
    ],
  },

  /* ═════════════════════════════════════════════ bookings ══ */
  {
    id: 'bookings',
    title: 'Bookings',
    topics: [
      {
        id: 'statuses',
        title: 'What a booking can be',
        summary: 'The states a reservation moves through, and which hold a bed.',
        screen: 'reservations',
        keywords: ['status', 'tentative', 'confirmed', 'cancelled', 'pending'],
        body: (
          <>
            <StatusDiagram />
            <Terms items={[
              ['Awaiting confirmation', <>Only ever from your own booking page. It holds its bed
                but has no room picked and cannot be checked in. You accept or decline it.</>],
              ['Confirmed', 'On the books and holding its room or bed.'],
              ['Checked-in', 'The guest is here.'],
              ['Checked-out', 'The stay is over and the folio is settled.'],
              ['Cancelled', 'Off the books. The bed goes straight back on sale everywhere.'],
              ['No-show', 'Due in, never arrived, never cancelled. Flagged by the night audit.'],
            ]} />
            <Note tone="warn">
              A booking is never deleted, only cancelled. The same is true of a folio posting,
              which is voided rather than removed. That is what makes the audit trail worth
              anything — a system where records can vanish cannot be reconciled.
            </Note>
          </>
        ),
        tasks: [
          {
            title: 'Accept a booking from your own page',
            steps: [
              'It appears in Reservations marked awaiting confirmation, and on the Booking Page screen with a countdown.',
              'Open it and check the dates and the party.',
              'Confirm, picking the actual room or the actual beds.',
              'It becomes an ordinary confirmed booking and the hold countdown stops.',
            ],
            warning: <>If you do nothing, the hold expires and the booking cancels itself. That
              is deliberate — but it means a booking you meant to keep can be lost by being
              ignored. The hold window is yours to set on the Booking Page screen.</>,
          },
        ],
      },
      {
        id: 'overbooking',
        title: 'Overbooking',
        summary: 'How it happens, how the system catches it, what to do.',
        screen: 'overbooking',
        keywords: ['oversold', 'double booking', 'walk', 'conflict'],
        body: (
          <>
            <P>
              Overbooking means more bookings than beds for a date. With a channel manager
              connected it is not a hypothetical: two OTAs can sell the same last bed within the
              same second, and nothing on either side can prevent it. What a PMS can do is
              notice immediately and tell you while there is still time to act.
            </P>
            <Terms items={[
              ['Detected', 'The system found more bookings than beds for a date. It says which date and by how many.'],
              ['Walking a guest', <>Moving a guest to another property because you genuinely
                cannot house them. The system records what it cost you.</>],
              ['Last-room protection', <>Holding back the final bed or two from the OTAs so the
                simultaneous-sale case cannot happen. It costs occupancy; that is your call.
                Set per room type.</>],
            ]} />
            <Note>
              A direct booking taken on your own page can no longer cause this. It holds its bed
              the instant it is made and the OTAs are told within seconds.
            </Note>
          </>
        ),
      },
    ],
  },

  /* ══════════════════════════════════════════════════ money ══ */
  {
    id: 'money',
    title: 'Money',
    topics: [
      {
        id: 'folios',
        title: 'Folios and the cashier',
        summary: 'How a guest bill is built, and why it can never drift.',
        screen: 'cashier',
        keywords: ['bill', 'invoice', 'charge', 'payment', 'folio'],
        body: (
          <>
            <FolioDiagram />
            <Terms items={[
              ['Folio', 'A guest’s running bill. A list of lines, nothing more.'],
              ['Posting', 'One line on it — a room charge, a beer, a laundry, a tax.'],
              ['Void', <>Cancelling a posting. The line stays and is marked void, so the bill
                still adds up and the history still shows what happened.</>],
              ['Balance', <>Always recomputed from the lines. It is never stored, so it cannot
                get out of step with them.</>],
              ['City ledger', <>Moving a balance to a company account, for a bill somebody else
                is paying later. It then lives in Accounts Receivable.</>],
            ]} />
            <Note>
              Every amount in this system is a whole number of cents. Nothing is ever a decimal
              fraction, which is why totals here do not develop the one-cent drift that
              spreadsheets do.
            </Note>
          </>
        ),
        tasks: [
          {
            title: 'Take a payment',
            steps: [
              'Cashier, or open the guest from In-House.',
              'Choose the method. Cash and card are there by default; add others in Configuration → Payments.',
              'Enter the amount. For cash in another currency, enter what was actually handed over — the rate and the change are worked out and recorded in both currencies.',
              'Post it. The balance drops immediately.',
            ],
          },
          {
            title: 'Correct a mistake',
            steps: [
              'Find the posting on the folio.',
              'Void it — do not try to post a negative amount.',
              'Post the correct line.',
              'Both the void and the correction are in the audit trail with your name on them.',
            ],
          },
        ],
      },
      {
        id: 'booking-money',
        title: 'What the booking page collects',
        summary: 'Deposits, hold windows, and why they are the same decision.',
        screen: 'booking-engine',
        keywords: ['deposit', 'prepayment', 'hold', 'no-show', 'guarantee'],
        body: (
          <>
            <P>
              A direct booking that asks for nothing costs nothing to abandon. That is most of
              why no-show rates on direct and OTA bookings are not comparable — an OTA booking
              carries a card, and until you set a deposit yours does not.
            </P>
            <Terms items={[
              ['Deposit', <>What the guest is told they owe to confirm: nothing, a percentage,
                the first night, or the whole stay. It is stated on the page and recorded
                against the booking as owed.</>],
              ['Hold window', <>How long a booking keeps its bed before you have accepted it.
                When it runs out the booking cancels itself and the bed goes back on sale, on
                your page and on every OTA.</>],
              ['Ways to pay', 'Listed on the page so a guest knows what to expect on arrival.'],
            ]} />
            <Note tone="warn">
              This system does not process cards. It states the amount and records it; collecting
              it is up to you — a payment link, a transfer, or on arrival. Do not set a deposit
              you have no way to collect, because the page will promise the guest something you
              cannot follow through on.
            </Note>
            <P>
              A short hold and a real deposit both say &ldquo;we do not want speculative
              bookings&rdquo;. A long hold and no deposit say the opposite. Both are legitimate;
              they are a trade between filling beds and holding them for people who never come.
            </P>
          </>
        ),
      },
      {
        id: 'currency',
        title: 'Currency',
        summary: 'The property’s own currency, and taking money in others.',
        screen: 'config',
        keywords: ['currency', 'exchange', 'fx', 'foreign', 'usd', 'eur'],
        body: (
          <>
            <P>
              The property is kept in one currency — The Fun Bunk is in USD. Every rate, folio,
              report and statistic is in it, and it is set in Configuration → Property.
            </P>
            <Note tone="warn">
              Changing the property currency does <strong>not</strong> convert anything. Existing
              rates and folios keep their numbers and are simply relabelled. Change it only on a
              property that has not started trading.
            </Note>
            <P>
              Separately, the desk can accept cash in other currencies. Configuration → Payments
              holds the shortlist you actually take. A payment in one of them is converted at the
              stored rate and recorded in both currencies, so the drawer balances in what was
              physically handed over and the folio balances in yours.
            </P>
          </>
        ),
      },
    ],
  },

  /* ═══════════════════════════════════════ rates & selling ══ */
  {
    id: 'selling',
    title: 'Rates and selling',
    topics: [
      {
        id: 'pricing',
        title: 'Where a price comes from',
        summary: 'The chain that decides what a bed costs tonight.',
        screen: 'rates-inventory',
        keywords: ['rate', 'price', 'rate plan', 'calendar', 'yield'],
        body: (
          <>
            <PricingChainDiagram />
            <Terms items={[
              ['Rate plan', <>A way of selling. The Fun Bunk has one, <code>BAR</code> — the
                standard rate. Most hostels never need a second.</>],
              ['Rate calendar', <>A price per room type, per plan, per date. This is what you
                edit day to day, and what a season or a weekend uplift actually is.</>],
              ['Restriction', <>A rule rather than a price: minimum stay, maximum stay, no
                arrivals on a date, stop-sell.</>],
            ]} />
            <Note tone="warn">
              A date with no rate cannot be quoted or sold — not by the booking page, not by the
              OTAs, not at the desk. Rates are loaded a year ahead here; when that runs low, load
              more before a guest finds out for you.
            </Note>
          </>
        ),
        tasks: [
          {
            title: 'Change the price for some dates',
            steps: [
              'Rates & Inventory, choose the room type and the date range.',
              'Enter the new nightly price.',
              'Save. If the channel manager is connected the new price is queued immediately and is live on the OTAs within seconds.',
            ],
            warning: <>Check which room type you have selected before saving a range. A price
              applied to the wrong dorm is live on every OTA before you notice.</>,
          },
        ],
      },
      {
        id: 'booking-page',
        title: 'Your own booking page',
        summary: 'The commission-free channel, and the one you control.',
        screen: 'booking-engine',
        keywords: ['direct', 'website', 'booking engine', 'link', 'qr'],
        body: (
          <>
            <P>
              The page at <code>/book</code> is built from your room setup. There is nothing to
              design, build or deploy: the rooms, prices, stay rules and availability on it are
              read from this PMS as the guest loads it. Change a rate and the next booking is at
              the new one.
            </P>
            <P>
              It is the only channel that costs no commission, so the print-out of its QR code is
              worth more than it looks. A guest checking out who scans it to book their next stay
              is the cheapest booking you will ever take.
            </P>
            <Terms items={[
              ['The link', 'Share it, print it, put it in your email signature and on a card at the desk.'],
              ['Switched off', <>The page stays up but asks guests to contact you instead. Use it
                while you are between seasons rather than letting the link break.</>],
              ['Readiness', <>The three counts on the screen — room types, sellable beds, days
                priced ahead. If any is zero the page has nothing to sell.</>],
            ]} />
          </>
        ),
      },
    ],
  },

  /* ═══════════════════════════════════════ distribution ══ */
  {
    id: 'channels',
    title: 'Distribution',
    topics: [
      {
        id: 'connect',
        title: 'Connecting the channel manager',
        summary: 'The two tokens, the permissions, and what goes wrong quietly.',
        screen: 'channel-manager',
        keywords: ['beds24', 'channel', 'ota', 'connect', 'token', 'invite code', 'api'],
        body: (
          <>
            <P>
              The channel manager is what puts your beds on Booking.com, Hostelworld, Airbnb and
              the rest without you keeping three calendars by hand. You connect it once.
            </P>
            <ChannelSetupDiagram />
            <Terms items={[
              ['Invite code', <>Made in your channel manager account, single-use, and it expires
                after 24 hours. It is the only thing you ever paste in here.</>],
              ['Refresh token', <>What this PMS stores, encrypted. It <em>is</em> the connection
                — revoking it in the channel manager account stops distribution everywhere,
                immediately.</>],
              ['Access token', <>Short-lived, minted automatically from the refresh token for
                each call. You never see it and never need to.</>],
              ['Permissions (scopes)', <>Ticked when you create the invite code. Getting them
                wrong is the trap — see below.</>],
              ['Room mapping', <>Pairing each room on their side with a room type here. An
                unmatched room has nowhere to send its prices, so it silently sells nothing.</>],
            ]} />
            <Note tone="warn">
              <strong>The trap worth knowing about.</strong> An invite code created without write
              permission connects perfectly. It lists your properties, imports bookings, shows a
              green tick — and cannot push a single rate. The queue fills and nothing leaves.
              The Connection screen checks the permissions for you and names any that are
              missing, which is the whole reason it exists.
            </Note>
          </>
        ),
        tasks: [
          {
            title: 'Connect the channel manager',
            steps: [
              'Channel Manager → Connection. Read the permission list there — it is generated from what this PMS actually calls.',
              'In your channel manager account: Settings → Apps & Integrations → API.',
              'Create an invite code with every listed permission ticked, restricted to this property.',
              'Paste it here within 24 hours and press Connect.',
              'The screen then checks the permissions, lists the properties and matches your rooms. Work down it until all four steps are green.',
            ],
            warning: <>Do this only once your rates are right. Connecting publishes whatever this
              PMS currently holds, and it is live on every OTA immediately.</>,
          },
          {
            title: 'Work out why nothing is being pushed',
            steps: [
              'Channel Manager → Connection, press Re-check. Missing permissions are named there.',
              'Check the property: if it says the bound property can no longer be seen, every push is failing.',
              'Check the room mappings — an unmatched room pushes nothing.',
              'Channel Manager → Sync log shows the real error from the last attempt, not a summary.',
            ],
          },
        ],
      },
      {
        id: 'ari',
        title: 'What gets sent, and when',
        summary: 'Availability, rates and restrictions — the three things that go out.',
        screen: 'channel-manager',
        keywords: ['ari', 'push', 'queue', 'sync', 'drift'],
        body: (
          <>
            <Terms items={[
              ['ARI', <>Availability, Rates and Inventory — the three things a channel manager
                exists to distribute.</>],
              ['The queue', <>Anything that changes a price or a bed count queues a push. It
                drains within seconds, so a rate changed at the desk is live on the OTAs almost
                at once.</>],
              ['Drift', <>What they hold no longer matching what you hold. The system can compare
                the two and show you the difference rather than assuming the push worked.</>],
              ['Read-only mode', <>Bookings come in, nothing goes out. Useful while you are still
                setting up. It is on right now.</>],
            ]} />
          </>
        ),
      },
    ],
  },

  /* ══════════════════════════════════════════ closing the day ══ */
  {
    id: 'closing',
    title: 'Closing the day',
    topics: [
      {
        id: 'night-audit',
        title: 'The night audit',
        summary: 'The only thing that moves the business date, and what it does.',
        screen: 'night-audit',
        keywords: ['night audit', 'business date', 'roll', 'close', 'end of day'],
        body: (
          <>
            <P>
              The night audit closes one trading day and opens the next. It runs as a single
              transaction: no-shows flagged, room charges and taxes posted, the day&rsquo;s
              statistics frozen, housekeeping rolled, expired holds released, date advanced. If
              any step fails, none of it is committed.
            </P>
            <Note tone="warn">
              <strong>A business date that stops moving is serious.</strong> Check-in starts
              refusing guests standing at the desk, room charges stop accruing, and revenue
              statistics quietly stop at the last date somebody rolled. It runs automatically
              here, but if you ever see the date in the top bar falling behind, fix it that day.
            </Note>
            <P>
              It will not force. A property with arrivals that were neither checked in nor
              cancelled is left alone and raises a notification, because that is a judgement for
              a person rather than a timer.
            </P>
          </>
        ),
      },
      {
        id: 'reports',
        title: 'Reports',
        summary: 'What sold, what it earned, and what is owed.',
        screen: 'reports',
        keywords: ['report', 'revenue', 'adr', 'revpar', 'occupancy', 'statistics'],
        body: (
          <>
            <Terms items={[
              ['Occupancy', 'Beds sold as a share of beds available.'],
              ['ADR', <>Average daily rate — room revenue divided by beds sold. What the average
                bed actually went for.</>],
              ['RevPAR', <>Revenue per available bed. Occupancy and ADR in one number, and the
                one worth watching: it falls if you discount too hard <em>and</em> if you price
                too high.</>],
              ['Manager’s report', 'One day on one page — sold, earned, arrived, departed, owed.'],
            ]} />
            <Note>
              Every figure is computed from actual postings, never typed in or stored as a
              summary. A number in a report can always be traced back to the folio lines that
              made it.
            </Note>
          </>
        ),
      },
      {
        id: 'backups',
        title: 'Backups',
        summary: 'Where your data is, and what to do when the disk dies.',
        screen: 'admin',
        keywords: ['backup', 'restore', 'data', 'disk', 'safety'],
        body: (
          <>
            <P>
              Everything is one SQLite file on this machine. Backups are taken automatically
              every six hours and after every night audit, verified, and kept on a schedule —
              the newest few always, then one a day, one a week, one a month.
            </P>
            <Note tone="warn">
              A backup on the same disk does not survive the disk failing. Copy the backups
              folder somewhere else — another drive, or cloud storage — on a schedule you
              actually keep. This is the single most important thing in this manual that nobody
              does until it is too late.
            </Note>
            <P>
              Restoring happens with the system stopped, from the command line, so it cannot
              half-happen while somebody is taking a booking.
            </P>
          </>
        ),
      },
    ],
  },

  /* ═════════════════════════════════════════ configuration ══ */
  {
    id: 'config',
    title: 'Configuration',
    topics: [
      {
        id: 'rooms-setup',
        title: 'Room types, rooms and beds',
        summary: 'What you sell, and the physical things behind it.',
        screen: 'config',
        keywords: ['room type', 'rooms', 'beds', 'inventory', 'setup'],
        body: (
          <>
            <Terms items={[
              ['Room type', <>A thing you sell — &ldquo;Deluxe 6 Bed Female Dorm Ensuite&rdquo;.
                Prices, occupancy limits and channel mappings hang off it.</>],
              ['Room', 'A physical room. Several rooms can share a type — the two 8-bed dorms here do.'],
              ['Bed', <>A berth in a dorm, created with the room. Only dorms have them, because
                only dorms are sold by the bed.</>],
              ['Gender policy', <>Mixed or female-only. It is shown to guests and it stops the
                system putting the wrong person in a female dorm.</>],
            ]} />
            <Note tone="warn">
              Deleting a room type that has ever had a booking is refused, and that is on
              purpose. Deactivate it instead: it stops being sellable and the history stays
              readable.
            </Note>
          </>
        ),
      },
      {
        id: 'users',
        title: 'Staff, roles and security',
        summary: 'Who can do what, and why shared logins are a bad idea.',
        screen: 'admin',
        keywords: ['user', 'role', 'permission', 'password', 'mfa', 'security'],
        body: (
          <>
            <P>
              Each person gets their own login. Not for secrecy — for the audit trail. Every rate
              override, void, folio reopen and security change is recorded with a name against
              it, and a shared account makes all of that say &ldquo;reception&rdquo;.
            </P>
            <Terms items={[
              ['Administrator', 'Everything, including other users and security.'],
              ['Manager', 'Day-to-day operations and overrides, not user administration.'],
              ['Front office', 'Bookings, check-in and check-out, the desk.'],
              ['Housekeeping', 'Room status and tasks.'],
              ['Accounts', 'Folios, payments, receivables.'],
              ['Read-only', 'Looks, changes nothing. Good for an accountant or an owner.'],
            ]} />
            <Note>
              Permissions are enforced by the server on every request, not just hidden in the
              interface. A role that cannot do something cannot do it by any route.
            </Note>
          </>
        ),
      },
    ],
  },
];

/** Every topic, flattened — for search and for deep links. */
export const ALL_TOPICS: (Topic & { section: string })[] =
  MANUAL.flatMap((s) => s.topics.map((t) => ({ ...t, section: s.title })));
