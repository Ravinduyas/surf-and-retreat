// ─────────────────────────────────────────────────────────────
// The registration record: a signature, and a photograph of an identity
// document.
//
// Both are captured on whatever the receptionist is holding. That is the whole
// design constraint: a signature has to be drawable with a finger on a phone at
// the desk, and a passport is photographed with the camera that is already in
// that phone rather than scanned on a device nobody owns.
//
// The photograph is shrunk before it is sent. A modern phone camera produces
// four to eight megabytes per shot; a passport page is legible at well under
// half a megabyte, and every one of these is stored inside the database and
// therefore inside every backup taken from it. Sending the original would put
// gigabytes a year into a file that is copied whole, several times a day.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { Camera, Trash2, Eye, PenLine, RotateCcw, ShieldCheck, Smartphone, Copy, Check } from 'lucide-react';
import QRCode from 'qrcode';
import { Button, Field, Select } from './ui';
import { useToast, PermissionButton, InfoNote } from './components';
import {
  useDocuments, useUploadDocument, useDeleteDocument, fetchDocument,
  type ReservationDocument,
} from './queries';
import { bytes as formatBytes, timestamp } from './format';
import { config } from './config';

/** Longest edge of a stored photograph. A passport page is readable at this. */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

/**
 * Shrink and re-encode a photograph in the browser.
 *
 * Returns a JPEG data URL. Anything that is not an image — a PDF, say — is
 * passed through untouched, because re-encoding a document is not this
 * function's business and a PDF is already small.
 */
async function shrinkImage(file: File): Promise<{ mime: string; data: string }> {
  if (!file.type.startsWith('image/')) {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not read that file'));
      reader.readAsDataURL(file);
    });
    return { mime: file.type, data };
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot process the image');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  return { mime: 'image/jpeg', data: canvas.toDataURL('image/jpeg', JPEG_QUALITY) };
}

// ─── Signature ───────────────────────────────────────────────

/**
 * A signature drawn with a finger or a mouse.
 *
 * Pointer events rather than mouse or touch: one set of handlers that works
 * for a finger, a stylus and a mouse alike, which matters because the same
 * screen is used on a desk and on a phone at the door.
 */
export function SignaturePad({
  onCapture, disabled,
}: {
  onCapture: (dataUrl: string) => void;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  // Sized to its own box in device pixels, or the line is soft on a phone and
  // the coordinates drift from where the finger actually is.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1A1A18';
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    // Capture, so a finger that slides off the box still finishes its stroke
    // rather than leaving a line hanging.
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    // Stops the page scrolling under the finger that is signing.
    e.preventDefault();
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasInk) setHasInk(true);
  };

  const end = () => { drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        // `touch-none` is what stops the browser treating the stroke as a
        // scroll gesture; without it a signature drags the page instead.
        className={`w-full h-36 rounded-2xl border-2 border-dashed touch-none bg-white
                    ${disabled ? 'opacity-50' : 'border-black/15 cursor-crosshair'}`}
        aria-label="Signature area — sign here"
      />
      <div className="flex items-center gap-2">
        <p className="text-[10px] text-dash-muted flex-1">
          {hasInk ? 'Signed' : 'Ask the guest to sign above'}
        </p>
        <Button size="sm" variant="ghost" icon={<RotateCcw className="w-3.5 h-3.5" />}
          onClick={clear} disabled={!hasInk || disabled}>
          Clear
        </Button>
        <Button size="sm" variant="secondary" icon={<PenLine className="w-3.5 h-3.5" />}
          disabled={!hasInk || disabled}
          onClick={() => {
            const canvas = canvasRef.current;
            if (canvas) onCapture(canvas.toDataURL('image/png'));
          }}>
          Save signature
        </Button>
      </div>
    </div>
  );
}

// ─── The registration panel ──────────────────────────────────

