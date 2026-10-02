// Booking-engine package prices.
//
// The public site sells four things, and two of them are packages: "Rooms +
// surf" and "Rooms + coworking + surf". A guest buying one is buying a surf
// trip at one price, so the property sets that price directly rather than the
// site adding a room rate to a lessons table.
//
// A package is a rate plan (see services/packages.ts), which means every price
// here could already be set from the rate calendar. This screen exists because
// that grid answers "what does each room type cost on each date across every
// plan" — seven columns of context nobody needs when the question is the much
// smaller "what does the surf package cost". So: one card per package, one
// price per room type, and a date range for the seasons that differ.
import { useState } from 'react';
import { Waves, Laptop, Plus, Save, CalendarRange } from 'lucide-react';
import {
  useRatePlans, useRoomTypes, useRateCalendar, useUpdateRatePlan, useBulkRates,
  useEnsurePackagePlans,
} from '../queries';
import { useAuthStore } from '../stores';
import { Card, Pill, Button, SectionHeader, Field } from '../ui';
import { ChannelPublishNote } from '../ChannelPublishNote';
import { QueryState, useToast, MoneyInput, DateInput, PermissionButton } from '../components';
import { money, addDays } from '../format';
import type { BookingModel, RatePlan, RoomType } from '../types';

/** The two models sold as a package, in the order the booking site offers them. */
const PACKAGES: { model: BookingModel; label: string; blurb: string; icon: typeof Waves }[] = [
  {
    model: 'rooms-surf',
    label: 'Rooms + surf',
    blurb: 'A stay with surf lessons, quoted as one price on the booking site.',
    icon: Waves,
  },
  {
    model: 'rooms-coworking-surf',
    label: 'Rooms + coworking + surf',
    blurb: 'Bed, desk and lessons, quoted as one price on the booking site.',
    icon: Laptop,
  },
];

export function PackagesScreen() {
  const plans = useRatePlans();
  const roomTypes = useRoomTypes();
  const ensure = useEnsurePackagePlans();
  const toast = useToast();

  const packagePlans = (plans.data ?? []).filter((p) => p.bookingModel && p.active);
  const missing = PACKAGES.filter((p) => !packagePlans.some((rp) => rp.bookingModel === p.model));

  return (
    <div>
      <SectionHeader
        eyebrow="Revenue"
        title="Booking-engine packages"
        action={missing.length > 0 ? (
          <PermissionButton
            permission="rates.write"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={async () => {
              try {
                const r = await ensure.mutateAsync();
                toast.success(r.created.length
                  ? `Created ${r.created.join(' and ')}`
                  : 'Packages were already set up');
              } catch (e) { toast.fail(e, 'Could not create the package plans'); }
            }}
          >
            {ensure.isPending ? 'Creating…' : 'Set up packages'}
          </PermissionButton>
        ) : undefined}
      />

      {/* A package price is a rate like any other, so it reaches the channels
          the same way — and is held back the same way. */}
      <ChannelPublishNote className="mb-4" />

      <QueryState query={plans} loadingRows={3}>
        {() => (
          <div className="space-y-4">
            {missing.length > 0 && (
              <Card>
                <p className="text-sm font-bold">
                  {missing.length === PACKAGES.length
                    ? 'No package prices are set up yet'
                    : `${missing.map((m) => m.label).join(' and ')} has no plan yet`}
                </p>
                <p className="mt-1 text-xs text-dash-muted leading-relaxed">
                  Until a package has a plan, the booking site quotes it as a room rate with the
                  lessons and desk added on top. "Set up packages" creates a rate plan for each
                  one, with no prices in it — you set those below.
                </p>
              </Card>
            )}

            {PACKAGES.map((pkg) => {
              const plan = packagePlans.find((p) => p.bookingModel === pkg.model);
              if (!plan) return null;
              return (
                <PackageCard
                  key={pkg.model}
                  plan={plan}
                  label={pkg.label}
                  blurb={pkg.blurb}
                  Icon={pkg.icon}
                  roomTypes={roomTypes.data ?? []}
                />
              );
            })}
          </div>
        )}
      </QueryState>
    </div>
  );
}

/**
 * One package: its standard price per room type, and a way to price a season.
 *
 * The standard price is the plan's base rate — what the site quotes on any date
 * nobody has priced specifically. The date range writes calendar cells, which
 * win over it. Both are shown together because a base rate that a calendar
 * override is quietly beating is the confusing half of rate management.
 */
