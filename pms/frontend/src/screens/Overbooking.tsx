// The overbooking desk.
//
// Sorted by *time*, not by size: one room oversold tonight sits above five
// oversold in two months, because tonight there is a guest in a taxi.
//
// Every finding leads with the likely cause, because the fix depends entirely
// on it — a failing channel push keeps producing bookings until somebody fixes
// the connection, whereas a race is nobody's mistake and just needs a room
// found. A list of problems without causes makes people guess.
import { useState } from 'react';
import {
  TriangleAlert, ShieldCheck, RefreshCw, Check, Lock, Clock, Users, DoorClosed,
  CircleAlert, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useNav } from '../nav';
import { ExposureTab } from './Exposure';
import {
  useOverbookings, useScanOverbookings, useAcknowledgeOverbooking, useResolveOverbooking,
  useOverbookingOptions, useApplyOverbookingFix,
  type OverbookingFinding, type OverbookingBooking, type GuestOptions, type RoomOption,
} from '../queries';
import { useAuthStore } from '../stores';
import { Card, Pill, Button, SectionHeader, Tabs, Modal, Field, Select, TextInput } from '../ui';
import { QueryState, useToast, PermissionButton, WarnNote, InfoNote, MoneyInput } from '../components';
import { money, shortDate, relativeTime } from '../format';

const SEVERITY_TONE = {
  critical: 'red', urgent: 'peach', warning: 'yellow', info: 'grey',
} as const;

const KIND_LABEL: Record<string, string> = {
  type: 'Oversold',
  room: 'Same room twice',
  bed: 'Same bed twice',
  'at-risk': 'Sold out',
};

export function OverbookingScreen() {
  const toast = useToast();
  const { navigate } = useNav();
  const property = useAuthStore((s) => s.property);
  const [includeAtRisk, setIncludeAtRisk] = useState(false);
  const data = useOverbookings(includeAtRisk);
  const rescan = useScanOverbookings();
  const [resolving, setResolving] = useState<OverbookingFinding | null>(null);
  const [fixing, setFixing] = useState<OverbookingFinding | null>(null);
  const [tab, setTab] = useState<'problems' | 'protection'>('problems');

  return (
    <div>
      <SectionHeader
        eyebrow={`Business date ${property?.businessDate ?? ''}`}
        title="Overbooking"
        action={tab === 'problems' ? (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm"
              onClick={() => setIncludeAtRisk(!includeAtRisk)}>
              {includeAtRisk ? 'Hide sold-out dates' : 'Show sold-out dates'}
            </Button>
            <PermissionButton permission="reservations.write" size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              disabled={rescan.isPending}
              onClick={async () => {
                try {
                  const r: any = await rescan.mutateAsync();
                  toast.success(
                    r.created ? `${r.created} new problem(s) found` : 'Nothing new',
                    `${r.found} checked · ${r.autoResolved} cleared`);
                } catch (e) { toast.fail(e); }
              }}>
              {rescan.isPending ? 'Checking…' : 'Check now'}
            </PermissionButton>
          </div>
        ) : undefined}
      />

      <div className="mb-4">
        <Tabs
          tabs={[
            { value: 'problems', label: 'Problems', count: data.data?.summary.total || undefined },
            { value: 'protection', label: 'Protection & exposure' },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'protection' && <ExposureTab />}

      {tab === 'problems' && (
      <QueryState query={data} loadingRows={4}>
        {(d) => {
          const s = d.summary;
          const clear = s.total === 0;
          return (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Card tone={s.tonight ? 'peach' : 'plain'}>
                  <Metric label="Tonight" value={s.tonight} />
                </Card>
                <Card tone={s.total ? 'peach' : 'mint'}>
                  <Metric label="Open problems" value={s.total} />
                </Card>
                <Card><Metric label="Rooms oversold" value={s.roomsOversold} /></Card>
                <Card tone={s.atRiskOpen ? 'yellow' : 'plain'}>
                  <Metric label="Sold out" value={s.atRisk}
                    sub={s.atRiskOpen
                      ? `${s.atRiskClosed} closed · ${s.atRiskOpen} still on sale`
                      : 'all closed on the channels'} />
                </Card>
              </div>

              {clear && (
                <Card tone="mint">
                  <div className="py-8 text-center">
                    <ShieldCheck className="w-7 h-7 text-status-ok mx-auto mb-2" />
                    <p className="text-[15px] font-bold">Nothing is oversold</p>
                    <p className="text-[12px] text-dash-muted mt-1 max-w-lg mx-auto leading-relaxed">
                      Dates are checked after every booking and shut on the channels the moment
                      the last room goes, so a second OTA cannot sell it.
                      {s.atRisk > 0 && ` ${s.atRisk} sold-out date(s) are currently closed.`}
                    </p>
                  </div>
                </Card>
              )}

              <div className="space-y-3">
                {d.findings.map((f) => (
                  <FindingCard
                    key={f.id}
                    finding={f}
                    onOpenBooking={(id) => navigate('guest-dashboard', { reservationId: id })}
                    onFix={() => setFixing(f)}
                    onResolve={() => setResolving(f)}
                  />
                ))}
              </div>

              <FixModal finding={fixing} onClose={() => setFixing(null)} />
              <ResolveModal
                finding={resolving}
                onClose={() => setResolving(null)}
              />
            </>
          );
        }}
      </QueryState>
      )}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-2">{label}</p>
      <p className="text-[24px] font-black leading-none tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-dash-muted mt-1.5">{sub}</p>}
    </>
  );
}

