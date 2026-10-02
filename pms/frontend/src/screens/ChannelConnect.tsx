// Connecting the channel manager, as a guided sequence.
//
// This replaces a dialog with one field in it. Connecting a channel manager is
// the moment a property's inventory stops being private, and almost everything
// that goes wrong with it goes wrong quietly: a token created without write
// permission connects perfectly and never pushes a rate; a multi-property
// account binds to the wrong property; the rooms never get mapped and the push
// has nowhere to go.
//
// So the screen is built around showing state rather than collecting input.
// Four things have to be true before distribution works, they are listed in
// order, each says whether it is done, and the one that is not done says what
// to do about it.
import { useEffect, useMemo, useState } from 'react';
import {
  KeyRound, ShieldCheck, ShieldAlert, Building2, Link2, RefreshCw, Check, X,
  ExternalLink, AlertTriangle, Clock, Gauge, Plug, PlugZap, ChevronRight,
} from 'lucide-react';
import {
  useChannels, useConnectionGuide, useConnectionDiagnosis, useConnectChannel,
  useTestChannel, useDisconnectChannel, useRoomSuggestions, useApplyRoomSuggestions,
  type ConnectionDiagnosis, type RoomSuggestion,
} from '../queries';
import { Card, Button, Field, TextInput, Select, Pill } from '../ui';
import { useToast, PermissionButton, InfoNote, WarnNote, ConfirmDialog } from '../components';
import { CHANNEL_HUB, CHANNEL_HUB_TITLE } from '../branding';

export function ConnectionTab() {
  const channels = useChannels();
  const hub = useMemo(
    // The hub connection is the one that carries credentials. Everything else
    // in the channel list is a shopfront behind it.
    () => (channels.data ?? []).find((c: any) => c.code === 'BEDS24') ?? (channels.data ?? [])[0],
    [channels.data],
  );

  if (channels.isLoading) return <div className="h-40 rounded-task bg-black/5 animate-pulse" />;
  if (!hub) {
    return (
      <InfoNote>
        No channel connection exists yet. Add one from the Channels tab, then come back here
        to connect it.
      </InfoNote>
    );
  }
  return <Wizard channelId={hub.id} channel={hub} />;
}