function PackageCard({
  plan, label, blurb, Icon, roomTypes,
}: {
  plan: RatePlan;
  label: string;
  blurb: string;
  Icon: typeof Waves;
  roomTypes: RoomType[];
}) {
  const toast = useToast();
  const property = useAuthStore((s) => s.property);
  const today = property?.businessDate ?? new Date().toISOString().slice(0, 10);

  const update = useUpdateRatePlan();
  const bulk = useBulkRates();

  // Draft prices, keyed by room type. Held locally so a whole page of edits
  // saves as one change rather than firing a request per keystroke.
  const [draft, setDraft] = useState<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const rt of plan.roomTypes ?? []) out[rt.roomTypeId] = rt.baseRateMinor;
    return out;
  });

  const [seasonOpen, setSeasonOpen] = useState(false);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, 30));
  const [seasonPrice, setSeasonPrice] = useState(0);
  const [seasonRoomType, setSeasonRoomType] = useState('');

  // What the site actually quotes tonight, so the effect of a calendar override
  // is visible from here rather than only from the rate grid.
  const tonight = useRateCalendar(today, addDays(today, 1), undefined, plan.id);
  const resolvedFor = (roomTypeId: string): number | null => {
    const row = tonight.data?.rows.find((r) => r.roomTypeId === roomTypeId);
    return row?.cells[0]?.priceMinor ?? null;
  };

  const priceFor = (roomTypeId: string) => draft[roomTypeId] ?? 0;
  const dirty = (plan.roomTypes ?? []).some((rt) => priceFor(rt.roomTypeId) !== rt.baseRateMinor)
    || roomTypes.some((rt) => !(plan.roomTypes ?? []).some((p) => p.roomTypeId === rt.id)
      && priceFor(rt.id) > 0);
  const unpriced = roomTypes.filter((rt) => priceFor(rt.id) <= 0).length;

  async function saveStandard() {
    try {
      await update.mutateAsync({
        id: plan.id,
        body: {
          roomTypes: roomTypes.map((rt) => ({
            roomTypeId: rt.id,
            baseRateMinor: priceFor(rt.id),
          })),
        },
      });
      toast.success(`${label} prices saved`);
    } catch (e) { toast.fail(e, 'Could not save those prices'); }
  }

  async function applySeason() {
    try {
      const res = await bulk.mutateAsync({
        from,
        to,
        ratePlanIds: [plan.id],
        roomTypeIds: seasonRoomType ? [seasonRoomType] : undefined,
        priceMinor: seasonPrice,
      });
      const n = (res as { updated?: number })?.updated;
      toast.success(n === undefined ? 'Dates priced' : `${n} date${n === 1 ? '' : 's'} priced`);
      setSeasonOpen(false);
    } catch (e) { toast.fail(e, 'Could not price those dates'); }
  }

  const seasonValid = !!from && !!to && to >= from && seasonPrice > 0;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-dash-muted shrink-0" />
            <h3 className="text-sm font-bold truncate">{label}</h3>
            <Pill tone="grey">{plan.code}</Pill>
            {unpriced === 0
              ? <Pill tone="mint" solid>Priced</Pill>
              : <Pill tone="yellow" solid>{unpriced} room type{unpriced === 1 ? '' : 's'} unpriced</Pill>}
          </div>
          <p className="mt-1 text-xs text-dash-muted leading-relaxed">{blurb}</p>
          {plan.inclusions.length > 0 && (
            <p className="mt-1 text-[11px] text-dash-muted">
              Includes {plan.inclusions.join(', ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<CalendarRange className="w-3.5 h-3.5" />}
            onClick={() => setSeasonOpen((o) => !o)}
          >
            Price a season
          </Button>
          <PermissionButton
            permission="rates.write"
            size="sm"
            icon={<Save className="w-3.5 h-3.5" />}
            disabled={!dirty || update.isPending}
            onClick={saveStandard}
          >
            {update.isPending ? 'Saving…' : 'Save prices'}
          </PermissionButton>
        </div>
      </div>

      {/* Per room type, because a dorm bed in a surf package and a family room
          in the same package are not the same sale. */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted">
              <th className="pb-2 pr-4 font-bold">Room type</th>
              <th className="pb-2 pr-4 font-bold w-40">Package price / night</th>
              <th className="pb-2 font-bold">Quoted tonight</th>
            </tr>
          </thead>
          <tbody>
            {roomTypes.map((rt) => {
              const resolved = resolvedFor(rt.id);
              const overridden = resolved !== null && resolved !== priceFor(rt.id);
              return (
                <tr key={rt.id} className="border-t border-dash-line">
                  <td className="py-2 pr-4">
                    <span className="font-bold">{rt.name}</span>
                    <span className="ml-2 text-dash-muted">{rt.code}</span>
                  </td>
                  <td className="py-2 pr-4">
                    <MoneyInput
                      valueMinor={priceFor(rt.id)}
                      onChange={(minor) => setDraft((d) => ({ ...d, [rt.id]: minor }))}
                    />
                  </td>
                  <td className="py-2 text-dash-muted">
                    {resolved === null ? '—' : (
                      <>
                        {money(resolved)}
                        {/* Says which number the guest sees when the two differ,
                            rather than leaving the base rate looking live. */}
                        {overridden && (
                          <span className="ml-2 text-[10px] uppercase tracking-widest">
                            set for this date
                          </span>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {roomTypes.length === 0 && (
        <p className="mt-3 text-xs text-dash-muted">
          This property has no active room types, so there is nothing to price yet.
        </p>
      )}

      {seasonOpen && (
        <div className="mt-4 rounded-lg border border-dash-line p-3">
          <p className="text-xs font-bold">Price a date range</p>
          <p className="mt-1 text-[11px] text-dash-muted leading-relaxed">
            Writes this price onto every night in the range, which then beats the standard price
            above. Use it for a high season; leave it alone for the rest of the year.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="w-[9.5rem]">
              <Field label="From"><DateInput value={from} onChange={setFrom} /></Field>
            </div>
            <div className="w-[9.5rem]">
              <Field label="To"><DateInput value={to} onChange={setTo} min={from} /></Field>
            </div>
            <div className="w-[9.5rem]">
              <Field label="Price / night">
                <MoneyInput valueMinor={seasonPrice} onChange={setSeasonPrice} />
              </Field>
            </div>
            <div className="w-[13rem]">
              <Field label="Room type">
                <select
                  className="w-full rounded-lg border border-dash-line bg-white px-2 py-1.5 text-xs"
                  value={seasonRoomType}
                  onChange={(e) => setSeasonRoomType(e.target.value)}
                >
                  <option value="">Every room type</option>
                  {roomTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>{rt.name}</option>
                  ))}
                </select>
              </Field>
            </div>
            <PermissionButton
              permission="rates.write"
              size="sm"
              disabled={!seasonValid || bulk.isPending}
              onClick={applySeason}
            >
              {bulk.isPending ? 'Applying…' : 'Apply'}
            </PermissionButton>
          </div>
        </div>
      )}
    </Card>
  );
}
