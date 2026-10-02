// The property's identity on the invoices it issues: the logo, the name above
// it, and the wording underneath.
//
// Kept apart from the Property tab because these are not facts about the
// property — they are choices about a document. The address and tax id on an
// invoice come from Property; what is set here is how that information is
// presented and what is added to it.
import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Save, Trash2, Upload } from 'lucide-react';
import { useInvoiceBranding, useSaveInvoiceBranding } from '../queries';
import { Card, Button, Field, TextInput } from '../ui';
import { QueryState, useToast, Toggle, RequirePermission } from '../components';
import type { InvoiceBranding } from '../types';

/**
 * Matches `MAX_LOGO_CHARS` in the API.
 *
 * Checked here as well as there so an operator who picks a 3 MB photograph is
 * told immediately, by a message naming the file, rather than after a slow
 * upload that ends in a generic failure. The server still enforces it — this is
 * a courtesy, not the control.
 */
const MAX_LOGO_CHARS = 512 * 1024;
const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';

export function InvoiceBrandingTab() {
  const query = useInvoiceBranding();
  return (
    <RequirePermission permission="config.read">
      <QueryState query={query} loadingRows={4}>
        {(saved) => <BrandingForm saved={saved} />}
      </QueryState>
    </RequirePermission>
  );
}

function BrandingForm({ saved }: { saved: InvoiceBranding }) {
  const toast = useToast();
  const save = useSaveInvoiceBranding();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<InvoiceBranding>(saved);
  const [error, setError] = useState<string | null>(null);

  // A save elsewhere — another terminal, another administrator — refetches and
  // should be reflected here rather than silently overwritten by a stale form.
  useEffect(() => { setForm(saved); }, [saved]);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  function pick(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!ACCEPT.split(',').includes(file.type)) {
      setError(`${file.name} is ${file.type || 'an unknown type'}. Use PNG, JPEG, WebP, GIF or SVG.`);
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setError(`Could not read ${file.name}.`);
    reader.onload = () => {
      const url = String(reader.result ?? '');
      if (url.length > MAX_LOGO_CHARS) {
        setError(
          `${file.name} is ${Math.round(url.length / 1024)} KB once encoded; the limit is `
          + `${Math.round(MAX_LOGO_CHARS / 1024)} KB. It prints about 40mm wide, so a smaller `
          + 'file loses nothing.',
        );
        return;
      }
      setForm((f) => ({ ...f, logoDataUrl: url }));
    };
    // Read as a data URL because that is exactly what is stored and what the
    // invoice renders — no separate upload endpoint, and the logo travels with
    // the document so a printed invoice never depends on a second request.
    reader.readAsDataURL(file);
  }

  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <Card>
        <h3 className="text-[14px] font-bold tracking-tight mb-1">Logo</h3>
        <p className="text-[11px] text-dash-muted mb-4">
          Shown at the top left of every invoice. PNG or SVG on a transparent background
          looks best; it prints about 40&nbsp;mm wide.
        </p>

        <div className="flex items-center gap-4 mb-4">
          <div className="w-32 h-20 rounded-xl border border-black/10 bg-white flex items-center justify-center overflow-hidden shrink-0">
            {form.logoDataUrl
              ? <img src={form.logoDataUrl} alt="Invoice logo" className="max-h-full max-w-full object-contain" />
              : <ImageIcon className="w-6 h-6 text-dash-muted" />}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }}
            />
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload className="w-3.5 h-3.5" /> Choose image
            </Button>
            {form.logoDataUrl && (
              <Button variant="secondary" onClick={() => { setForm((f) => ({ ...f, logoDataUrl: null })); setError(null); }}>
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </Button>
            )}
          </div>
        </div>

        {error && (
          <p className="text-[11px] text-status-bad mb-3" role="alert">{error}</p>
        )}

        <Field
          label="Name above the address"
          hint="Leave blank to use the property name. Set it when you invoice under a different legal entity."
        >
          <TextInput
            value={form.headerName ?? ''}
            onChange={(v) => setForm((f) => ({ ...f, headerName: v || null }))}
            placeholder="e.g. The Fun Bunk"
          />
        </Field>

        <div className="mt-4">
          <Toggle
            checked={form.showTaxId}
            onChange={(v) => setForm((f) => ({ ...f, showTaxId: v }))}
            label="Print the tax ID in the header"
          />
          <p className="text-[10.5px] text-dash-muted mt-1">
            Taken from the property's tax ID on the Property tab. Turn it off if the property has none.
          </p>
        </div>
      </Card>

      <Card>
        <h3 className="text-[14px] font-bold tracking-tight mb-1">Wording</h3>
        <p className="text-[11px] text-dash-muted mb-4">
          Printed under the totals. Both are optional and both keep the line breaks you type.
        </p>

        <Field label="Payment terms" hint="Shown in bold directly beneath the balance.">
          <textarea
            value={form.terms ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value || null }))}
            rows={3}
            maxLength={1000}
            placeholder="Payment due within 14 days of the invoice date."
            className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-black/40 resize-y"
          />
        </Field>

        <Field label="Footer note" hint="Bank details, registration numbers, a thank-you.">
          <textarea
            value={form.footerNote ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, footerNote: e.target.value || null }))}
            rows={4}
            maxLength={2000}
            placeholder={'Bank: Commercial Bank of Ceylon\nAccount: 8001234567\nThank you for staying with us.'}
            className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-black/40 resize-y"
          />
        </Field>

        <div className="flex items-center gap-2 mt-5">
          <Button
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate(form, {
              onSuccess: () => toast.success('Invoice branding saved'),
              onError: (e: any) => {
                // Surfaced inline as well as in the toast: the likely failure is
                // an oversized or wrong-typed logo, and that message needs to
                // stay on screen next to the field it is about.
                setError(e?.message ?? 'Could not save.');
                toast.fail(e, 'Could not save the invoice branding');
              },
            })}
          >
            <Save className="w-3.5 h-3.5" /> {save.isPending ? 'Saving…' : 'Save'}
          </Button>
          {dirty && (
            <Button variant="secondary" onClick={() => { setForm(saved); setError(null); }}>
              Discard changes
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
