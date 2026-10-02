// ─────────────────────────────────────────────────────────────
// Guest self-registration — the QR code handed across the desk.
//
// The desk shows a code, the guest scans it with their own phone, and fills in
// their own passport details, photograph and signature instead of reading them
// out while a receptionist types. What comes back is *not* the registration
// record: it is an unaccepted submission that a person at the desk looks at and
// accepts. Nothing a stranger types on a phone reaches a guest profile unseen.
//
// The link is the only unauthenticated way into a single reservation, so it is
// built like a session rather than like a URL:
//
//   * 256 bits of randomness, and only its SHA-256 hash is stored. A copy of
//     the table cannot be replayed to open somebody's booking.
//   * One live link per reservation — minting a new one revokes the old, so a
//     code photographed off the screen earlier stops working.
//   * It dies with the check-in. Checked in, cancelled, departed or no-show and
//     the link is spent; there is no window left over afterwards.
//   * What it will tell an unauthenticated caller is deliberately thin: the
//     property, the guest's own name and their own dates. Everything a person
//     already knows if they are standing there holding the code.
// ─────────────────────────────────────────────────────────────
import { createHash, randomBytes } from 'node:crypto';
import { all, get, run, tx } from '../db.ts';
import { id, nowIso, HttpError, notFound } from '../lib/util.ts';
import { encryptSecret, decryptSecret } from '../lib/secrets.ts';
import { config } from '../config.ts';
import { audit } from './audit.ts';
import { storeDocument } from './documents.ts';
import { notify, reservationLink } from './notify.ts';
import type { Actor } from './reservations.ts';

/** Statuses in which a reservation can still be registered. */
const OPEN_FOR_REGISTRATION = ['Tentative', 'Confirmed', 'Guaranteed'];

/** Biggest submission we will accept, decoded. Two photographs plus text. */
const MAX_PAYLOAD_BYTES = 8 * 1024 * 1024;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export interface GuestSubmission {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  nationality?: string | null;
  dob?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  idExpiry?: string | null;
  address?: {
    line1?: string | null; line2?: string | null; city?: string | null;
    postcode?: string | null; country?: string | null;
  } | null;
  /** Data URLs, as produced by the phone. */
  idPhoto?: { mime: string; dataBase64: string } | null;
  signature?: { mime: string; dataBase64: string } | null;
  marketingConsent?: boolean;
}

// ─── Minting ─────────────────────────────────────────────────

/**
 * Create the link behind the QR code, revoking any earlier one.
 *
 * The token is returned exactly once, here. It is never stored and there is no
 * endpoint that will read it back — if the code is lost, a new one is minted.
 */
export function createRegistrationLink(propertyId: string, actor: Actor, reservationId: string) {
  return tx(() => {
    const res = get<any>(
      `SELECT r.*, rt.name AS room_type_name
         FROM reservations r JOIN room_types rt ON rt.id = r.room_type_id
        WHERE r.id = ? AND r.property_id = ?`,
      reservationId, propertyId,
    );
    if (!res) notFound('Reservation');
    if (!OPEN_FOR_REGISTRATION.includes(res.status)) {
      throw new HttpError(409,
        `A ${res.status.toLowerCase()} reservation cannot be registered`, 'not_open');
    }

    // What the guest has already sent belongs to the *booking*, not to the code
    // they sent it through — the code is only the door. Carried across before
    // the old row is retired, or a receptionist pressing "new code" after the
    // guest had filled everything in would strand those answers on a revoked
    // row: invisible to the desk, impossible to accept, and gone.
    const carried = get<any>(
      `SELECT payload, submitted_at, submissions FROM registration_links
        WHERE reservation_id = ? AND accepted_at IS NULL AND payload IS NOT NULL
        ORDER BY created_at DESC LIMIT 1`,
      reservationId,
    );

    // One live link at a time. The old code stops working the instant a new one
    // is shown, which is what makes "regenerate" a real remedy rather than a
    // second door left open.
    run(`UPDATE registration_links SET revoked_at = ?
          WHERE reservation_id = ? AND revoked_at IS NULL AND accepted_at IS NULL`,
      nowIso(), reservationId);

    const token = randomBytes(32).toString('base64url');
    const linkId = id('rgl');
    run(
      `INSERT INTO registration_links(id, property_id, reservation_id, token_hash,
                                      created_at, created_by, payload, submitted_at, submissions)
       VALUES(?,?,?,?,?,?,?,?,?)`,
      linkId, propertyId, reservationId, hashToken(token), nowIso(), actor.userName,
      carried?.payload ?? null, carried?.submitted_at ?? null, carried?.submissions ?? 0,
    );

    // The old row keeps no second copy of a passport photograph. Only one row
    // ever holds the answers, so clearing the payload on acceptance clears it
    // everywhere rather than leaving encrypted duplicates behind revoked codes.
    if (carried) {
      run(`UPDATE registration_links SET payload = NULL
            WHERE reservation_id = ? AND id <> ?`, reservationId, linkId);
    }

    audit(actor, {
      action: 'registration.link-create', entity: 'RESERVATION', entityId: reservationId,
      entityRef: `${res.confirmation} · ${res.guest_name}`,
      after: { linkId },
    });

    return { ...linkStatus(propertyId, reservationId), url: registrationUrl(token), token };
  });
}

