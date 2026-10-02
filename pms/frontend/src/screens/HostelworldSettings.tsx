// ─────────────────────────────────────────────────────────────
// Configuration → Hostelworld.
//
// A Hostelworld guest agrees to one total on Hostelworld, pays part of it
// there and then — which Hostelworld keeps as its commission — and pays the
// rest at the desk. Out of the box the system shows the total and nothing
// else, so the desk asks for money Hostelworld already took.
//
// This tab switches on the split, and says where each figure comes from:
//
//   Total booking price    what the guest agreed to on Hostelworld
//   Hostelworld collected  the deposit Hostelworld took and keeps
//   Business price         Total − Collected: what the property receives
//
// It applies to Hostelworld bookings only. Every other booking is untouched
// whatever is chosen here.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { Save, Wand2, Globe, RefreshCw } from 'lucide-react';
import {
  useHostelworldSettings, useSaveHostelworldSettings, useApplyHostelworldSettings,
  useRefreshHostelworldFromChannel,
} from '../queries';
import { Card, Button, Field, Select, TextInput } from '../ui';
import { QueryState, useToast, PermissionButton, Toggle, InfoNote, ConfirmDialog } from '../components';
import { money, bpToPercent, percentToBp } from '../format';
import { HostelworldBadge, HostelworldMoney } from '../hostelworld';
import type { HostelworldSettings, HostelworldApplyResult, HostelworldRefreshResult } from '../types';

/** A worked example, because a percentage is easier to sanity-check as money. */
const EXAMPLE_TOTAL_MINOR = 10_000;

function describe(r: HostelworldApplyResult): string {
  const parts = [
    r.filled ? `${r.filled} given a collected amount` : '',
    r.posted ? `${r.posted} credit${r.posted === 1 ? '' : 's'} posted` : '',
    r.replaced ? `${r.replaced} credit${r.replaced === 1 ? '' : 's'} updated` : '',
    r.removed ? `${r.removed} credit${r.removed === 1 ? '' : 's'} removed` : '',
  ].filter(Boolean);
  return parts.length
    ? `${r.scanned} Hostelworld booking${r.scanned === 1 ? '' : 's'} checked · ${parts.join(', ')}`
    : `${r.scanned} Hostelworld booking${r.scanned === 1 ? '' : 's'} checked · nothing needed changing`;
}

function describeRefresh(r: HostelworldRefreshResult): string {
  const head = `${r.matched} booking${r.matched === 1 ? '' : 's'} matched on Beds24 · `
    + `${r.repriced} re-priced to Hostelworld's total · ${r.collected} collected amount${r.collected === 1 ? '' : 's'} set`;
  return r.errors.length ? `${head} · ${r.errors.join('; ')}` : head;
}

