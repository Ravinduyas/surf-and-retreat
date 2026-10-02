// ─────────────────────────────────────────────────────────────
// The QR code the guest scans to fill in their own registration.
//
// Two states matter and the panel is really only about telling them apart:
// *waiting*, where a code is on screen and nobody has sent anything, and
// *sent*, where there are answers on the desk's screen for a person to read and
// accept. Accepting is a deliberate act — what a stranger typed on a phone does
// not become the property's registration record on its own.
//
// This is a different thing from `CheckInQr` in registration.tsx, which sends a
// *member of staff* to this same screen on their own signed-in phone. That one
// carries no token because it needs none. This one is the only unauthenticated
// door into a single booking in the whole product, which is why the panel says
// out loud when the address in the code cannot be reached from a guest's phone
// rather than printing a square that quietly does not work.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import {
  QrCode, RefreshCw, Copy, Check, Smartphone, ShieldCheck, Trash2, AlertTriangle,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  useRegistrationLink, useCreateRegistrationLink, useRevokeRegistrationLink,
  useAcceptRegistration, useDiscardRegistration,
} from './queries';
import { Button } from './ui';
import { useToast, PermissionButton, InfoNote } from './components';
import { timestamp } from './format';
import type { GuestRegistrationSubmission } from './types';

/** An address that resolves to the phone itself is useless in a QR code. */
const unreachable = (url: string) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url);

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-1.5 border-b border-black/5 last:border-0">
      <span className="w-32 shrink-0 text-[10px] font-bold uppercase tracking-widest text-dash-muted">
        {label}
      </span>
      <span className="text-[12px] font-semibold break-words min-w-0">{value}</span>
    </div>
  );
}

/** What the guest sent, laid out so a person can check it against a passport. */
function Submission({ s }: { s: GuestRegistrationSubmission }) {
  const name = [s.firstName, s.lastName].filter(Boolean).join(' ');
  const address = s.address
    ? [s.address.line1, s.address.line2, s.address.city, s.address.postcode, s.address.country]
      .filter(Boolean).join(', ')
    : null;
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-black/10 bg-white p-4">
        <Row label="Name" value={name} />
        <Row label="Date of birth" value={s.dob} />
        <Row label="Nationality" value={s.nationality} />
        <Row label="Email" value={s.email} />
        <Row label="Phone" value={s.phone} />
        <Row label="Address" value={address} />
        <Row label="Document" value={s.idType} />
        <Row label="Number" value={s.idNumber} />
        <Row label="Expires" value={s.idExpiry} />
        <Row label="Marketing" value={s.marketingConsent ? 'Consented' : null} />
      </div>

      {(s.idPhoto || s.signature) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {s.idPhoto && (
            <figure className="rounded-2xl border border-black/10 bg-white p-3">
              <figcaption className="mb-2 text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                Identity document
              </figcaption>
              <img
                src={`data:${s.idPhoto.mime};base64,${s.idPhoto.dataBase64}`}
                alt="The document the guest photographed"
                className="max-h-56 w-full rounded-xl object-contain bg-dash-bg"
              />
            </figure>
          )}
          {s.signature && (
            <figure className="rounded-2xl border border-black/10 bg-white p-3">
              <figcaption className="mb-2 text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                Signature
              </figcaption>
              <img
                src={`data:${s.signature.mime};base64,${s.signature.dataBase64}`}
                alt="The guest's signature"
                className="max-h-56 w-full rounded-xl object-contain bg-white"
              />
            </figure>
          )}
        </div>
      )}
    </div>
  );
}