/** Where the guest's phone is sent. Built once, here, so the QR cannot drift. */
export function registrationUrl(token: string): string {
  return `${config.bookingSiteUrl.replace(/\/+$/, '')}/register/${token}`;
}

export function revokeRegistrationLink(propertyId: string, actor: Actor, reservationId: string) {
  run(`UPDATE registration_links SET revoked_at = ?
        WHERE reservation_id = ? AND property_id = ? AND revoked_at IS NULL AND accepted_at IS NULL`,
    nowIso(), reservationId, propertyId);
  audit(actor, {
    action: 'registration.link-revoke', entity: 'RESERVATION', entityId: reservationId,
  });
  return linkStatus(propertyId, reservationId);
}

// ─── What the desk sees ──────────────────────────────────────

/**
 * The state of the current link, and the guest's answers if they have sent any.
 *
 * The payload is decrypted for this — it is the whole point of the screen, and
 * the caller is an authenticated member of staff looking at a booking they can
 * already open.
 */
export function linkStatus(propertyId: string, reservationId: string) {
  const row = get<any>(
    `SELECT * FROM registration_links
      WHERE reservation_id = ? AND property_id = ?
      ORDER BY created_at DESC LIMIT 1`,
    reservationId, propertyId,
  );
  if (!row) return { exists: false as const, live: false, submitted: false, submission: null };

  const res = get<any>('SELECT status FROM reservations WHERE id = ?', reservationId);
  const spent = !OPEN_FOR_REGISTRATION.includes(res?.status ?? '');
  const live = !row.revoked_at && !row.accepted_at && !spent;

  return {
    exists: true as const,
    live,
    /** Why it is not live, so the screen can say so rather than just greying out. */
    endedBecause: live ? null
      : row.accepted_at ? 'accepted'
        : row.revoked_at ? 'revoked'
          : 'checked-in',
    createdAt: row.created_at,
    createdBy: row.created_by,
    submitted: !!row.submitted_at,
    submittedAt: row.submitted_at,
    submissions: row.submissions,
    acceptedAt: row.accepted_at,
    acceptedBy: row.accepted_by,
    submission: row.payload ? readPayload(row.payload) : null,
  };
}

function readPayload(stored: string): GuestSubmission | null {
  try {
    return JSON.parse(decryptSecret(stored)) as GuestSubmission;
  } catch {
    // A payload that cannot be read is reported as absent rather than crashing
    // the check-in screen. The guest can simply submit again.
    return null;
  }
}

// ─── What the guest sees ─────────────────────────────────────

/** Resolve a scanned token, or refuse. Never says *why* a token is unknown. */
function resolveToken(token: string) {
  const row = get<any>('SELECT * FROM registration_links WHERE token_hash = ?', hashToken(token));
  if (!row) throw new HttpError(404, 'This registration link is not valid', 'link_invalid');
  if (row.revoked_at) {
    throw new HttpError(410,
      'This code has been replaced. Ask reception for the current one.', 'link_revoked');
  }
  // Acceptance is the end of the link. The desk has taken these details into
  // the record, so a later submission would sit unaccepted behind a panel that
  // already reads "accepted" — and nobody would look at it again. If the guest
  // needs to change something, reception shows a new code.
  if (row.accepted_at) {
    throw new HttpError(410,
      'Reception has already accepted your details. Ask them if you need to change anything.',
      'link_accepted');
  }
  const res = get<any>(
    `SELECT r.*, rt.name AS room_type_name, p.name AS property_name, p.check_in_time
       FROM reservations r
       JOIN room_types rt ON rt.id = r.room_type_id
       JOIN properties p ON p.id = r.property_id
      WHERE r.id = ?`,
    row.reservation_id,
  );
  if (!res) throw new HttpError(404, 'This registration link is not valid', 'link_invalid');
  if (!OPEN_FOR_REGISTRATION.includes(res.status)) {
    throw new HttpError(410,
      res.status === 'Checked-in'
        ? 'You are already checked in — there is nothing left to fill in.'
        : 'This booking is no longer open for registration.',
      'link_spent');
  }
  return { row, res };
}