function Wizard({ channelId, channel }: { channelId: string; channel: any }) {
  const toast = useToast();
  const guide = useConnectionGuide();
  const diag = useConnectionDiagnosis(channelId);
  const connect = useConnectChannel();
  const test = useTestChannel();
  const disconnect = useDisconnectChannel();

  const d = diag.data;
  const connected = !!d?.reachable;
  const [showDisconnect, setShowDisconnect] = useState(false);

  // The four things that have to be true, in the order they become true.
  const steps = [
    { key: 'token', label: 'Credential', done: !!d?.credential.hasRefreshToken },
    { key: 'scopes', label: 'Permissions', done: !!d && d.scopes.known && d.scopes.blocking.length === 0 },
    { key: 'property', label: 'Property', done: !!d?.boundPropertyId && !d.boundPropertyMissing },
    { key: 'rooms', label: 'Rooms', done: false },
  ];

  return (
    <div className="space-y-3">
      <Header
        connected={connected}
        diagnosis={d}
        loading={diag.isFetching}
        onRecheck={() => diag.refetch()}
        onTest={async () => {
          try {
            const r: any = await test.mutateAsync({ id: channelId });
            if (r.ok) toast.success('Connection is live', `${r.properties?.length ?? 0} propert(ies) visible`);
            else toast.push({ kind: 'error', title: 'Test failed', body: r.error });
            diag.refetch();
          } catch (e) { toast.fail(e, 'Test failed'); }
        }}
        testing={test.isPending}
        onDisconnect={() => setShowDisconnect(true)}
      />

      {diag.isLoading && <div className="h-32 rounded-task bg-black/5 animate-pulse" />}

      {d?.credentialUnreadable && (
        <WarnNote>
          <span className="font-semibold">The stored credential cannot be decrypted.</span>{' '}
          This happens when <span className="font-mono">HELIO_SECRET_KEY</span> changed, or a
          database was restored beside a different one. Nothing can read it again — create a
          fresh invite code below and reconnect.
        </WarnNote>
      )}

      <StepRail steps={steps} />

      {/* ── 1. Credential ── */}
      <Step n={1} title="Give this PMS a credential" done={steps[0].done}>
        {steps[0].done ? (
          <TokenHealth diagnosis={d!} />
        ) : (
          <Connect
            guide={guide.data}
            busy={connect.isPending}
            onConnect={async (body) => {
              try {
                const r: any = await connect.mutateAsync({ id: channelId, body });
                if (r.ok === false) {
                  toast.push({ kind: 'error', title: 'Could not connect', body: r.error });
                } else {
                  toast.success(`${CHANNEL_HUB_TITLE} connected`);
                }
                diag.refetch();
              } catch (e) { toast.fail(e, 'Could not connect'); }
            }}
          />
        )}
      </Step>

      {/* ── 2. Permissions ── */}
      {steps[0].done && (
        <Step n={2} title="Check what the token is allowed to do" done={steps[1].done}>
          <Scopes diagnosis={d!} guide={guide.data} />
        </Step>
      )}

      {/* ── 3. Property ── */}
      {steps[1].done && (
        <Step n={3} title="Choose which property this is" done={steps[2].done}>
          <PropertyBinding
            diagnosis={d!}
            busy={connect.isPending}
            onBind={async (externalPropertyId) => {
              try {
                // Re-running connect with the existing refresh token is how the
                // binding is changed: the credential is untouched, only the
                // property it points at moves.
                await connect.mutateAsync({ id: channelId, body: { externalPropertyId, keepCredential: true } });
                toast.success('Property set');
                diag.refetch();
              } catch (e) { toast.fail(e, 'Could not set the property'); }
            }}
          />
        </Step>
      )}

      {/* ── 4. Rooms ── */}
      {steps[2].done && (
        <Step n={4} title="Match the rooms on both sides" done={steps[3].done}>
          <RoomMatching channelId={channelId} />
        </Step>
      )}

      <ConfirmDialog
        open={showDisconnect}
        title={`Disconnect ${channel.name}?`}
        body={
          'The stored credential is deleted and all distribution stops immediately — no rates, '
          + 'no availability, no booking imports. Your room mappings are kept, so reconnecting '
          + 'later does not mean setting them up again.'
        }
        confirmLabel="Disconnect"
        onCancel={() => setShowDisconnect(false)}
        onConfirm={async () => {
          try {
            await disconnect.mutateAsync({ id: channelId });
            toast.success('Disconnected');
            setShowDisconnect(false);
            diag.refetch();
          } catch (e) { toast.fail(e, 'Could not disconnect'); }
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────── header ── */

function Header({ connected, diagnosis, loading, onRecheck, onTest, testing, onDisconnect }: {
  connected: boolean;
  diagnosis?: ConnectionDiagnosis;
  loading: boolean;
  onRecheck: () => void;
  onTest: () => void;
  testing: boolean;
  onDisconnect: () => void;
}) {
  const blocking = diagnosis?.scopes.blocking.length ?? 0;
  const tone = !connected ? 'peach' : blocking > 0 ? 'yellow' : 'mint';
  const headline = !connected
    ? `Not connected to ${CHANNEL_HUB}`
    : blocking > 0
      ? 'Connected, but not allowed to do everything'
      : `Connected to ${CHANNEL_HUB}`;

  return (
    <Card tone={tone}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center shrink-0">
            {connected ? <PlugZap className="w-5 h-5" /> : <Plug className="w-5 h-5" />}
          </div>
          <div>
            <p className="text-[15px] font-bold mb-1">{headline}</p>
            <p className="text-[12px] text-dash-muted leading-relaxed max-w-2xl">
              {!connected
                ? <>Your rooms are sold only through this PMS and your own booking page. Connect{' '}
                  {CHANNEL_HUB} to sell the same beds on Booking.com, Hostelworld, Airbnb and the
                  rest without keeping three calendars by hand.</>
                : blocking > 0
                  ? <>The credential works, but it is missing permission for things this PMS does.
                    Until that is fixed those actions fail silently — see below.</>
                  : <>Rates, availability and stay rules go out automatically; bookings come back
                    in. Your booking page and the OTAs now sell from one pool of beds.</>}
            </p>
            {diagnosis?.error && !diagnosis.credentialUnreadable && (
              <p className="text-[12px] text-status-bad mt-2 font-mono break-all">{diagnosis.error}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={onRecheck} disabled={loading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}>
            Re-check
          </Button>
          {connected && (
            <>
              <PermissionButton permission="channels.write" variant="secondary" size="sm"
                onClick={onTest} disabled={testing}>
                {testing ? 'Testing…' : 'Test now'}
              </PermissionButton>
              <PermissionButton permission="channels.write" variant="danger" size="sm"
                onClick={onDisconnect}>
                Disconnect
              </PermissionButton>
            </>
          )}
        </div>
      </div>

      {connected && diagnosis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-black/5">
          <Metric icon={<Building2 className="w-3.5 h-3.5" />} label="Property"
            value={diagnosis.boundPropertyName ?? (diagnosis.boundPropertyId ? 'Unknown' : 'Not set')} />
          <Metric icon={<ShieldCheck className="w-3.5 h-3.5" />} label="Permissions"
            value={!diagnosis.scopes.known ? 'Unknown'
              : diagnosis.scopes.blocking.length ? `${diagnosis.scopes.blocking.length} missing`
                : 'All present'} />
          <Metric icon={<Clock className="w-3.5 h-3.5" />} label="Access token"
            value={diagnosis.credential.accessTokenMinutesLeft === null ? '—'
              : diagnosis.credential.accessTokenMinutesLeft > 60
                ? `${Math.round(diagnosis.credential.accessTokenMinutesLeft / 60)}h left`
                : `${Math.max(0, diagnosis.credential.accessTokenMinutesLeft)}m left`} />
          <Metric icon={<Gauge className="w-3.5 h-3.5" />} label="API credit"
            value={diagnosis.credits.remaining === null ? '—'
              : `${diagnosis.credits.remaining}${diagnosis.credits.limit ? ` / ${diagnosis.credits.limit}` : ''}`} />
        </div>
      )}
    </Card>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-dash-muted mb-1">
        {icon}
        <p className="text-[10px] font-bold uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-[14px] font-bold truncate" title={value}>{value}</p>
    </div>
  );
}

/* ───────────────────────────────────────────── step rail ── */

function StepRail({ steps }: { steps: { key: string; label: string; done: boolean }[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap text-[11px]">
      {steps.map((s, i) => (
        <span key={s.key} className="flex items-center gap-1">
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
            s.done ? 'border-status-ok/30 bg-status-ok/10 text-status-ok'
              : 'border-black/10 text-dash-muted'}`}>
            {s.done ? <Check className="w-3 h-3" /> : <span className="w-3 text-center">{i + 1}</span>}
            {s.label}
          </span>
          {i < steps.length - 1 && <ChevronRight className="w-3 h-3 text-dash-muted" />}
        </span>
      ))}
    </div>
  );
}

function Step({ n, title, done, children }: {
  n: number; title: string; done: boolean; children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
          done ? 'bg-status-ok/15 text-status-ok' : 'bg-black/5 text-dash-muted'}`}>
          {done ? <Check className="w-3.5 h-3.5" /> : n}
        </span>
        <p className="text-[13px] font-bold">{title}</p>
      </div>
      {children}
    </Card>
  );
}

/* ──────────────────────────────────────────── 1. connect ── */

function Connect({ guide, busy, onConnect }: {
  guide: any; busy: boolean; onConnect: (body: Record<string, unknown>) => void;
}) {
  const [mode, setMode] = useState<'invite' | 'refresh'>('invite');
  const [value, setValue] = useState('');
  const [externalPropertyId, setExternalPropertyId] = useState('');

  return (
    <div className="space-y-4">
      {/* What the two tokens are. The words appear all over the Beds24 UI and
          nobody explains which is which. */}
      {guide?.tokens && (
        <div className="grid sm:grid-cols-2 gap-2">
          {guide.tokens.map((t: any) => (
            <div key={t.name} className="rounded-xl border border-black/10 p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-[12px] font-bold flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />{t.name}
                </p>
                <Pill tone="grey">{t.lifetime}</Pill>
              </div>
              <p className="text-[11px] text-dash-muted leading-relaxed">{t.role}</p>
            </div>
          ))}
        </div>
      )}

      {/* Where to click. */}
      {guide?.steps && (
        <ol className="space-y-2">
          {guide.steps.map((s: any, i: number) => (
            <li key={s.title} className="flex gap-3">
              <span className="w-5 h-5 shrink-0 rounded-full bg-black/5 text-[10px] font-bold
                               flex items-center justify-center mt-0.5">{i + 1}</span>
              <div>
                <p className="text-[12px] font-semibold">{s.title}</p>
                <p className="text-[11px] text-dash-muted leading-relaxed">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* The permissions to tick, named exactly as they appear in Beds24. */}
      {guide?.scopes && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-2">
            Tick these permissions on the invite code
          </p>
          <div className="space-y-1.5">
            {guide.scopes.map((s: any) => (
              <div key={s.scope} className="flex items-start gap-2 rounded-lg bg-black/[.03] p-2">
                <code className="text-[11px] font-mono font-bold shrink-0">{s.scope}</code>
                <span className="text-[11px] text-dash-muted leading-relaxed">
                  {s.needed}{!s.required && <span className="italic"> (optional)</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-1 border-t border-black/5 space-y-3">
        <Field label="What are you pasting?">
          <Select value={mode} onChange={(v) => { setMode(v as any); setValue(''); }} options={[
            { label: 'An invite code — the normal way', value: 'invite' },
            { label: 'A refresh token I already have', value: 'refresh' },
          ]} />
        </Field>
        <Field
          label={mode === 'invite' ? 'Invite code' : 'Refresh token'}
          hint={mode === 'invite'
            ? 'Single use, and it expires 24 hours after you create it.'
            : 'Only if you already exchanged a code elsewhere. Stored encrypted, never shown again.'}
          required>
          <TextInput value={value} onChange={setValue}
            placeholder={mode === 'invite' ? 'Paste the invite code' : 'Paste the refresh token'} />
        </Field>
        <Field label="Property id"
          hint="Optional. Leave blank and this PMS reads it from the connection when the account holds only one.">
          <TextInput value={externalPropertyId} onChange={setExternalPropertyId} />
        </Field>
        <PermissionButton
          permission="channels.write"
          disabled={busy || !value.trim()}
          onClick={() => onConnect({
            inviteCode: mode === 'invite' ? value.trim() : undefined,
            refreshToken: mode === 'refresh' ? value.trim() : undefined,
            externalPropertyId: externalPropertyId.trim() || undefined,
          })}>
          {busy ? 'Connecting…' : 'Connect'}
        </PermissionButton>
        <p className="text-[11px] text-dash-muted leading-relaxed">
          The credential is checked against the live API before it is kept. If it is wrong, or
          missing a permission, you will see exactly which — nothing is stored on a failed attempt.
        </p>
      </div>
    </div>
  );
}

function TokenHealth({ diagnosis }: { diagnosis: ConnectionDiagnosis }) {
  const mins = diagnosis.credential.accessTokenMinutesLeft;
  return (
    <div className="space-y-2">
      <Row ok label="Refresh token stored"
        detail="Encrypted at rest. This is the connection itself — revoke it in the channel
                manager account and distribution stops everywhere, immediately." />
      <Row
        ok={mins === null || mins > 0}
        label={mins === null ? 'Access token not yet minted'
          : mins > 0 ? `Access token valid for ${mins > 60 ? `${Math.round(mins / 60)} hours` : `${mins} minutes`}`
            : 'Access token expired'}
        detail="Minted from the refresh token whenever it is needed and kept in memory only.
                An expired one is not a problem — the next call mints another." />
      {diagnosis.ownerId && (
        <Row ok label={`Channel account #${diagnosis.ownerId}`}
          detail="The account this credential belongs to. Worth checking against the account you
                  meant to connect, if you manage more than one." />
      )}
    </div>
  );
}

/* ───────────────────────────────────────────── 2. scopes ── */

function Scopes({ diagnosis, guide }: { diagnosis: ConnectionDiagnosis; guide: any }) {
  const { scopes } = diagnosis;

  if (!scopes.known) {
    return (
      <InfoNote>
        This credential could not be asked what it is allowed to do. That is not the same as
        having no permissions — older tokens do not answer the question. If pushes start failing,
        create a fresh invite code with every permission ticked.
      </InfoNote>
    );
  }

  const all = guide?.scopes ?? [];
  const isMissing = (scope: string) => scopes.missing.some((m) => m.scope === scope);

  return (
    <div className="space-y-2">
      {scopes.blocking.length > 0 && (
        <WarnNote>
          <span className="font-semibold">
            {scopes.blocking.length === 1 ? 'One permission is missing' : `${scopes.blocking.length} permissions are missing`},
            and the connection will not work properly without {scopes.blocking.length === 1 ? 'it' : 'them'}.
          </span>{' '}
          Create a new invite code in {CHANNEL_HUB} with every box ticked, then reconnect above.
          Nothing else needs redoing — your room mappings are kept.
        </WarnNote>
      )}

      {all.map((s: any) => (
        <Row
          key={s.scope}
          ok={!isMissing(s.scope)}
          warn={isMissing(s.scope) && !s.required}
          label={s.label}
          code={s.scope}
          detail={isMissing(s.scope) ? s.needed : undefined}
        />
      ))}

      {scopes.extra.length > 0 && (
        <p className="text-[11px] text-dash-muted leading-relaxed pt-1">
          This token also grants {scopes.extra.map((e) => <code key={e} className="font-mono">{e} </code>)}
          which this PMS never uses. Harmless, but you can narrow it when you next re-issue the code.
        </p>
      )}
    </div>
  );
}

function Row({ ok, warn, label, code, detail }: {
  ok: boolean; warn?: boolean; label: string; code?: string; detail?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0">
        {ok ? <Check className="w-4 h-4 text-status-ok" />
          : warn ? <AlertTriangle className="w-4 h-4 text-status-warn" />
            : <X className="w-4 h-4 text-status-bad" />}
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold flex items-center gap-2 flex-wrap">
          {label}
          {code && <code className="text-[10px] font-mono text-dash-muted">{code}</code>}
        </p>
        {detail && <p className="text-[11px] text-dash-muted leading-relaxed">{detail}</p>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── 3. property ── */

function PropertyBinding({ diagnosis, busy, onBind }: {
  diagnosis: ConnectionDiagnosis; busy: boolean; onBind: (id: string) => void;
}) {
  const [choice, setChoice] = useState(diagnosis.boundPropertyId ?? '');
  useEffect(() => { setChoice(diagnosis.boundPropertyId ?? ''); }, [diagnosis.boundPropertyId]);

  if (!diagnosis.properties.length) {
    return <WarnNote>This credential can see no properties at all. Check that the invite code
      was created on the right account, and not restricted to a property that has since been
      removed.</WarnNote>;
  }

  return (
    <div className="space-y-3">
      {diagnosis.boundPropertyMissing && (
        <WarnNote>
          <span className="font-semibold">
            This connection points at property {diagnosis.boundPropertyId}, which this credential
            can no longer see.
          </span>{' '}
          Every push will fail until a property below is chosen. This usually means the account
          was reorganised, or the invite code was restricted to a different property.
        </WarnNote>
      )}

      {diagnosis.properties.length === 1 && !diagnosis.boundPropertyMissing ? (
        <Row ok label={diagnosis.properties[0].name}
          code={diagnosis.properties[0].id}
          detail="The only property this credential can see, so there is nothing to choose." />
      ) : (
        <>
          <Field label="Which property does this PMS manage?"
            hint="Rates and availability are written to this one. Choosing the wrong property here
                  writes your prices onto somebody else's listing.">
            <Select value={choice} onChange={setChoice} options={[
              { label: 'Choose…', value: '' },
              ...diagnosis.properties.map((p) => ({ label: `${p.name} (${p.id})`, value: p.id })),
            ]} />
          </Field>
          <PermissionButton permission="channels.write"
            disabled={busy || !choice || choice === diagnosis.boundPropertyId}
            onClick={() => onBind(choice)}>
            {busy ? 'Saving…' : 'Use this property'}
          </PermissionButton>
        </>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────── 4. rooms ── */

function RoomMatching({ channelId }: { channelId: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const suggestions = useRoomSuggestions(channelId, open);
  const apply = useApplyRoomSuggestions();
  const [picks, setPicks] = useState<Record<string, string>>({});

  const rooms: RoomSuggestion[] = suggestions.data?.rooms ?? [];
  const roomTypes = suggestions.data?.roomTypes ?? [];

  // Seed the pickers from the suggestions, once they arrive.
  useEffect(() => {
    if (!rooms.length) return;
    setPicks((prev) => {
      if (Object.keys(prev).length) return prev;
      const seeded: Record<string, string> = {};
      for (const r of rooms) if (r.roomTypeId) seeded[r.channelRoomId] = r.roomTypeId;
      return seeded;
    });
  }, [rooms]);

  if (!open) {
    return (
      <div className="space-y-2">
        <p className="text-[12px] text-dash-muted leading-relaxed">
          Each room in {CHANNEL_HUB} has to be paired with a room type here, or nothing can be
          pushed for it. This reads both lists and matches what it can — by name, and for dorms by
          bed count and gender policy, which is the only thing that reliably separates a 4-bed
          mixed from a 6-bed female.
        </p>
        <Button variant="secondary" onClick={() => setOpen(true)}
          icon={<Link2 className="w-3.5 h-3.5" />}>
          Match rooms
        </Button>
      </div>
    );
  }

  if (suggestions.isLoading) return <div className="h-24 rounded-xl bg-black/5 animate-pulse" />;
  if (suggestions.isError) {
    return <WarnNote>Could not read the rooms: {(suggestions.error as any)?.message ?? 'unknown error'}</WarnNote>;
  }

  const chosen = rooms.filter((r) => picks[r.channelRoomId]);
  // One PMS room type may back only one channel room — two channel rooms
  // sharing a type push from one pool and overbook each other.
  const duplicates = new Set(
    Object.values(picks).filter((v, i, a) => v && a.indexOf(v) !== i),
  );

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-dash-muted leading-relaxed">
        Check each line before applying. A wrong pairing sends one room's availability to another
        and is close to invisible afterwards.
      </p>

      {duplicates.size > 0 && (
        <WarnNote>
          Two channel rooms are pointing at the same room type here. They would sell from one pool
          of beds and overbook each other. Give each its own room type, or leave one unmatched.
        </WarnNote>
      )}

      <div className="space-y-2">
        {rooms.map((r) => (
          <div key={r.channelRoomId}
            className="grid md:grid-cols-[1fr_auto_1fr] gap-2 md:gap-3 items-center
                       rounded-xl border border-black/10 p-3">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold truncate">{r.channelRoomName}</p>
              <p className="text-[10px] text-dash-muted font-mono">
                {r.channelRoomId}{r.channelQty ? ` · ${r.channelQty} units` : ''}
              </p>
            </div>
            <div className="hidden md:flex items-center">
              <Confidence value={r.confidence} />
            </div>
            <div className="min-w-0">
              <Select
                value={picks[r.channelRoomId] ?? ''}
                onChange={(v) => setPicks((p) => ({ ...p, [r.channelRoomId]: v }))}
                className={duplicates.has(picks[r.channelRoomId]) ? 'border-status-bad' : ''}
                options={[
                  { label: r.alreadyMapped ? 'Leave as it is' : 'Not matched', value: '' },
                  ...roomTypes.map((rt: any) => ({ label: rt.name, value: rt.id })),
                ]} />
              <p className="text-[10px] text-dash-muted mt-1 leading-relaxed">{r.reason}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <PermissionButton
          permission="channels.write"
          disabled={apply.isPending || !chosen.length || duplicates.size > 0}
          onClick={async () => {
            try {
              const r: any = await apply.mutateAsync({
                id: channelId,
                mappings: chosen.map((c) => ({
                  channelRoomId: c.channelRoomId,
                  channelRoomName: c.channelRoomName,
                  roomTypeId: picks[c.channelRoomId],
                })),
              });
              if (r.skipped?.length) {
                toast.push({
                  kind: 'warn', title: `${r.applied} matched, ${r.skipped.length} skipped`,
                  body: r.skipped.map((s: any) => `${s.channelRoomId}: ${s.reason}`).join(' · '),
                });
              } else {
                toast.success(`${r.applied} room${r.applied === 1 ? '' : 's'} matched`);
              }
              suggestions.refetch();
            } catch (e) { toast.fail(e, 'Could not save the matches'); }
          }}>
          {apply.isPending ? 'Saving…' : `Apply ${chosen.length} match${chosen.length === 1 ? '' : 'es'}`}
        </PermissionButton>
        <Button variant="ghost" onClick={() => suggestions.refetch()}
          icon={<RefreshCw className="w-3.5 h-3.5" />}>
          Re-read rooms
        </Button>
      </div>
    </div>
  );
}

function Confidence({ value }: { value: RoomSuggestion['confidence'] }) {
  if (value === 'exact') return <Pill tone="mint">Names match</Pill>;
  if (value === 'close') return <Pill tone="yellow">Likely</Pill>;
  return <Pill tone="grey">Choose</Pill>;
}

/** Unused export kept so the tab can be opened from a deep link later. */
export const CONNECTION_TAB = 'connection';
export { ExternalLink, ShieldAlert };
