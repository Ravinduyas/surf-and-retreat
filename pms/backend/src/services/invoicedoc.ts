// ─────────────────────────────────────────────────────────────
// Invoices as documents: the branding a property puts on them, and the paper
// itself.
//
// Both halves of this were missing. The front end had a complete Invoice
// Branding screen and a complete invoice renderer, and neither had anything to
// talk to — `GET /api/config/invoice-branding` and `GET /api/invoices/:id/document`
// were never written. Opening Configuration → Invoice branding said "Not
// found", and so did every attempt to view or print an invoice, which is a
// larger hole: a property that cannot produce an invoice cannot bill a company.
//
// Two rules shape what is here.
//
// A reprint must show the paper the guest was handed. The amounts therefore
// come off the `invoices` row, which was frozen when the invoice was issued —
// never recomputed from the folio, which carries on moving afterwards. Only the
// *lines* are read from the folio, because that is where they live, and they
// are filtered to what existed when the invoice was cut.
//
// And the branding is a document choice, not a fact about the property. The
// address and tax id come from Property; this decides how they are presented.
// ─────────────────────────────────────────────────────────────
import { all, get, run } from '../db.ts';
import { HttpError, nowIso } from '../lib/util.ts';
import { audit } from './audit.ts';
import type { AuthContext } from '../auth.ts';

export const BRANDING_SETTING_KEY = 'invoice.branding';

/**
 * The ceiling on a stored logo, in characters of its data URL.
 *
 * Matches `MAX_LOGO_CHARS` in the Invoice Branding screen. It is generous for
 * a mark that prints about 40mm wide and deliberately far below the 4 MB body
 * limit, because this string is read back on every invoice render and a
 * photograph pasted in here would slow every one of them down.
 */
export const MAX_LOGO_CHARS = 512 * 1024;

/** Image types a logo may be. Anything else is refused rather than stored. */
const LOGO_TYPES = ['png', 'jpeg', 'jpg', 'webp', 'gif', 'svg+xml'] as const;

export interface InvoiceBranding {
  logoDataUrl: string | null;
  headerName: string | null;
  footerNote: string | null;
  terms: string | null;
  showTaxId: boolean;
}

export const DEFAULT_BRANDING: InvoiceBranding = {
  logoDataUrl: null,
  headerName: null,
  footerNote: null,
  terms: null,
  // On by default. A property that has entered a tax id has almost always done
  // so because it has to appear on what it issues.
  showTaxId: true,
};

/* ------------------------------------------------------------ reading ---- */

export function invoiceBranding(propertyId: string): InvoiceBranding {
  const row = get<{ value: string }>(
    'SELECT value FROM settings WHERE property_id = ? AND key = ?',
    propertyId, BRANDING_SETTING_KEY);
  if (!row) return DEFAULT_BRANDING;

  let raw: any;
  try { raw = JSON.parse(row.value); } catch { return DEFAULT_BRANDING; }
  if (!raw || typeof raw !== 'object') return DEFAULT_BRANDING;

  // Merged over the defaults rather than returned as found: a half-written
  // setting must still produce a renderable invoice, because the alternative
  // is a property that cannot bill anybody until somebody fixes a JSON blob.
  const text = (v: unknown, max: number): string | null => {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t ? t.slice(0, max) : null;
  };
  return {
    logoDataUrl: typeof raw.logoDataUrl === 'string' && raw.logoDataUrl.startsWith('data:image/')
      ? raw.logoDataUrl.slice(0, MAX_LOGO_CHARS) : null,
    headerName: text(raw.headerName, 120),
    footerNote: text(raw.footerNote, 600),
    terms: text(raw.terms, 600),
    showTaxId: raw.showTaxId !== false,
  };
}

/* ------------------------------------------------------------ writing ---- */