/**
 * What the page shows before the guest types anything.
 *
 * Deliberately thin. Somebody holding this token learns the property, their own
 * name and their own dates — which is what they are standing there holding a
 * booking for. No folio, no rate, no other guest, no reservation id.
 */
export function registrationContext(token: string) {
  const { row, res } = resolveToken(token);
  const previous = row.payload ? readPayload(row.payload) : null;
  return {
    property: res.property_name,
    guest: res.guest_name,
    confirmation: res.confirmation,
    arrival: res.arrival,
    departure: res.departure,
    nights: res.nights,
    roomType: res.room_type_name,
    checkInTime: res.check_in_time,
    /** Sent back so a guest correcting a mistake sees what they wrote before. */
    submitted: !!row.submitted_at,
    previous: previous ? withoutImages(previous) : null,
    /** Whether images are already held, without shipping them back down. */
    hasIdPhoto: !!previous?.idPhoto,
    hasSignature: !!previous?.signature,
  };
}

/** The text of a submission, without the megabytes of photograph. */
function withoutImages(s: GuestSubmission): GuestSubmission {
  const { idPhoto: _p, signature: _s, ...rest } = s;
  return rest;
}

/**
 * Take what the guest sent.
 *
 * It is stored encrypted and goes no further on its own. Re-submitting is
 * allowed and replaces the previous answers — a guest who mistypes a passport
 * number should be able to fix it without finding a member of staff, and the
 * link stays open until they are checked in.
 */
export function submitRegistration(token: string, submission: GuestSubmission) {
  return tx(() => {
    const { row, res } = resolveToken(token);

    // Merged over what they sent before, not swapped for it. A guest who
    // reopens the page to fix a misspelt surname has not re-photographed their
    // passport, so a wholesale replace would silently throw the document away —
    // and the desk would find a registration that had gone backwards.
    const previous = row.payload ? readPayload(row.payload) : null;
    const merged: GuestSubmission = { ...(previous ?? {}) };
    for (const [k, v] of Object.entries(submission)) {
      if (v === undefined || v === null) continue;
      (merged as Record<string, unknown>)[k] = v;
    }

    const json = JSON.stringify(merged);
    if (Buffer.byteLength(json, 'utf8') > MAX_PAYLOAD_BYTES) {
      throw new HttpError(413,
        'Those photographs are too large. Try again with a smaller image.', 'too_large');
    }

    run(
      `UPDATE registration_links
          SET payload = ?, submitted_at = ?, submissions = submissions + 1
        WHERE id = ?`,
      encryptSecret(json), nowIso(), row.id,
    );

    // The desk is told, because the guest has now done their part and is
    // waiting — and because the screen they are waiting on may not be open.
    notify(res.property_id, {
      source: 'Front Desk',
      severity: 'info',
      title: `Registration received · ${res.guest_name}`,
      message: `${res.confirmation} · filled in by the guest · ready to accept`,
      link: reservationLink(res.id),
    });

    return { ok: true, submissions: row.submissions + 1 };
  });
}

// ─── Accepting it into the record ────────────────────────────

const CLEAN = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s.slice(0, 200) : null;
};

/**
 * Put an accepted submission onto the profile, the guest row and the documents.
 *
 * Only fields the guest actually filled in are written: a blank answer leaves
 * whatever the property already held, so accepting a half-completed form never
 * erases a phone number the desk took last year.
 */
