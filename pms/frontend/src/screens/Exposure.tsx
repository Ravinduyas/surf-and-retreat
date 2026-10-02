// Last-room protection, and the numbers that make it a decision rather than a guess.
//
// The race between two OTAs selling the same last room cannot be prevented by
// any channel manager — each OTA sells from its own cached copy and tells you
// afterwards. Holding the last room back is the only thing that closes it, and
// it costs occupancy. So the setting never appears without the property's own
// figures beside it: how long your pushes actually take, how many nights sold
// out, and how many went over.
import { useState } from 'react';
import { ShieldCheck, Gauge, TriangleAlert, Timer, Lock } from 'lucide-react';
import { useExposure, useSetRoomProtection } from '../queries';
import { Card, Pill, Select, Field } from '../ui';
import { QueryState, useToast, PermissionButton, WarnNote } from '../components';
import { relativeTime } from '../format';

/** Seconds, said the way a person would say them. */
function duration(seconds: number): string {
  if (seconds < 1) return 'under a second';
  if (seconds < 90) return `${Math.round(seconds * 10) / 10}s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 360) / 10} hours`;
}

export function ExposureTab() {
  const exposure = useExposure();

  return (
    <QueryState query={exposure} loadingRows={4}>
      {(x) => (
        <div className="space-y-3">
          <Card tone={x.failedNow > 0 ? 'peach' : x.protection.some((p) => p.protectLastRooms > 0) ? 'mint' : 'plain'}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center shrink-0">
                {x.failedNow > 0
                  ? <TriangleAlert className="w-5 h-5 text-status-bad" />
                  : <Gauge className="w-5 h-5 text-dash-muted" />}
              </div>
              <div>
                <p className="text-[15px] font-bold mb-1">Your exposure to the OTA race</p>
                <p className="text-[12px] text-dash-muted leading-relaxed max-w-3xl">{x.verdict}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-black/5">
              <Stat label="Typical push" value={x.pushes ? duration(x.medianSeconds) : '—'}
                sub={x.pushes ? `worst ${duration(x.worstSeconds)}` : 'no data yet'} />
              <Stat label="Waiting now" value={String(x.queuedNow)}
                sub={x.queuedNow ? 'stale on the OTAs' : 'everything is current'} />
              <Stat label="Sold-out nights" value={String(x.soldOutNights)}
                sub="each one was a race" />
              <Stat label="Went over" value={String(x.oversoldNights)}
                sub={x.racesLost ? `${x.racesLost} from the race` : 'none from the race'} />
            </div>
          </Card>

          {x.failedNow > 0 && (
            <WarnNote>
              <span className="font-bold">{x.failedNow} channel update(s) have failed.</span>{' '}
              Until they go through, the OTAs are selling from availability that is out of date —
              this is a larger exposure than the race itself, and unlike the race it is entirely
              fixable. The oldest has been stuck since{' '}
              {x.oldestFailedAt ? relativeTime(x.oldestFailedAt) : 'an unknown time'}. Check the
              channel manager's sync log.
            </WarnNote>
          )}

          <Card>
            <div className="flex items-center gap-2 mb-1">
              <Lock className="w-4 h-4 text-dash-muted" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                Last-room protection
              </p>
            </div>
            <p className="text-[11px] text-dash-muted leading-relaxed mb-4 max-w-3xl">
              The race exists because two OTAs can each sell the <em>same last room</em> — neither
              asks Helio first. Holding a room back removes it from the channels, so there is
              nothing to race for. The front desk can still sell it. The cost is real: you will
              finish some nights one room short of full.
            </p>

            <div className="space-y-2">
              {x.protection.map((p) => (
                <ProtectionRow key={p.roomTypeId} row={p} />
              ))}
            </div>
          </Card>

          {x.perChannel.some((c) => c.pushes > 0 || c.failed > 0) && (
            <Card>
              <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
                By channel
              </p>
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full min-w-[30rem] text-[12px]">
                  <thead>
                    <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                      <th className="pb-2">Channel</th>
                      <th className="pb-2 text-right">Pushes</th>
                      <th className="pb-2 text-right">Typical</th>
                      <th className="pb-2 text-right">Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {x.perChannel.map((c) => (
                      <tr key={c.channelId} className="border-b border-black/[0.03]">
                        <td className="py-2.5 font-semibold">{c.name}</td>
                        <td className="py-2.5 text-right tabular-nums">{c.pushes}</td>
                        <td className="py-2.5 text-right tabular-nums">
                          {c.pushes ? duration(c.medianSeconds) : '—'}
                        </td>
                        <td className="py-2.5 text-right">
                          {c.failed
                            ? <Pill tone="red">{c.failed}</Pill>
                            : <span className="text-dash-muted tabular-nums">0</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card>
            <div className="flex items-start gap-2">
              <Timer className="w-4 h-4 text-dash-muted shrink-0 mt-0.5" />
              <p className="text-[11px] text-dash-muted leading-relaxed">
                <span className="font-bold">How this is measured.</span> Every change queues a push
                and records when the channel confirmed it. The gap between those two is the window
                in which an OTA could still sell a room that had already gone —{' '}
                {x.pushes ? `about ${duration(x.medianSeconds)} here` : 'not yet measurable here'}.
                Total exposure over the period was {duration(x.totalExposureSeconds)} across{' '}
                {x.pushes} push(es). A failed push is excluded from the average, because it never
                landed at all; it is counted separately above.
              </p>
            </div>
          </Card>
        </div>
      )}
    </QueryState>
  );
}

function ProtectionRow({ row }: {
  row: {
    roomTypeId: string; roomType: string; isDorm: boolean;
    units: number; rooms: number; protectLastRooms: number;
  };
}) {
  const toast = useToast();
  const save = useSetRoomProtection();
  const [value, setValue] = useState(String(row.protectLastRooms));

  // A dorm is sold by the bed, so that is what is being held back — saying
  // "room" here would describe something much larger than what happens.
  const unit = row.isDorm ? 'bed' : 'room';

  // Holding back everything is a stop-sell, not protection — so the choices
  // stop one short of what the type actually has.
  const options = Array.from({ length: Math.max(1, row.units) }, (_, i) => ({
    value: String(i),
    label: i === 0 ? `Sell every ${unit}` : `Hold back ${i} ${unit}${i === 1 ? '' : 's'}`,
  }));

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border subtle-divider p-3">
      <div className="min-w-0">
        <p className="text-[13px] font-bold">{row.roomType}</p>
        <p className="text-[11px] text-dash-muted">
          {row.units} {unit}{row.units === 1 ? '' : 's'}
          {row.isDorm && ` in ${row.rooms} room${row.rooms === 1 ? '' : 's'}`} ·{' '}
          {row.protectLastRooms === 0
            ? `every ${unit} is on sale everywhere`
            : `the OTAs stop selling at ${row.protectLastRooms} left`}
        </p>
      </div>
      {/* The outer row wraps, but this group did not, so on a phone the pill,
          the "hold back" select and Save were one 380px-wide unit that ran off
          the card. Wrapping it too lets the select take the full width and the
          button sit under it. */}
      <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
        {row.protectLastRooms > 0 && (
          <Pill tone="mint">
            <ShieldCheck className="w-3 h-3 inline mr-1" />protected
          </Pill>
        )}
        <div className="flex-1 min-w-[10rem] sm:flex-none sm:w-[190px]">
          <Field label="">
            <Select value={value} onChange={setValue} options={options} />
          </Field>
        </div>
        <PermissionButton permission="rates.write" size="sm"
          disabled={save.isPending || value === String(row.protectLastRooms)}
          onClick={async () => {
            try {
              const r: any = await save.mutateAsync({
                roomTypeId: row.roomTypeId, protectLastRooms: Number(value),
              });
              toast.success(
                Number(value) === 0 ? `${row.roomType} back on sale everywhere`
                  : `${row.roomType} protected`,
                r.datesClosed
                  ? `${r.datesClosed} date(s) closed on the channels`
                  : 'No dates needed closing');
            } catch (e) { toast.fail(e, 'Could not change the protection'); }
          }}>
          Save
        </PermissionButton>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1">{label}</p>
      <p className="text-[15px] font-black tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-dash-muted mt-0.5">{sub}</p>}
    </div>
  );
}