export function RegistrationDocuments({ reservationId, guestName }: {
  reservationId: string;
  guestName?: string;
}) {
  const toast = useToast();
  const docs = useDocuments(reservationId);
  const upload = useUploadDocument();
  const remove = useDeleteDocument();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [idLabel, setIdLabel] = useState('Passport');
  const [viewing, setViewing] = useState<{ mime: string; data: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const list = docs.data ?? [];
  const identity = list.filter((d) => d.kind === 'identity');
  const signature = list.find((d) => d.kind === 'signature');

  async function send(kind: 'identity' | 'signature', mime: string, data: string, label?: string) {
    setBusy(true);
    try {
      await upload.mutateAsync({ reservationId, kind, mime, data, label, guestName });
      toast.success(kind === 'signature' ? 'Signature saved' : `${label ?? 'Document'} attached`);
    } catch (e) {
      toast.fail(e, 'Could not save that');
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const { mime, data } = await shrinkImage(file);
      await upload.mutateAsync({ reservationId, kind: 'identity', mime, data, label: idLabel, guestName });
      toast.success(`${idLabel} attached`);
    } catch (e) {
      toast.fail(e, 'Could not attach that file');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function view(doc: ReservationDocument) {
    try {
      const full = await fetchDocument(doc.id);
      setViewing({
        mime: full.mime,
        data: `data:${full.mime};base64,${full.dataBase64}`,
        label: doc.label ?? (doc.kind === 'signature' ? 'Signature' : 'Document'),
      });
    } catch (e) {
      toast.fail(e, 'Could not open that document');
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Identity document ───────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-end gap-2 flex-wrap">
          <div className="w-full sm:w-[170px]">
            <Field label="Document type">
              <Select value={idLabel} onChange={setIdLabel} options={[
                { label: 'Passport', value: 'Passport' },
                { label: 'National ID', value: 'National ID' },
                { label: 'Driving licence', value: 'Driving licence' },
                { label: 'Visa', value: 'Visa' },
              ]} />
            </Field>
          </div>
          <div className="flex gap-2 pb-0.5">
            {/*
              `capture="environment"` opens the rear camera straight away on a
              phone and is ignored on a desktop, where the same control is an
              ordinary file picker. One button, right behaviour on both.
            */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <PermissionButton permission="reservations.write" variant="secondary"
              icon={<Camera className="w-3.5 h-3.5" />} disabled={busy}
              onClick={() => fileRef.current?.click()}>
              {busy ? 'Working…' : 'Photograph or attach'}
            </PermissionButton>
          </div>
        </div>

        {identity.length === 0 ? (
          <p className="text-[11px] text-dash-muted">No identity document attached yet.</p>
        ) : (
          <div className="space-y-1.5">
            {identity.map((d) => (
              <DocumentRow key={d.id} doc={d} onView={() => void view(d)}
                onDelete={async () => {
                  try {
                    await remove.mutateAsync({ documentId: d.id });
                    toast.success('Document deleted');
                  } catch (e) { toast.fail(e); }
                }} />
            ))}
          </div>
        )}
      </div>

      {/* ── Signature ───────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
          Guest signature
        </p>
        {signature ? (
          <DocumentRow doc={signature} onView={() => void view(signature)}
            onDelete={async () => {
              try {
                await remove.mutateAsync({ documentId: signature.id });
                toast.success('Signature removed');
              } catch (e) { toast.fail(e); }
            }} />
        ) : (
          <SignaturePad disabled={busy}
            onCapture={(dataUrl) => void send('signature', 'image/png', dataUrl)} />
        )}
      </div>

      <InfoNote>
        <ShieldCheck className="w-3 h-3 inline mr-1" />
        Stored encrypted and deleted automatically after the retention period set on
        the API. Opening a document is recorded in the audit trail.
      </InfoNote>

      {viewing && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setViewing(null)}
          role="presentation"
        >
          <div className="bg-white rounded-[1.5rem] p-3 max-w-3xl w-full dialog-max-h flex flex-col"
            onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={viewing.label}>
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-[12px] font-bold">{viewing.label}</p>
              <Button size="sm" variant="ghost" onClick={() => setViewing(null)}>Close</Button>
            </div>
            {viewing.mime === 'application/pdf'
              ? <iframe title={viewing.label} src={viewing.data} className="flex-1 rounded-xl min-h-[60vh]" />
              : <img src={viewing.data} alt={viewing.label} className="rounded-xl object-contain flex-1 min-h-0" />}
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentRow({ doc, onView, onDelete }: {
  doc: ReservationDocument; onView: () => void; onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border subtle-divider bg-white px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold truncate">
          {doc.label ?? (doc.kind === 'signature' ? 'Signature' : 'Document')}
        </p>
        <p className="text-[10px] text-dash-muted">
          {formatBytes(doc.sizeBytes)} · {timestamp(doc.uploadedAt)}
          {doc.uploadedBy ? ` · ${doc.uploadedBy}` : ''}
        </p>
      </div>
      <Button size="sm" variant="ghost" icon={<Eye className="w-3.5 h-3.5" />} onClick={onView}
        title="Open — recorded in the audit trail">
        View
      </Button>
      <span title="Delete this document">
        <PermissionButton permission="reservations.write" size="sm" variant="ghost"
          icon={<Trash2 className="w-3.5 h-3.5" />} onClick={onDelete} />
      </span>
    </div>
  );
}


// ─── Hand the check-in to another device ─────────────────────

/**
 * A QR code that opens this reservation's check-in form.
 *
 * The desk creates the booking on a computer and the guest is standing
 * somewhere else — at the door, by the van, in a dorm three floors up. Reading
 * a confirmation number down a corridor and typing it into a phone is how the
 * wrong reservation gets checked in.
 *
 * The code encodes an ordinary deep link into this same app. Whoever scans it
 * is a member of staff on a device that is already signed in: no token, no
 * public page, no new way into the system. A phone that is not signed in lands
 * on the sign-in screen and goes no further, which is exactly right.
 */
export function CheckInQr({ reservationId, confirmation, guest }: {
  reservationId: string;
  confirmation: string;
  guest?: string;
}) {
  const [png, setPng] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /*
   * `VITE_APP_URL` when it is set, and the serving host otherwise.
   *
   * The serving host is right in production and useless on a laptop: a QR code
   * containing `localhost:3000` sends the phone to *itself*, which is the one
   * situation this feature exists for. So when the address cannot be reached
   * from another device, the panel says so rather than printing a code that
   * quietly does not work.
   */
  const base = config.appUrl || window.location.origin;
  const link = `${base}/#/check-in/${reservationId}`;
  const unreachable = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/i.test(base);

  useEffect(() => {
    let live = true;
    QRCode.toDataURL(link, { width: 240, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => { if (live) setPng(url); })
      .catch(() => { if (live) setPng(null); });
    return () => { live = false; };
  }, [link]);

  return (
    <div className="flex items-start gap-4 flex-wrap">
      <div className="shrink-0">
        {png
          ? <img src={png} alt={`QR code opening check-in for ${confirmation}`}
              className="w-[150px] h-[150px] rounded-xl border border-black/10 bg-white" />
          : <div className="w-[150px] h-[150px] rounded-xl bg-dash-bg animate-pulse" />}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="text-[12px] font-bold flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5" />
            Check in on another device
          </p>
          <p className="text-[11px] text-dash-muted leading-relaxed mt-1">
            Scan with a phone or tablet that is already signed in to open this
            reservation&apos;s check-in form{guest ? ` for ${guest}` : ''}. Photograph the
            passport and take the signature there.
          </p>
        </div>

        {unreachable && (
          <div className="rounded-xl bg-dash-peach/60 border border-status-warn/30 p-2.5">
            <p className="text-[11px] leading-relaxed">
              <span className="font-bold">This code will not scan from a phone.</span>{' '}
              It points at <span className="font-mono">{base.replace(/^https?:\/\//, '')}</span>,
              which on another device means that device itself. Set{' '}
              <span className="font-mono text-[10px]">VITE_APP_URL</span> to the address
              staff phones can reach — this machine&apos;s network address, or the deployed
              site — and rebuild.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-[10px] bg-dash-bg rounded-lg px-2 py-1 truncate max-w-full">{link}</code>
          <Button size="sm" variant="ghost"
            icon={copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch { /* clipboard blocked; the link is on screen to read */ }
            }}>
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
      </div>
    </div>
  );
}