export function acceptRegistration(propertyId: string, actor: Actor, reservationId: string) {
  return tx(() => {
    const row = get<any>(
      `SELECT * FROM registration_links
        WHERE reservation_id = ? AND property_id = ?
        ORDER BY created_at DESC LIMIT 1`,
      reservationId, propertyId,
    );
    if (!row) notFound('Registration link');
    if (!row.payload) {
      throw new HttpError(409, 'The guest has not filled anything in yet', 'nothing_to_accept');
    }
    if (row.accepted_at) {
      throw new HttpError(409, 'This registration has already been accepted', 'already_accepted');
    }

    const sub = readPayload(row.payload);
    if (!sub) throw new HttpError(409, 'That submission could not be read', 'unreadable');

    const res = get<any>('SELECT * FROM reservations WHERE id = ? AND property_id = ?',
      reservationId, propertyId);
    if (!res) notFound('Reservation');

    // ── the profile ──
    if (res.profile_id) {
      const sets: string[] = [];
      const args: unknown[] = [];
      const put = (col: string, value: string | null) => {
        if (value === null) return;
        sets.push(`${col} = ?`);
        args.push(value);
      };
      put('first_name', CLEAN(sub.firstName));
      put('last_name', CLEAN(sub.lastName));
      put('email', CLEAN(sub.email));
      put('phone', CLEAN(sub.phone));
      put('nationality', CLEAN(sub.nationality));
      put('dob', CLEAN(sub.dob));
      put('id_type', CLEAN(sub.idType));
      put('id_number', CLEAN(sub.idNumber));
      put('id_expiry', CLEAN(sub.idExpiry));
      if (sub.address && Object.values(sub.address).some((v) => CLEAN(v))) {
        put('address', JSON.stringify(sub.address));
      }
      const full = [CLEAN(sub.firstName), CLEAN(sub.lastName)].filter(Boolean).join(' ');
      if (full) put('name', full);
      if (sub.marketingConsent === true) {
        sets.push('marketing_consent = 1', 'consent_at = ?');
        args.push(nowIso());
      }
      if (sets.length) {
        sets.push('updated_at = ?');
        args.push(nowIso(), res.profile_id);
        run(`UPDATE profiles SET ${sets.join(', ')} WHERE id = ?`, ...args);
      }
    }

    // ── the guest row on the booking ──
    run(
      `UPDATE reservation_guests SET registered = 1, id_number = COALESCE(?, id_number)
        WHERE reservation_id = ? AND is_primary = 1`,
      CLEAN(sub.idNumber), reservationId,
    );

    // ── the images ──
    // Stored through the same path a receptionist's camera uses, so they are
    // encrypted, size-checked and swept up by the same retention rule.
    const stored: string[] = [];
    if (sub.idPhoto?.dataBase64) {
      storeDocument(propertyId, actor, reservationId, {
        kind: 'identity',
        mime: sub.idPhoto.mime,
        dataBase64: sub.idPhoto.dataBase64,
        label: CLEAN(sub.idType) ?? 'Identity document',
        guestName: res.guest_name,
      });
      stored.push('identity');
    }
    if (sub.signature?.dataBase64) {
      storeDocument(propertyId, actor, reservationId, {
        kind: 'signature',
        mime: sub.signature.mime,
        dataBase64: sub.signature.dataBase64,
        label: 'Guest signature',
        guestName: res.guest_name,
      });
      stored.push('signature');
    }

    // Accepted, and the second copy of the passport goes. Keeping the payload
    // would leave the same document encrypted in two tables with only one of
    // them covered by the retention sweep.
    run(
      `UPDATE registration_links SET accepted_at = ?, accepted_by = ?, payload = NULL
        WHERE id = ?`,
      nowIso(), actor.userName, row.id,
    );

    audit(actor, {
      action: 'registration.accept', entity: 'RESERVATION', entityId: reservationId,
      entityRef: `${res.confirmation} · ${res.guest_name}`,
      after: {
        source: 'guest-self-registration',
        documents: stored,
        fields: Object.keys(withoutImages(sub)).filter((k) => CLEAN((sub as any)[k])),
      },
    });

    return linkStatus(propertyId, reservationId);
  });
}

/** Throw away what the guest sent without writing any of it down. */
export function discardRegistration(propertyId: string, actor: Actor, reservationId: string) {
  run(
    `UPDATE registration_links SET payload = NULL, submitted_at = NULL
      WHERE reservation_id = ? AND property_id = ? AND accepted_at IS NULL`,
    reservationId, propertyId,
  );
  audit(actor, {
    action: 'registration.discard', entity: 'RESERVATION', entityId: reservationId,
  });
  return linkStatus(propertyId, reservationId);
}

/** Every link ever minted for a booking — read by nothing yet, kept for audit. */
export function registrationHistory(propertyId: string, reservationId: string) {
  return all<any>(
    `SELECT id, created_at, created_by, revoked_at, submitted_at, submissions,
            accepted_at, accepted_by
       FROM registration_links WHERE reservation_id = ? AND property_id = ?
      ORDER BY created_at DESC`,
    reservationId, propertyId,
  );
}
