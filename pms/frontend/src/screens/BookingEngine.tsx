// The property's own booking page: where its link is, whether it works, and
// the two lines of copy at the top of it.
//
// Setting up rooms is the whole of setting up a booking engine. There is no
// separate site to build or deploy — the API serves the page and reads the
// rooms, rates and availability straight out of the PMS. This screen exists to
// hand somebody the link, and to say plainly when the link would open onto an
// empty page.
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Globe, Copy, Check, ExternalLink, QrCode, AlertTriangle, Power, BedDouble, CalendarRange,
  Wallet, Timer, Sparkles,
} from 'lucide-react';
import {
  useBookingLink, useUpdateBookingLink, useBookingMoney, useUpdateBookingMoney,
  useWebsiteAddons, useUpdateWebsiteAddons,
  type BookingLink, type WebsiteAddon,
} from '../queries';
import { Card, Button, Field, TextInput, Select, Pill } from '../ui';
import { money as fmtMoney, fromMinor, toMinor } from '../format';
import { QueryState, useToast, PermissionButton, WarnNote, InfoNote } from '../components';
import { useNav } from '../nav';

export function BookingEngineTab() {
  return (
    <QueryState query={useBookingLink()} loadingRows={4}>
      {(data) => <Engine data={data} />}
    </QueryState>
  );
}

