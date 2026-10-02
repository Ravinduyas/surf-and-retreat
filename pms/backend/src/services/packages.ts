// ─────────────────────────────────────────────────────────────
// Booking-engine packages.
//
// The public site sells four things, and two of them are packages: "Rooms +
// surf" and "Rooms + coworking + surf". A guest buying one of those is buying
// a surf trip, not a room with lessons itemised beside it, and the property
// prices it as one thing — which means the price cannot be arithmetic the
// browser does on a room rate plus an extras table. It has to be a rate the
// property sets, per date, per room type, and moves for a shoulder season the
// same way it moves a room rate.
//
// So a package is a rate plan. `booking_model` names which of the site's
// models the plan sells, and everything the PMS already does to a rate plan —
// the rate calendar, bulk edits, price planning, restrictions, yield rules,
// the channel push — applies to it unchanged. Nothing here re-implements
// pricing; it only says which plan answers for which model.
// ─────────────────────────────────────────────────────────────
import { all, get, run } from '../db.ts';
import { HttpError, id, nowIso } from '../lib/util.ts';
import type { RatePlanRow } from './pricing.ts';

/** The booking site's four models, in the order it offers them. */
export const BOOKING_MODELS = [
  'rooms',
  'rooms-coworking',
  'rooms-surf',
  'rooms-coworking-surf',
] as const;

export type BookingModel = typeof BOOKING_MODELS[number];

export function isBookingModel(v: unknown): v is BookingModel {
  return typeof v === 'string' && (BOOKING_MODELS as readonly string[]).includes(v);
}

/**
 * The models sold as a package.
 *
 * Rooms and rooms + coworking are left off deliberately: the first is a room
 * and nothing else, and the second is a room with a desk beside it — both are
 * already priced by the room rate plan and its extras, and giving them a
 * package plan would only be a second place to set the same number.
 */
export const PACKAGE_MODELS: readonly BookingModel[] = ['rooms-surf', 'rooms-coworking-surf'];

interface PackageSeed {
  model: BookingModel;
  code: string;
  name: string;
  description: string;
  inclusions: string[];
  sortOrder: number;
}

/**
 * What `ensurePackagePlans` creates when a property has no package plans yet.
 *
 * No prices: a seeded figure would be a number nobody at the property chose,
 * shown in the same grid as the ones they did. With no base rate the calendar
 * resolves each cell to the room type's own default and marks it grey — "this
 * is not set yet" — until somebody sets it.
 */
const SEEDS: PackageSeed[] = [
  {
    model: 'rooms-surf',
    code: 'PKG-SURF',
    name: 'Rooms + surf',
    description: 'A stay with surf lessons, sold as one price.',
    inclusions: ['Accommodation', 'Surf lessons'],
    sortOrder: 10,
  },
  {
    model: 'rooms-coworking-surf',
    code: 'PKG-CWSURF',
    name: 'Rooms + coworking + surf',
    description: 'Bed, desk and lessons, sold as one price.',
    inclusions: ['Accommodation', 'Coworking desk', 'Surf lessons'],
    sortOrder: 11,
  },
];

/* ---------------------------------------------------------------- lookup -- */

export interface PackagePlanRow extends RatePlanRow {
  booking_model: BookingModel;
  description: string | null;
  sort_order: number;
}

/** Every active plan on this property that sells a booking-engine model. */
export function packagePlans(propertyId: string): PackagePlanRow[] {
  return all<PackagePlanRow>(
    `SELECT * FROM rate_plans
      WHERE property_id = ? AND active = 1 AND booking_model IS NOT NULL
      ORDER BY sort_order, name`,
    propertyId,
  ).filter((p) => isBookingModel(p.booking_model));
}

/** The plan that prices one model, or null when the property sells no package for it. */
export function packagePlanFor(propertyId: string, model: string): RatePlanRow | null {
  if (!isBookingModel(model)) return null;
  return get<RatePlanRow>(
    `SELECT * FROM rate_plans
      WHERE property_id = ? AND active = 1 AND booking_model = ?
      ORDER BY sort_order, name LIMIT 1`,
    propertyId, model,
  ) ?? null;
}

/**
 * Refuse a second plan for the same model.
 *
 * Two plans claiming one model would make "what does Rooms + surf cost" depend
 * on sort order, and the loser would sit in the rate calendar looking like it
 * was selling something. Better to say which plan already has it.
 */
export function assertModelFree(propertyId: string, model: unknown, exceptPlanId?: string): void {
  if (model === null || model === undefined || model === '') return;
  if (!isBookingModel(model)) {
    throw new HttpError(400, `bookingModel must be one of: ${BOOKING_MODELS.join(', ')}`);
  }
  const clash = get<{ id: string; code: string; name: string }>(
    `SELECT id, code, name FROM rate_plans
      WHERE property_id = ? AND booking_model = ? AND id <> ?`,
    propertyId, model, exceptPlanId ?? '',
  );
  if (clash) {
    throw new HttpError(409,
      `${clash.code} · ${clash.name} already sells that booking-engine package. `
      + 'Clear it there first.',
      'booking_model_taken');
  }
}

/* -------------------------------------------------------------- creation -- */

/**
 * Create the package rate plans this property is missing.
 *
 * Idempotent, and never touches a plan that already exists — a property that
 * has renamed its surf package, repriced it or pointed the model at a plan of
 * its own gets left exactly as it is.
 */
export function ensurePackagePlans(propertyId: string): { created: string[]; existing: string[] } {
  const created: string[] = [];
  const existing: string[] = [];

  const roomTypes = all<{ id: string }>(
    'SELECT id FROM room_types WHERE property_id = ? AND active = 1', propertyId,
  );

  for (const seed of SEEDS) {
    const already = get<{ code: string }>(
      `SELECT code FROM rate_plans WHERE property_id = ? AND (booking_model = ? OR code = ?)`,
      propertyId, seed.model, seed.code,
    );
    if (already) { existing.push(already.code); continue; }

    const planId = id('rp');
    run(
      `INSERT INTO rate_plans(id, property_id, code, name, description, kind, booking_model,
                              refundable, flexible, inclusions, offset_value, deposit_pct_bp,
                              sort_order, active, created_at)
       VALUES(?,?,?,?,?,'package',?,1,1,?,0,0,?,1,?)`,
      planId, propertyId, seed.code, seed.name, seed.description, seed.model,
      JSON.stringify(seed.inclusions), seed.sortOrder, nowIso(),
    );
    // Attached to every room type at zero, which is not a price: it is what
    // makes the plan show a row per room type in the calendar, where each cell
    // resolves to the room's own default until the package price is set.
    for (const rt of roomTypes) {
      run(
        `INSERT INTO rate_plan_room_types(rate_plan_id, room_type_id, base_rate_minor) VALUES(?,?,0)
         ON CONFLICT(rate_plan_id, room_type_id) DO NOTHING`,
        planId, rt.id,
      );
    }
    created.push(seed.code);
  }

  return { created, existing };
}