/**
 * Whether a string is a data URL this is willing to print on an invoice.
 *
 * Checked rather than trusted, for two separate reasons.
 *
 * The dull one: a `logoDataUrl` that is not actually an image renders as a
 * broken picture on every invoice the property issues, and they find out from
 * a guest.
 *
 * The other one: this value is stored by one authenticated user and rendered
 * in every other user's browser, which makes it stored input rather than a
 * private preference. SVG is on the allowed list because it is the right
 * format for a logo, and an SVG *can* carry script — so the shape is pinned
 * down here (a base64 image data URL, nothing else) rather than any string
 * beginning "data:". The renderer puts it in an `<img>`, where a browser will
 * not run script, and these two together are the belt and braces.
 */
function isLogoDataUrl(v: string): boolean {
  const m = /^data:image\/([a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(v);
  if (!m) return false;
  if (!LOGO_TYPES.includes(m[1].toLowerCase() as typeof LOGO_TYPES[number])) return false;
  // A truncated or mistyped payload is not an image, and storing it would put
  // a broken logo on real paper.
  return m[2].replace(/\s/g, '').length > 16;
}

export function saveInvoiceBranding(
  propertyId: string, actor: AuthContext, input: unknown, ip = 'internal',
): InvoiceBranding {
  const raw = (input ?? {}) as any;
  const before = invoiceBranding(propertyId);

  const text = (v: unknown, field: string, max: number): string | null => {
    if (v === null || v === undefined) return null;
    if (typeof v !== 'string') throw new HttpError(400, `${field} must be text`);
    const t = v.trim();
    if (t.length > max) {
      throw new HttpError(400, `${field} is ${t.length} characters; the limit is ${max}`);
    }
    return t || null;
  };

  let logo: string | null;
  if (raw.logoDataUrl === null || raw.logoDataUrl === undefined || raw.logoDataUrl === '') {
    logo = null;
  } else if (typeof raw.logoDataUrl !== 'string') {
    throw new HttpError(400, 'logoDataUrl must be a data URL or null');
  } else if (raw.logoDataUrl.length > MAX_LOGO_CHARS) {
    throw new HttpError(400,
      `The logo is ${Math.round(raw.logoDataUrl.length / 1024)} KB once encoded; the limit is `
      + `${Math.round(MAX_LOGO_CHARS / 1024)} KB. It prints about 40mm wide, so a smaller file `
      + 'loses nothing.', 'logo_too_large');
  } else if (!isLogoDataUrl(raw.logoDataUrl)) {
    throw new HttpError(400,
      'That is not an image this can print. Use a PNG, JPEG, WebP, GIF or SVG file.',
      'bad_logo');
  } else {
    logo = raw.logoDataUrl;
  }

  const next: InvoiceBranding = {
    logoDataUrl: logo,
    headerName: text(raw.headerName, 'headerName', 120),
    footerNote: text(raw.footerNote, 'footerNote', 600),
    terms: text(raw.terms, 'terms', 600),
    showTaxId: raw.showTaxId !== false,
  };

  run(
    `INSERT INTO settings(property_id, key, value, updated_at, updated_by)
     VALUES(?,?,?,?,?)
     ON CONFLICT(property_id, key) DO UPDATE SET
       value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    propertyId, BRANDING_SETTING_KEY, JSON.stringify(next), nowIso(), actor.userId,
  );

  // The logo itself is not written to the audit trail — half a megabyte of
  // base64 in an audit row helps nobody read it. Whether there is one, and
  // whether it changed, is the part somebody would ever ask about.
  const summarise = (b: InvoiceBranding) => ({
    hasLogo: !!b.logoDataUrl,
    logoBytes: b.logoDataUrl?.length ?? 0,
    headerName: b.headerName,
    footerNote: b.footerNote,
    terms: b.terms,
    showTaxId: b.showTaxId,
  });
  audit(actor, {
    action: 'config.invoice-branding', entity: 'SETTING', entityId: BRANDING_SETTING_KEY,
    entityRef: 'Invoice branding',
    before: summarise(before), after: summarise(next),
  }, ip);

  return next;
}

/* ----------------------------------------------------------- document ---- */

/**
 * Everything printed on one invoice.
 *
 * The amounts are the ones frozen on the invoice row when it was issued. The
 * folio it came from keeps moving — a later charge, a payment, a void — and
 * recomputing from it would mean a reprint quietly disagreeing with the paper
 * the guest is holding.
 */
export function invoiceDocument(propertyId: string, invoiceId: string) {
  const inv = get<any>(
    'SELECT * FROM invoices WHERE id = ? AND property_id = ?', invoiceId, propertyId);
  if (!inv) throw new HttpError(404, 'Invoice not found');

  const property = get<any>('SELECT * FROM properties WHERE id = ?', propertyId)!;
  const folio = get<any>('SELECT * FROM folios WHERE id = ?', inv.folio_id);

  /*
   * The lines, as they stood when the invoice was cut.
   *
   * Voided lines are excluded — they are not money and never were. Anything
   * posted *after* the invoice was issued is excluded too, which is the part
   * that makes a reprint stable: a beer charged the morning after check-out
   * belongs on the next invoice, not retrospectively on this one.
   */
  const lines = all<any>(
    `SELECT l.*, tc.name AS code_name
       FROM folio_lines l
       LEFT JOIN transaction_codes tc
              ON tc.property_id = l.property_id AND tc.code = l.code
      WHERE l.folio_id = ? AND l.voided = 0 AND l.posted_at <= ?
      ORDER BY l.posted_at, l.id`,
    inv.folio_id, inv.issued_at,
  );

  const charges = lines.filter((l) => l.kind !== 'payment' && l.kind !== 'tax');
  const taxLines = lines.filter((l) => l.kind === 'tax');
  const payments = lines.filter((l) => l.kind === 'payment');

  const reservation = folio?.reservation_id
    ? get<any>(
      `SELECT r.*, rm.number AS room_number, rt.name AS room_type_name
         FROM reservations r
         LEFT JOIN rooms rm ON rm.id = r.room_id
         LEFT JOIN room_types rt ON rt.id = r.room_type_id
        WHERE r.id = ?`, folio.reservation_id)
    : null;

  const company = inv.company_id
    ? get<any>('SELECT * FROM companies WHERE id = ?', inv.company_id)
    : null;

  const paid = inv.paid_minor ?? 0;

  return {
    invoice: {
      id: inv.id,
      number: inv.number,
      issuedAt: inv.issued_at,
      dueAt: inv.due_at,
      status: inv.status,
      currency: inv.currency,
      netMinor: inv.net_minor,
      taxMinor: inv.tax_minor,
      totalMinor: inv.total_minor,
      paidMinor: paid,
      // Computed rather than stored: a balance that is a column drifts away
      // from the two numbers it is supposed to be the difference of.
      balanceMinor: inv.total_minor - paid,
      createdBy: inv.created_by,
    },
    from: {
      name: property.name,
      legalName: property.legal_name,
      address: property.address,
      city: property.city,
      country: property.country,
      phone: property.phone,
      email: property.email,
      website: property.website,
      taxId: property.tax_id,
    },
    billTo: {
      name: inv.bill_to,
      address: inv.bill_address,
      company: company?.name ?? null,
    },
    stay: reservation ? {
      confirmation: reservation.confirmation,
      guest: reservation.guest_name,
      arrival: reservation.arrival,
      departure: reservation.departure,
      nights: reservation.nights,
      roomNumber: reservation.room_number ?? null,
      roomType: reservation.room_type_name ?? null,
    } : null,
    lines: charges.map((l) => ({
      date: l.business_date,
      code: l.code,
      description: l.description || l.code_name || l.code,
      qty: l.qty ?? 1,
      unitMinor: l.unit_minor ?? l.amount_minor,
      amountMinor: l.amount_minor,
    })),
    taxes: taxLines.map((l) => ({
      code: l.code,
      description: l.description || l.code_name || l.code,
      amountMinor: l.amount_minor,
    })),
    payments: payments.map((l) => ({
      date: l.business_date,
      description: l.description || l.code_name || 'Payment',
      method: l.method ?? null,
      // Payments are stored negative on a folio, because a folio is a ledger.
      // An invoice reads as a receipt, where a payment is a positive number in
      // a "paid" column, so the sign is flipped once here rather than in the
      // renderer — which would have to know the ledger convention to do it.
      amountMinor: Math.abs(l.amount_minor),
    })),
    branding: invoiceBranding(propertyId),
  };
}