function Engine({ data }: { data: BookingLink }) {
  const toast = useToast();
  const update = useUpdateBookingLink();
  const { navigate } = useNav();

  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [tagline, setTagline] = useState(data.tagline);
  const [intro, setIntro] = useState(data.intro);

  // Re-seeded whenever the server's copy changes — otherwise a save made in
  // another tab leaves this form showing the old words.
  useEffect(() => { setTagline(data.tagline); setIntro(data.intro); }, [data.tagline, data.intro]);

  useEffect(() => {
    if (!showQr) return;
    QRCode.toDataURL(data.url, { width: 260, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setQr(null));
  }, [showQr, data.url]);

  const ready = data.readiness.ready;
  const live = data.enabled && ready;
  const dirty = tagline !== data.tagline || intro !== data.intro;

  async function copy() {
    try {
      await navigator.clipboard.writeText(data.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is refused on an insecure origin and in some
      // browsers. The address is on screen and selectable either way, so this
      // says so rather than failing silently.
      toast.push({ kind: 'warn', title: 'Could not copy', body: 'Select the address and copy it by hand.' });
    }
  }

  async function save(body: { enabled?: boolean; tagline?: string; intro?: string }) {
    try {
      await update.mutateAsync(body);
      toast.success(
        body.enabled === true ? 'Booking page switched on'
          : body.enabled === false ? 'Booking page switched off'
            : 'Saved',
      );
    } catch (e) { toast.fail(e, 'Could not save'); }
  }

  return (
    <div className="space-y-3">
      {/* ── The link ── */}
      <Card tone={live ? 'mint' : ready ? 'yellow' : 'peach'}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-bold mb-1">
                {live ? 'Your booking page is live'
                  : ready ? 'Your booking page is switched off'
                    : 'Your booking page is not ready yet'}
              </p>
              <p className="text-[12px] text-dash-muted leading-relaxed max-w-xl">
                {live
                  ? <>Guests can book {data.property.name} directly at the address below. Every
                    booking arrives in Reservations awaiting your confirmation — nothing takes a
                    bed until you accept it.</>
                  : ready
                    ? <>The page is built and working, but switched off. Anyone opening the link is
                      asked to contact you instead.</>
                    : <>The page is switched on, but there is nothing to sell yet. Fix the points
                      below and it starts working immediately — there is nothing to rebuild.</>}
              </p>
            </div>
          </div>
          <PermissionButton
            permission="config.write"
            variant={data.enabled ? 'secondary' : 'primary'}
            icon={<Power className="w-3.5 h-3.5" />}
            disabled={update.isPending}
            onClick={() => save({ enabled: !data.enabled })}
          >
            {data.enabled ? 'Switch off' : 'Switch on'}
          </PermissionButton>
        </div>

        <div className="mt-5 pt-4 border-t border-black/5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-2">
            Share this address
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-[13px] font-mono bg-white/70 rounded-lg px-3 py-2 break-all grow min-w-0">
              {data.url}
            </code>
            <Button variant="secondary" size="sm" onClick={copy}
              icon={copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowQr((v) => !v)}
              icon={<QrCode className="w-3.5 h-3.5" />}>
              {showQr ? 'Hide code' : 'QR code'}
            </Button>
            <a href={data.url} target="_blank" rel="noreferrer">
              <Button variant="secondary" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />}>
                Open
              </Button>
            </a>
          </div>

          {showQr && (
            <div className="mt-4 flex items-start gap-4 flex-wrap">
              {qr
                ? <img src={qr} alt={`QR code for ${data.url}`} width={200} height={200}
                    className="rounded-xl bg-white p-2" />
                : <div className="w-[200px] h-[200px] rounded-xl bg-white/60 animate-pulse" />}
              <p className="text-[11px] text-dash-muted leading-relaxed max-w-xs">
                Print this for the front desk, the common room or a flyer. A guest checking out
                scans it to book their next stay without going through an OTA — which is the
                cheapest booking the property will ever take.
              </p>
            </div>
          )}

          {/localhost|127\.0\.0\.1/.test(data.url) && (
            <p className="text-[11px] text-dash-muted mt-3 leading-relaxed">
              This address only works on this computer. To let guests reach it from their own
              phones, put the PMS on an address they can open and set{' '}
              <span className="font-mono">HELIO_BOOKING_SITE_URL</span> on the API to match.
            </p>
          )}
        </div>
      </Card>

      {/* ── Readiness ── */}
      {!ready && (
        <WarnNote>
          <span className="font-semibold">Before the page can sell anything:</span>
          <ul className="list-disc ml-5 mt-1 space-y-0.5">
            {data.readiness.blocking.map((b) => <li key={b}>{b}</li>)}
          </ul>
        </WarnNote>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Readiness
          icon={<BedDouble className="w-4 h-4" />}
          label="Room types on sale"
          value={String(data.readiness.roomTypes)}
          hint="Every active room type is offered."
          ok={data.readiness.roomTypes > 0}
          onClick={() => navigate('config')}
        />
        <Readiness
          icon={<BedDouble className="w-4 h-4" />}
          label="Rooms & beds sellable"
          value={String(data.readiness.sellableUnits)}
          hint="A dorm counts its beds; a private room counts as one."
          ok={data.readiness.sellableUnits > 0}
          onClick={() => navigate('config')}
        />
        <Readiness
          icon={<CalendarRange className="w-4 h-4" />}
          label="Days priced ahead"
          value={String(data.readiness.pricedDaysAhead)}
          hint="A date with no rate cannot be quoted or sold."
          ok={data.readiness.pricedDaysAhead > 0}
          onClick={() => navigate('rates-inventory')}
        />
      </div>

      {/* ── Copy ── */}
      <Card>
        <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
          What the page says
        </p>
        <div className="space-y-3 max-w-2xl">
          <Field label="Tagline" hint="One line under the property name.">
            <TextInput value={tagline} onChange={setTagline} />
          </Field>
          <Field label="Intro" hint="A sentence or two on why to book direct.">
            <TextInput value={intro} onChange={setIntro} />
          </Field>
          <div className="flex gap-2">
            <PermissionButton
              permission="config.write"
              disabled={!dirty || update.isPending}
              onClick={() => save({ tagline, intro })}
            >
              {update.isPending ? 'Saving…' : 'Save'}
            </PermissionButton>
            {dirty && (
              <Button variant="ghost"
                onClick={() => { setTagline(data.tagline); setIntro(data.intro); }}>
                Discard
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Money />

      <WebsiteAddons />

      <InfoNote>
        The page has no separate copy of anything. Room names, descriptions, prices, stay limits
        and what is free all come from this PMS as the guest loads the page — so a rate changed in
        Rates &amp; Inventory is quoted on the next booking, with nothing to publish or rebuild.
      </InfoNote>
    </div>
  );
}

function Readiness({ icon, label, value, hint, ok, onClick }: {
  icon: React.ReactNode; label: string; value: string; hint: string;
  ok: boolean; onClick: () => void;
}) {
  return (
    <Card onClick={onClick}>
      <div className="flex items-center gap-2 mb-1 text-dash-muted">
        {ok ? icon : <AlertTriangle className="w-4 h-4 text-status-warn" />}
        <p className="text-[10px] font-bold uppercase tracking-widest">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${ok ? '' : 'text-status-warn'}`}>{value}</p>
      <p className="text-[11px] text-dash-muted mt-1 leading-relaxed">{hint}</p>
    </Card>
  );
}

/* ──────────────────────────────────────── website add-ons ── */

const ADDON_GROUPS: { group: WebsiteAddon['group']; label: string }[] = [
  { group: 'surf', label: 'Surfing' },
  { group: 'skate', label: 'Skating' },
  { group: 'yoga', label: 'Yoga' },
  { group: 'coworking', label: 'Co-working' },
];

/**
 * Prices for the add-ons the property's own website sells beside the room.
 *
 * The website reads them, with every room's "from" price, from
 * /api/public/website-prices on each page load — so a price saved here is on
 * the site straight away. Room prices are not here: they come from Rates &
 * Inventory like every other rate.
 */
function WebsiteAddons() {
  const toast = useToast();
  const q = useWebsiteAddons();
  const save = useUpdateWebsiteAddons();
  // Editable text per add-on id, so a half-typed "12." is not reformatted under the cursor.
  const [draft, setDraft] = useState<Record<string, string> | null>(null);

  const seed = () => {
    if (q.data) setDraft(Object.fromEntries(q.data.addons.map((a) => [a.id, fromMinor(a.priceMinor)])));
  };

  // Re-seeded whenever the server's copy changes, including right after a save.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(seed, [q.data]);

  if (q.isLoading || !q.data || !draft) {
    return <div className="h-40 rounded-task bg-black/5 animate-pulse" />;
  }
  const { addons, currency } = q.data;
  if (addons.length === 0) return null;

  const changed = addons.filter((a) => toMinor(draft[a.id] ?? '') !== a.priceMinor);

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-dash-muted" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
          Website add-ons
        </p>
      </div>
      <p className="text-[12px] text-dash-muted leading-relaxed max-w-2xl mb-4">
        What your website charges for surf, skate, yoga and desk passes, in {currency}. Saved
        prices show on the website on its next page load. Room prices come from Rates &amp;
        Inventory.
      </p>

      <div className="grid md:grid-cols-2 gap-x-6 gap-y-5 max-w-3xl">
        {ADDON_GROUPS.map(({ group, label }) => {
          const items = addons.filter((a) => a.group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              <p className="text-[11px] font-semibold mb-2">{label}</p>
              <div className="space-y-2">
                {items.map((a) => (
                  <Field key={a.id} label={`${a.name}${a.unit}`}>
                    <TextInput
                      value={draft[a.id] ?? ''}
                      onChange={(v) => setDraft({ ...draft, [a.id]: v })}
                    />
                  </Field>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 mt-4">
        <PermissionButton permission="config.write" disabled={!changed.length || save.isPending}
          onClick={async () => {
            try {
              await save.mutateAsync({
                prices: Object.fromEntries(changed.map((a) => [a.id, toMinor(draft[a.id] ?? '')])),
              });
              toast.success('Saved — the website shows the new prices now');
            } catch (e) { toast.fail(e, 'Could not save'); }
          }}>
          {save.isPending ? 'Saving…' : 'Save'}
        </PermissionButton>
        {changed.length > 0 && (
          <Button variant="ghost" onClick={seed}>Discard</Button>
        )}
      </div>
    </Card>
  );
}

/* ─────────────────────────────────────────────── money ── */

/**
 * What the page asks a guest to pay, and how long a booking holds its bed.
 *
 * One card for both, because they are the same commercial decision seen from
 * two sides: how much friction to put in front of a direct booking, and how
 * long to protect one once it has arrived. Turning the deposit up and the hold
 * down are both ways of saying "we do not want speculative bookings".
 */
function Money() {
  const toast = useToast();
  const q = useBookingMoney();
  const save = useUpdateBookingMoney();
  const [draft, setDraft] = useState<any>(null);

  useEffect(() => {
    if (q.data && !draft) setDraft({ ...q.data.deposit, holdHours: q.data.holdHours });
  }, [q.data, draft]);

  if (q.isLoading || !draft || !q.data) {
    return <div className="h-40 rounded-task bg-black/5 animate-pulse" />;
  }
  const d = q.data;
  const dirty = JSON.stringify(draft) !== JSON.stringify({ ...d.deposit, holdHours: d.holdHours });

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <Wallet className="w-4 h-4 text-dash-muted" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
          What you collect
        </p>
      </div>
      <p className="text-[12px] text-dash-muted leading-relaxed max-w-2xl mb-4">
        A direct booking that asks for nothing costs nothing to abandon, which is most of why
        no-show rates on direct and OTA bookings are not comparable. Nothing is charged by this
        PMS &mdash; there is no card processing here &mdash; but the amount is stated to the guest
        and recorded against the booking as owed, so the desk can ask for it.
      </p>

      <div className="grid md:grid-cols-2 gap-4 max-w-3xl">
        <Field label="Deposit" hint="Asked for when the guest books.">
          <Select value={draft.mode} onChange={(v) => setDraft({ ...draft, mode: v })} options={[
            { label: 'Nothing — confirm by email', value: 'none' },
            { label: 'A percentage of the stay', value: 'percent' },
            { label: 'The first night', value: 'first_night' },
            { label: 'The full amount', value: 'full' },
          ]} />
        </Field>

        {draft.mode === 'percent' && (
          <Field label="How much" hint="Of the grand total, tax included.">
            <Select value={String(draft.percentBp)}
              onChange={(v) => setDraft({ ...draft, percentBp: Number(v) })}
              options={[1000, 1500, 2000, 2500, 3000, 5000].map((bp) => ({
                label: `${bp / 100}%`, value: String(bp),
              }))} />
          </Field>
        )}

        <Field label="How long a booking holds its bed"
          hint={`Between ${d.limits.minHoldHours} and ${d.limits.maxHoldHours} hours. After this `
            + 'the booking is cancelled and the bed goes back on sale — on your own page and on '
            + 'every OTA.'}>
          <Select value={String(draft.holdHours)}
            onChange={(v) => setDraft({ ...draft, holdHours: Number(v) })}
            options={[2, 4, 6, 12, 24, 48, 72, 168].map((h) => ({
              label: h < 24 ? `${h} hours` : `${h / 24} day${h === 24 ? '' : 's'}`,
              value: String(h),
            }))} />
        </Field>

        <Field label="What the page says about paying" className="md:col-span-2"
          hint="Shown under the total and on the checkout step. Your words, not ours.">
          <TextInput value={draft.message} onChange={(v) => setDraft({ ...draft, message: v })} />
        </Field>

        <Field label="Ways you accept payment" className="md:col-span-2"
          hint="Comma separated. Listed on the page so a guest knows what to expect.">
          <TextInput
            value={(draft.methods ?? []).join(', ')}
            onChange={(v) => setDraft({
              ...draft,
              methods: v.split(',').map((x: string) => x.trim()).filter(Boolean),
            })} />
        </Field>
      </div>

      <div className="flex gap-2 mt-4">
        <PermissionButton permission="config.write" disabled={!dirty || save.isPending}
          onClick={async () => {
            try {
              await save.mutateAsync({
                deposit: {
                  mode: draft.mode, percentBp: draft.percentBp,
                  message: draft.message, methods: draft.methods,
                },
                holdHours: draft.holdHours,
              });
              toast.success('Saved');
            } catch (e) { toast.fail(e, 'Could not save'); }
          }}>
          {save.isPending ? 'Saving…' : 'Save'}
        </PermissionButton>
        {dirty && (
          <Button variant="ghost"
            onClick={() => setDraft({ ...d.deposit, holdHours: d.holdHours })}>Discard</Button>
        )}
      </div>

      {d.activeHolds.length > 0 && (
        <div className="mt-5 pt-4 border-t border-black/5">
          <div className="flex items-center gap-2 mb-2">
            <Timer className="w-3.5 h-3.5 text-dash-muted" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
              Holding a bed right now
            </p>
          </div>
          <div className="space-y-1.5">
            {d.activeHolds.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 text-[12px]">
                <span className="truncate">
                  <span className="font-mono text-[11px]">{h.confirmation}</span>
                  {' · '}{h.guestName}
                  <span className="text-dash-muted">{' · '}{h.arrival} → {h.departure}</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-dash-muted">{fmtMoney(h.totalMinor, { currency: d.currency })}</span>
                  <Pill tone={h.minutesLeft < 120 ? 'peach' : 'grey'}>
                    {h.minutesLeft > 60
                      ? `${Math.round(h.minutesLeft / 60)}h left`
                      : `${h.minutesLeft}m left`}
                  </Pill>
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-dash-muted mt-2 leading-relaxed">
            Confirm these in Reservations to keep the beds. Anything not confirmed in time is
            cancelled automatically and the beds go back on sale.
          </p>
        </div>
      )}
    </Card>
  );
}