export function GuestRegistrationPanel({ reservationId, guest }: {
  reservationId: string;
  guest?: string;
}) {
  const toast = useToast();
  const link = useRegistrationLink(reservationId);
  const create = useCreateRegistrationLink();
  const revoke = useRevokeRegistrationLink();
  const accept = useAcceptRegistration();
  const discard = useDiscardRegistration();

  // Held in this component and nowhere else. The token comes back exactly once,
  // when the link is minted; it is never stored and never read back, so leaving
  // the screen means minting a new code rather than recovering this one.
  const [url, setUrl] = useState<string | null>(null);
  const [png, setPng] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!url) { setPng(null); return; }
    let live = true;
    QRCode.toDataURL(url, { width: 260, margin: 1, errorCorrectionLevel: 'M' })
      .then((d) => { if (live) setPng(d); })
      .catch(() => { if (live) setPng(null); });
    return () => { live = false; };
  }, [url]);

  const state = link.data;
  const submission = state?.submission ?? null;

  async function mint() {
    try {
      const r = await create.mutateAsync({ id: reservationId });
      setUrl(r?.url ?? null);
    } catch (e) {
      toast.fail(e, 'Could not create a registration code');
    }
  }

  return (
    <section className="rounded-2xl border border-black/10 bg-dash-bg/40 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <p className="text-[12px] font-bold flex items-center gap-1.5">
            <QrCode className="w-3.5 h-3.5" />
            Let the guest fill this in
          </p>
          <p className="text-[11px] text-dash-muted leading-relaxed mt-1 max-w-lg">
            Show this code and {guest ?? 'the guest'} scans it with their own phone to enter their
            passport details, photograph the document and sign. Nothing they send is saved to the
            booking until you accept it below.
          </p>
        </div>
        {state?.exists && state.live && !url && !submission && (
          <PermissionButton
            permission="frontdesk.write" size="sm" variant="secondary"
            icon={<RefreshCw className="w-3 h-3" />}
            disabled={create.isPending}
            onClick={mint}
          >
            Show the code again
          </PermissionButton>
        )}
      </div>

      {/* ── Nothing sent yet ── */}
      {!submission && (
        <>
          {!url && (
            <div className="flex flex-wrap items-center gap-2">
              <PermissionButton
                permission="frontdesk.write"
                icon={<QrCode className="w-3.5 h-3.5" />}
                disabled={create.isPending}
                onClick={mint}
              >
                {create.isPending ? 'Creating…'
                  : state?.exists && state.live ? 'Show the code' : 'Create a code'}
              </PermissionButton>
              {state?.exists && state.live && (
                <span className="text-[11px] text-dash-muted">
                  A code is already live — showing it again replaces it with a new one.
                </span>
              )}
              {state?.exists && !state.live && state.endedBecause === 'accepted' && (
                <span className="text-[11px] text-dash-muted">
                  Already accepted{state.acceptedBy ? ` by ${state.acceptedBy}` : ''}.
                </span>
              )}
            </div>
          )}

          {url && (
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="shrink-0 bg-white rounded-2xl border border-black/10 p-3 self-start">
                {png
                  ? <img src={png} alt="Registration QR code" className="w-[160px] h-[160px]" />
                  : <div className="w-[160px] h-[160px] rounded-xl bg-dash-bg animate-pulse" />}
              </div>

              <div className="min-w-0 flex-1 space-y-2.5">
                {unreachable(url) ? (
                  <div className="rounded-xl border border-status-warn/40 bg-dash-peach/40 p-3">
                    <p className="text-[11px] font-bold flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      A phone cannot open this address
                    </p>
                    <p className="text-[11px] text-dash-muted leading-relaxed">
                      The code points at <span className="font-mono">{url.split('/register')[0]}</span>,
                      which on a guest&apos;s phone means the phone itself. Set
                      <span className="font-mono"> HELIO_BOOKING_SITE_URL</span> on the API to the
                      address the booking site is actually served from — your machine&apos;s network
                      address for a test, the public one in production.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-dash-muted leading-relaxed flex items-start gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    Waiting for the guest. This panel updates by itself when they send it.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm" variant="secondary"
                    icon={copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(url);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      } catch { toast.fail(null, 'Could not copy the link'); }
                    }}
                  >
                    {copied ? 'Copied' : 'Copy link'}
                  </Button>
                  <PermissionButton
                    permission="frontdesk.write" size="sm" variant="ghost"
                    icon={<RefreshCw className="w-3 h-3" />}
                    disabled={create.isPending}
                    onClick={mint}
                  >
                    New code
                  </PermissionButton>
                  <PermissionButton
                    permission="frontdesk.write" size="sm" variant="ghost"
                    disabled={revoke.isPending}
                    onClick={async () => {
                      try {
                        await revoke.mutateAsync({ id: reservationId });
                        setUrl(null);
                        toast.success('That code no longer works');
                      } catch (e) { toast.fail(e); }
                    }}
                  >
                    Cancel it
                  </PermissionButton>
                </div>

                <p className="text-[10px] text-dash-muted leading-relaxed">
                  The code works until this guest is checked in, and only one is live at a time.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── They have sent something ── */}
      {submission && (
        <div className="space-y-3">
          <InfoNote>
            <span className="font-bold">{guest ?? 'The guest'} filled this in
              {state?.submittedAt ? ` ${timestamp(state.submittedAt)}` : ''}.</span>{' '}
            Check it against the document in front of you, then accept it onto the booking.
            {(state?.submissions ?? 0) > 1
              && ` They sent it ${state?.submissions} times — this is the latest.`}
          </InfoNote>

          <Submission s={submission} />

          <div className="flex flex-wrap gap-2">
            <PermissionButton
              permission="frontdesk.write"
              icon={<ShieldCheck className="w-3.5 h-3.5" />}
              disabled={accept.isPending}
              onClick={async () => {
                try {
                  await accept.mutateAsync({ id: reservationId });
                  setUrl(null);
                  toast.success('Registration accepted onto the booking');
                } catch (e) { toast.fail(e, 'Could not accept that registration'); }
              }}
            >
              {accept.isPending ? 'Accepting…' : 'Accept onto the booking'}
            </PermissionButton>
            <PermissionButton
              permission="frontdesk.write" variant="ghost"
              icon={<Trash2 className="w-3.5 h-3.5" />}
              disabled={discard.isPending}
              onClick={async () => {
                try {
                  await discard.mutateAsync({ id: reservationId });
                  toast.success('Discarded — the guest can send it again');
                } catch (e) { toast.fail(e); }
              }}
            >
              Discard
            </PermissionButton>
          </div>

          <p className="text-[10px] text-dash-muted leading-relaxed">
            Accepting writes these onto the guest profile and files the photograph and signature
            with the booking. Blank answers leave what the property already held.
          </p>
        </div>
      )}

      {link.isError && (
        <p className="text-[11px] text-status-bad mt-2">
          Could not read the registration status.
        </p>
      )}
    </section>
  );
}