export function HostelworldSettingsTab() {
  const query = useHostelworldSettings();
  const save = useSaveHostelworldSettings();
  const apply = useApplyHostelworldSettings();
  const refresh = useRefreshHostelworldFromChannel();
  const toast = useToast();
  const [draft, setDraft] = useState<HostelworldSettings | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);

  useEffect(() => {
    if (query.data && !draft) setDraft({ ...query.data });
  }, [query.data, draft]);

  return (
    <QueryState query={query} loadingRows={4}>
      {() => {
        const d = draft;
        if (!d) return <div />;
        const set = (patch: Partial<HostelworldSettings>) => setDraft({ ...d, ...patch });
        const exampleCollected = Math.round((EXAMPLE_TOTAL_MINOR * d.percentBp) / 10_000);

        return (
          <div className="space-y-3">
            <Card>
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-4 h-4 text-dash-muted" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                  Hostelworld bookings
                </p>
                <HostelworldBadge className="ml-1" />
              </div>
              <p className="text-[11px] text-dash-muted leading-relaxed mb-4 max-w-2xl">
                Hostelworld collects a deposit from the guest when they book and keeps it as its
                commission. The guest pays the rest at the desk. With this on, every Hostelworld
                booking shows three figures instead of one — the total the guest agreed to, what
                Hostelworld collected, and the business price the property actually receives.
                Bookings from anywhere else are not affected.
              </p>

              <Toggle
                checked={d.enabled}
                onChange={(v) => set({ enabled: v })}
                label="Show Total, Hostelworld collected and Business price on Hostelworld bookings"
              />

              <div className={`grid md:grid-cols-2 gap-4 mt-5 ${d.enabled ? '' : 'opacity-50'}`}>
                <Field label="Where the collected amount comes from"
                  hint="Beds24 usually sends Hostelworld's deposit with the booking">
                  <Select
                    value={d.collectedMode}
                    onChange={(v) => set({ collectedMode: v as HostelworldSettings['collectedMode'] })}
                    options={[
                      { label: 'What Hostelworld reported, else the percentage below', value: 'channel' },
                      { label: 'Always the percentage below', value: 'percent' },
                    ]}
                  />
                </Field>
                {/* Text, not a number spinner: 12.5% is a real rate and stepping
                    by whole percent cannot express it. Stored as basis points. */}
                <Field label="Percentage of the total"
                  hint={d.collectedMode === 'percent'
                    ? 'Used for every Hostelworld booking'
                    : 'Used only when the booking arrived without a deposit figure'}>
                  <TextInput
                    value={String(bpToPercent(d.percentBp))}
                    onChange={(v) => set({ percentBp: Math.min(10_000, Math.max(0, percentToBp(v))) })}
                    placeholder="15"
                  />
                </Field>
              </div>

              <div className={`flex flex-wrap gap-6 mt-5 ${d.enabled ? '' : 'opacity-50'}`}>
                <Toggle
                  checked={d.useChannelTotal}
                  onChange={(v) => set({ useChannelTotal: v })}
                  label="Use the total Hostelworld sent as the booking total"
                />
                <Toggle
                  checked={d.postCredit}
                  onChange={(v) => set({ postCredit: v })}
                  label="Put the collected amount on the folio as a credit"
                />
              </div>
              <div className="mt-3 space-y-2 max-w-2xl">
                <p className="text-[11px] text-dash-muted leading-relaxed">
                  <span className="font-bold text-dash-text">Booking total.</span> On, the stay is
                  worth what the guest agreed to on Hostelworld. Off, it is re-priced from your own
                  rate plan the way every other channel booking is.
                </p>
                <p className="text-[11px] text-dash-muted leading-relaxed">
                  <span className="font-bold text-dash-text">Folio credit.</span> On, a line
                  "Collected by Hostelworld at booking" reduces the folio balance to the business
                  price, so check-in asks for the right amount and check-out closes at zero. It is
                  an adjustment, not a payment — it never appears in the till or the cash-up. Off,
                  the figures are shown but the folio is left exactly as it was.
                </p>
              </div>
            </Card>

            <Card tone="peach">
              <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-2">
                Worked example
              </p>
              <p className="text-[11px] text-dash-muted mb-3">
                A {money(EXAMPLE_TOTAL_MINOR)} Hostelworld booking that arrived without a deposit
                figure, at {bpToPercent(d.percentBp)}%:
              </p>
              <div className="max-w-xs">
                <HostelworldMoney split={{
                  totalMinor: EXAMPLE_TOTAL_MINOR,
                  collectedMinor: exampleCollected,
                  businessMinor: EXAMPLE_TOTAL_MINOR - exampleCollected,
                }} />
              </div>
            </Card>

            <InfoNote>
              Bookings imported before this was switched on were priced from your own rate plan and
              carry no collected amount. <span className="font-bold">Refresh from Beds24</span> re-reads
              every open booking from the channel and applies Hostelworld's own total and deposit —
              use this first. <span className="font-bold">Apply to existing bookings</span> is the
              fallback when Beds24 cannot be reached: it uses the percentage above. Saving keeps the
              folio credits in step with these settings, and a figure can always be corrected on the
              guest's stay overview.
            </InfoNote>

            <div className="flex flex-wrap justify-end gap-2">
              <PermissionButton
                permission="config.write"
                variant="secondary"
                icon={<RefreshCw className={`w-3.5 h-3.5 ${refresh.isPending ? 'animate-spin' : ''}`} />}
                disabled={!query.data?.enabled || refresh.isPending}
                onClick={async () => {
                  try {
                    const result = await refresh.mutateAsync();
                    if (result.errors.length && !result.channels) toast.fail(new Error(result.errors.join('; ')), 'Beds24 could not be read');
                    else toast.success(describeRefresh(result));
                  } catch (e) { toast.fail(e, 'Could not refresh from Beds24'); }
                }}
              >
                {refresh.isPending ? 'Reading Beds24…' : 'Refresh from Beds24'}
              </PermissionButton>
              <PermissionButton
                permission="config.write"
                variant="secondary"
                icon={<Wand2 className="w-3.5 h-3.5" />}
                disabled={!query.data?.enabled || apply.isPending}
                onClick={() => setApplyOpen(true)}
              >
                Apply to existing bookings
              </PermissionButton>
              <Button variant="secondary" onClick={() => setDraft({ ...query.data! })}>
                Discard changes
              </Button>
              <PermissionButton
                permission="config.write"
                icon={<Save className="w-3.5 h-3.5" />}
                disabled={save.isPending}
                onClick={async () => {
                  try {
                    const result = await save.mutateAsync(d);
                    setDraft({
                      enabled: result.enabled, collectedMode: result.collectedMode,
                      percentBp: result.percentBp, useChannelTotal: result.useChannelTotal,
                      postCredit: result.postCredit,
                    });
                    toast.success(`Hostelworld settings saved · ${describe(result.applied)}`);
                  } catch (e) { toast.fail(e, 'Could not save the Hostelworld settings'); }
                }}
              >
                {save.isPending ? 'Saving…' : 'Save'}
              </PermissionButton>
            </div>

            <ConfirmDialog
              open={applyOpen}
              onCancel={() => setApplyOpen(false)}
              busy={apply.isPending}
              title="Apply to existing Hostelworld bookings?"
              body={`Every open Hostelworld booking without a collected amount will be given one — ${bpToPercent(query.data?.percentBp ?? 0)}% of its total — and its folio credit posted if that option is on. Amounts already set are not changed.`}
              confirmLabel="Apply"
              onConfirm={async () => {
                try {
                  const result = await apply.mutateAsync();
                  toast.success(describe(result));
                  setApplyOpen(false);
                } catch (e) { toast.fail(e, 'Could not apply the settings'); }
              }}
            />
          </div>
        );
      }}
    </QueryState>
  );
}