function FindingCard({ finding, onOpenBooking, onFix, onResolve }: {
  finding: OverbookingFinding;
  onOpenBooking: (reservationId: string) => void;
  onFix: () => void;
  onResolve: () => void;
}) {
  const toast = useToast();
  const acknowledge = useAcknowledgeOverbooking();
  const [open, setOpen] = useState(finding.severity === 'critical');

  const when = finding.daysAway <= 0 ? 'tonight'
    : finding.daysAway === 1 ? 'tomorrow'
      : `in ${finding.daysAway} days`;

  return (
    <Card tone={SEVERITY_TONE[finding.severity]}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <TriangleAlert className={`w-4 h-4 ${
              finding.severity === 'critical' ? 'text-status-bad' : 'text-status-warn'}`} />
            <p className="text-[15px] font-black">
              {finding.kind === 'type'
                ? `${finding.oversold} room${finding.oversold === 1 ? '' : 's'} oversold`
                : KIND_LABEL[finding.kind]}
            </p>
            <Pill tone={SEVERITY_TONE[finding.severity]}>{finding.severity}</Pill>
            {finding.acknowledgedAt && <Pill tone="grey">acknowledged</Pill>}
          </div>
          <p className="text-[12px] font-semibold">
            {shortDate(finding.date)} · {when}
            {finding.roomType && ` · ${finding.roomType}`}
            {finding.room && ` · room ${finding.room}`}
            {finding.bed && ` · bed ${finding.bed}`}
          </p>
          {finding.kind === 'type' && (
            <p className="text-[11px] text-dash-muted mt-0.5">
              {finding.sold} booked against {finding.sellable} sellable
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {finding.channelsClosedAt ? (
            <Pill tone="mint">
              <span className="inline-flex items-center gap-1">
                <Lock className="w-3 h-3" />channels closed
              </span>
            </Pill>
          ) : (
            <Pill tone="yellow">still on sale</Pill>
          )}
          {!finding.acknowledgedAt && (
            <PermissionButton permission="reservations.read" size="sm" variant="secondary"
              icon={<Check className="w-3 h-3" />}
              onClick={async () => {
                try {
                  await acknowledge.mutateAsync({ id: finding.id });
                  toast.success('Acknowledged', 'The alarm stops until it gets worse.');
                } catch (e) { toast.fail(e); }
              }}>
              Acknowledge
            </PermissionButton>
          )}
          {finding.kind !== 'at-risk' && (
            <PermissionButton permission="frontdesk.write" size="sm" onClick={onFix}>
              Fix this
            </PermissionButton>
          )}
          <PermissionButton permission="reservations.write" size="sm" variant="secondary" onClick={onResolve}>
            Resolve
          </PermissionButton>
        </div>
      </div>

      {/* The cause leads, because it decides what to do next. */}
      <div className="mt-3 rounded-xl bg-white/60 p-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1">
          Why this happened · {finding.cause.replace('-', ' ')}
        </p>
        <p className="text-[12px] leading-relaxed">{finding.causeText}</p>
      </div>

      {finding.reservations.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 text-[11px] font-bold text-dash-muted hover:text-black">
            {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <Users className="w-3 h-3" />
            {finding.reservations.length} booking(s) on this date
          </button>
          {open && (
            <div className="mt-2 overflow-x-auto scroll-thin">
              <table className="w-full min-w-[40rem] text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                    <th className="pb-2">Guest</th>
                    <th className="pb-2">Stay</th>
                    <th className="pb-2">Room</th>
                    <th className="pb-2">Source</th>
                    <th className="pb-2 text-right">Value</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {finding.reservations.map((r: OverbookingBooking) => (
                    <tr key={r.id} className="border-b border-black/[0.04]">
                      <td className="py-2">
                        <button className="font-semibold hover:underline text-left"
                          onClick={() => onOpenBooking(r.id)}>
                          {r.guest}
                        </button>
                        <p className="text-[10px] text-dash-muted">{r.confirmation}</p>
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        {r.nights}n · {shortDate(r.arrival)}
                        {r.eta && <p className="text-[10px] text-dash-muted">ETA {r.eta}</p>}
                      </td>
                      <td className="py-2">{r.room ?? <span className="text-dash-muted">—</span>}</td>
                      <td className="py-2 text-dash-muted">
                        {r.channelCode ?? r.source}
                      </td>
                      <td className="py-2 text-right tabular-nums font-semibold">
                        {money(r.totalMinor)}
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1 flex-wrap">
                          <Pill tone="grey">{r.status}</Pill>
                          {r.vip && <Pill tone="yellow" solid>VIP</Pill>}
                          {r.previousStays > 0 && <Pill tone="mint">repeat</Pill>}
                          {r.groupId && <Pill tone="sky">group</Pill>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-dash-muted mt-2 flex items-center gap-1.5">
        <Clock className="w-3 h-3" />
        First seen {relativeTime(finding.firstSeenAt)}
        {finding.channelsClosedAt && ` · channels closed ${relativeTime(finding.channelsClosedAt)}`}
      </p>
    </Card>
  );
}

/**
 * The fix drawer.
 *
 * Ordered the way a duty manager works: reassign first (costs nothing and
 * nobody notices), then upgrade (costs the rate difference and the guest is
 * delighted), then downgrade with compensation. A walk is the last resort and
 * only appears once there is genuinely nowhere left to put anybody.
 */
function FixModal({ finding, onClose }: {
  finding: OverbookingFinding | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const options = useOverbookingOptions(finding?.id ?? null);
  const apply = useApplyOverbookingFix();
  // Keyed per guest. A single shared amount looks per-guest on screen but is
  // not — typing 25 against one booking and clicking a room on another would
  // credit the wrong person.
  const [compensation, setCompensation] = useState<Record<string, number>>({});

  if (!finding) return null;

  async function run(
    guest: GuestOptions, room: RoomOption, kind: 'reassign' | 'upgrade' | 'downgrade',
  ) {
    if (!finding) return;
    try {
      const r: any = await apply.mutateAsync({
        findingId: finding.id,
        reservationId: guest.reservationId,
        roomId: room.roomId,
        kind,
        compensationMinor: kind === 'downgrade' ? (compensation[guest.reservationId] ?? 0) : undefined,
      });
      if (r.fixed) {
        toast.success(`${guest.guest} moved to ${room.number}`, 'The overbooking is cleared.');
        onClose();
      } else {
        // Work was done; the problem is not solved. Saying so is the point.
        toast.push({
          kind: 'warn',
          title: `${guest.guest} moved to ${room.number}`,
          body: 'Still oversold — move another guest.',
        });
      }
    } catch (e) { toast.fail(e, 'Could not move that guest'); }
  }

  return (
    <Modal open={!!finding} onClose={onClose} size="lg"
      title={`Fix ${shortDate(finding.date)} · ${finding.roomType ?? ''}`}
      footer={<div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Close</Button></div>}>
      <QueryState query={options} loadingRows={3}>
        {(o) => (
          <div className="space-y-3">
            {o.walkLikely ? (
              <WarnNote>
                <span className="font-bold">There is nowhere left to move anybody.</span>{' '}
                {o.spareRooms === 0
                  ? 'No room of any other type is free for these dates.'
                  : `Only ${o.spareRooms} spare room(s) for ${o.oversold} guest(s) over.`}{' '}
                Someone will have to be walked — do that from the guest's booking, and record
                where they went and what it cost.
              </WarnNote>
            ) : (
              <InfoNote>
                {o.spareRooms} room(s) are free outside {finding.roomType}. Moving a guest into a
                better room costs the rate difference; walking one costs a hotel, a taxi and a
                refund. Try in that order.
              </InfoNote>
            )}

            {o.guests.map((g) => (
              <div key={g.reservationId} className="rounded-xl border subtle-divider p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <div>
                    <p className="text-[13px] font-bold">{g.guest}</p>
                    <p className="text-[11px] text-dash-muted">
                      {g.confirmation} · {g.nights}n from {shortDate(g.arrival)} ·{' '}
                      {g.room ? `room ${g.room}` : 'no room assigned'} · {money(g.totalMinor)}
                    </p>
                  </div>
                  <Pill tone="grey">{g.status}</Pill>
                </div>

                {!g.movable ? (
                  <p className="text-[11px] text-status-warn">{g.blockedReason}</p>
                ) : (
                  <div className="space-y-2">
                    <OptionRow label="Reassign" hint="Same room type — costs nothing"
                      rooms={g.sameType} tone="mint"
                      onPick={(room) => run(g, room, 'reassign')} busy={apply.isPending} />
                    <OptionRow label="Upgrade" hint="Guest keeps their rate; the property absorbs the difference"
                      rooms={g.upgrades} tone="sky"
                      onPick={(room) => run(g, room, 'upgrade')} busy={apply.isPending} />
                    <OptionRow label="Downgrade" hint="Re-priced down, with compensation posted to the folio"
                      rooms={g.downgrades} tone="yellow"
                      onPick={(room) => run(g, room, 'downgrade')} busy={apply.isPending}
                      extra={
                        <div className="w-full sm:w-[150px]">
                          <Field label="Compensation">
                            <MoneyInput
                              valueMinor={compensation[g.reservationId] ?? 0}
                              onChange={(v) => setCompensation((c) => ({ ...c, [g.reservationId]: v }))} />
                          </Field>
                        </div>
                      } />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </QueryState>
    </Modal>
  );
}

function OptionRow({ label, hint, rooms, tone, onPick, busy, extra }: {
  label: string; hint: string; rooms: RoomOption[];
  tone: 'mint' | 'sky' | 'yellow';
  onPick: (room: RoomOption) => void;
  busy: boolean;
  extra?: React.ReactNode;
}) {
  if (!rooms.length) return null;
  return (
    <div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <Pill tone={tone}>{label}</Pill>
        <span className="text-[10px] text-dash-muted">{hint}</span>
      </div>
      <div className="flex items-end gap-2 flex-wrap mt-1.5">
        {extra}
        {rooms.slice(0, 6).map((room) => (
          <PermissionButton key={room.roomId} permission="frontdesk.write" size="sm"
            variant="secondary" disabled={busy}
            onClick={() => onPick(room)}>
            {room.number} · {room.roomType}
            {room.rateDiffMinor !== 0 && (
              <span className="ml-1 text-dash-muted">
                {room.rateDiffMinor > 0 ? '+' : ''}{money(room.rateDiffMinor)}/n
              </span>
            )}
          </PermissionButton>
        ))}
      </div>
    </div>
  );
}

const RESOLUTIONS = [
  'Reassigned to a free room',
  'Guest upgraded',
  'Guest downgraded with compensation',
  'A booking was cancelled',
  'Guest walked to another hotel',
  'Out-of-order block released',
  'Deliberate oversell — leaving it',
  'Other',
];

function ResolveModal({ finding, onClose }: {
  finding: OverbookingFinding | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const resolve = useResolveOverbooking();
  const [resolution, setResolution] = useState(RESOLUTIONS[0]);
  const [note, setNote] = useState('');

  if (!finding) return null;

  return (
    <Modal open={!!finding} onClose={onClose} title="How was this resolved?"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={resolve.isPending}
            onClick={async () => {
              try {
                await resolve.mutateAsync({ id: finding.id, resolution, note: note || undefined });
                toast.success('Marked resolved',
                  'It will reappear on the next check if it is still true.');
                onClose();
              } catch (e) { toast.fail(e); }
            }}>
            {resolve.isPending ? 'Saving…' : 'Mark resolved'}
          </Button>
        </div>
      }>
      <div className="space-y-3">
        <InfoNote>
          <span className="inline-flex items-start gap-1.5">
            <CircleAlert className="w-3.5 h-3.5 shrink-0 mt-px" />
            Marking this resolved records what was done — it does not change any booking. If the
            dates are still oversold, the next check puts it straight back on this list.
          </span>
        </InfoNote>
        <Field label="What happened">
          <Select value={resolution} onChange={setResolution}
            options={RESOLUTIONS.map((r) => ({ label: r, value: r }))} />
        </Field>
        <Field label="Note (optional)">
          <TextInput value={note} onChange={setNote}
            placeholder="Which guest, which room, what it cost…" />
        </Field>
        {finding.channelsClosedAt && (
          <WarnNote>
            <span className="inline-flex items-start gap-1.5">
              <DoorClosed className="w-3.5 h-3.5 shrink-0 mt-px" />
              These dates are closed on the channels. Reopen them from Rates &amp; Inventory →
              Close-outs once there is a room to sell again.
            </span>
          </WarnNote>
        )}
      </div>
    </Modal>
  );
}
