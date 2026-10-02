// ─────────────────────────────────────────────────────────────
// Surf & Retreat — first-run setup.
//
//   npm run setup:surfretreat -- --yes
//
// Builds Surf & Retreat in its own database (data/surfretreat.db), next to and
// entirely separate from The Fun Bunk's data/helio.db: one property, its owner,
// the eight room types its website sells (one room each, dorm beds included), the
// rate plan, a year of prices, and the website add-ons (surf, skate, yoga,
// coworking) with their prices.
//
// Room type codes are the website's room ids and add-on ids are the website's
// add-on ids, so /api/public/website-prices lines up with the site with no
// mapping table. Prices start at the figures the website bundles as its
// fallback; change them in Rates & Inventory and Booking engine → Website add-ons.
//
// Settings come from backend/surfretreat/.env, never backend/.env: that file
// holds Fun Bunk's Beds24 token, and the PMS connects Beds24 to the only
// property it finds at start-up. The script refuses to run against Fun Bunk's
// database or backup folder.
//
// Run again with --yes to empty the tables and re-seed, or --yes --fresh to
// archive the file and start a new one.
// ─────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, renameSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const CONFIRMED = args.includes('--yes');
const FRESH = args.includes('--fresh');

function out(s = '') { process.stdout.write(`${s}\n`); }

// Must be set before config.ts is imported: it decides which .env files are read.
process.env.HELIO_ENV_DIR ||= 'surfretreat';

/*
 * Everything below is imported *after* the archive step, and that ordering is
 * load-bearing rather than tidy.
 *
 * `db.ts` opens the database file the moment it is imported. A static import
 * at the top of this file would therefore hold the old file open, and moving a
 * file Windows has an open handle on either fails outright or leaves the
 * process writing into a file that is no longer where it thinks it is.
 *
 * `config.ts` is safe to load early — it reads the `.env` cascade and opens
 * nothing — so it can tell us which file we are about to move.
 */
const { config } = await import('../src/config.ts');
const DB_PATH = config.databasePath;

// Never seed (or --fresh archive) over The Fun Bunk's live database or its backups.
const BACKEND = dirname(dirname(fileURLToPath(import.meta.url)));
const FUN_BUNK = { db: join(BACKEND, 'data', 'helio.db'), backups: join(BACKEND, 'backups') };
const same = (a: string, b: string) => a.replace(/\\/g, '/').toLowerCase() === b.replace(/\\/g, '/').toLowerCase();
if (same(DB_PATH, FUN_BUNK.db) || same(config.backupDir, FUN_BUNK.backups)) {
  out('');
  out(`  Refusing to run: this would write to ${same(DB_PATH, FUN_BUNK.db) ? DB_PATH : config.backupDir},`);
  out('  which belongs to The Fun Bunk. Set HELIO_DB and HELIO_BACKUP_DIR in surfretreat/.env.');
  out('');
  process.exit(1);
}

/** The two files SQLite keeps beside the database in WAL mode. */
const SIDECARS = ['-wal', '-shm'];

/**
 * Move the old installation out of the way, intact.
 *
 * Moved rather than deleted, deliberately. These are another business's
 * records: they may still be needed for tax, for a dispute, or simply because
 * somebody changes their mind an hour later. Destroying them is a decision for
 * the person who owns them, and this prints the one command that does it
 * rather than making that choice on their behalf.
 */
function archiveOldInstallation(): { dir: string; moved: string[] } | null {
  if (!existsSync(DB_PATH)) return null;

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = join(dirname(dirname(DB_PATH)), 'archive', `pre-fresh-${stamp}`);
  mkdirSync(dir, { recursive: true });
  const moved: string[] = [];

  const move = (from: string, to: string) => {
    if (!existsSync(from)) return;
    renameSync(from, to);
    moved.push(basename(from));
  };

  move(DB_PATH, join(dir, basename(DB_PATH)));
  for (const s of SIDECARS) move(`${DB_PATH}${s}`, join(dir, `${basename(DB_PATH)}${s}`));

  /*
   * The automatic backups go with it.
   *
   * They are whole copies of the same database, so leaving them behind would
   * archive the original and keep four verbatim reproductions of it sitting in
   * the live backup folder — which is the opposite of what somebody asking for
   * a clean start means. The restore script reads this folder, so a stale
   * backup here is also a foot-gun: restoring one would bring the old business
   * straight back.
   */
  const backupDir = config.backupDir;
  if (existsSync(backupDir)) {
    const keep = join(dir, 'backups');
    for (const name of readdirSync(backupDir)) {
      const full = join(backupDir, name);
      let isDir: boolean;
      try {
        isDir = statSync(full).isDirectory();
      } catch { continue; }
      // Folders go too, whole. The scheduler only ever writes flat files here,
      // but people put their own copies in subfolders before doing something
      // risky — and a subfolder holding a complete copy of the old database is
      // exactly what this is supposed to be clearing out. Skipping it left the
      // old business sitting in the live backup folder with everything else
      // archived around it.
      if (!isDir && !/\.(db|bak)(-wal|-shm)?$/.test(name)) continue;
      mkdirSync(keep, { recursive: true });
      move(full, join(keep, name));
    }
  }
  return { dir, moved };
}

// Archive first, then open. Nothing above this line has touched the database.
const archived = FRESH && CONFIRMED ? archiveOldInstallation() : null;

const { migrate, run, get, all, scalar, tx, exec, database, jsonCol } =
  await import('../src/db.ts');
const { hashPassword } = await import('../src/auth.ts');
const { seedOperationalDefaults } = await import('../src/routes/auth.ts');
const { id, nowIso, todayIso, addDays, dateRange } = await import('../src/lib/util.ts');

// ─── The property ────────────────────────────────────────────
const PROPERTY = {
  code: 'SURFRETREAT',
  name: 'Surf & Retreat Hostel',
  legalName: 'Surf & Retreat Hostel Weligama',
  kind: 'hostel',
  currency: 'USD',
  timezone: 'Asia/Colombo',
  locale: 'en',
  checkIn: '14:00',
  checkOut: '11:00',
};

const OWNER = {
  name: 'Surf & Retreat',
  email: process.env.SURFRETREAT_ADMIN_EMAIL?.trim() || 'hello@surfandretreat.lk',
  // Changed on first sign-in. A default that is printed loudly beats a setup
  // that cannot finish.
  password: process.env.SURFRETREAT_ADMIN_PASSWORD?.trim() || 'SurfRetreat2026',
};

interface RoomTypeSpec {
  /** The website's room id — the price feed is keyed by it. */
  code: string;
  name: string;
  /** Shown to guests on the booking page. */
  description: string;
  kind: 'room' | 'dorm';
  /** Dorm berths per room. Ignored for private rooms. */
  bedsPerRoom?: number;
  /** Heads per sellable unit: a whole room for a private, one berth for a dorm. */
  maxOccupancy: number;
  genderPolicy: 'mixed' | 'female' | null;
  bedConfig: { kind: string; count: number }[];
  amenities: string[];
  /** Room numbers, in the order they are created. */
  numbers: string[];
  /** 0 is the ground floor. */
  floor: number;
  /** Nightly rate in whole units (per bed for dorms). */
  rate: number;
}

/** How far ahead prices are written. A year is what the rate screens expect. */
const CALENDAR_DAYS = 365;

/**
 * The rooms, as listed in the property's own room notes, one physical room of
 * each type. Rates match the website's bundled fallback prices so the site
 * reads the same before and after it is connected; change them in Rates &
 * Inventory.
 */
const ROOM_TYPES: RoomTypeSpec[] = [
  {
    code: 'mixed-dorm',
    name: '6-Bed Mixed Dorm',
    description: 'A ground-floor mixed dorm with six bunk beds and a shared bathroom. Sold by the bed.',
    kind: 'dorm', bedsPerRoom: 6, maxOccupancy: 1, genderPolicy: 'mixed',
    bedConfig: [{ kind: 'dorm_bunk', count: 6 }],
    amenities: ['Shared bathroom', 'Bunk beds', 'Ground floor', 'Wi-Fi'],
    numbers: ['G1'], floor: 0, rate: 12,
  },
  {
    code: 'female-dorm',
    name: '6-Bed Female Dorm',
    description: 'The big first-floor female dorm with six bunk beds and a shared bathroom. Sold by the bed.',
    kind: 'dorm', bedsPerRoom: 6, maxOccupancy: 1, genderPolicy: 'female',
    bedConfig: [{ kind: 'dorm_bunk', count: 6 }],
    amenities: ['Female only', 'Shared bathroom', 'Bunk beds', 'First floor', 'Wi-Fi'],
    numbers: ['101'], floor: 1, rate: 13,
  },
  {
    code: 'female-dorm-ensuite',
    name: '6-Bed Female Dorm Ensuite',
    description: 'A first-floor female dorm with its own private bathroom. Sold by the bed.',
    kind: 'dorm', bedsPerRoom: 6, maxOccupancy: 1, genderPolicy: 'female',
    bedConfig: [{ kind: 'dorm_bunk', count: 6 }],
    amenities: ['Female only', 'Private bathroom', 'First floor', 'Wi-Fi'],
    numbers: ['102'], floor: 1, rate: 15,
  },
  {
    code: 'bunk-double',
    name: 'Bunk Bed Double Room',
    description: 'A private ground-floor room with one bunk bed for two, and a shared bathroom.',
    kind: 'room', maxOccupancy: 2, genderPolicy: null,
    bedConfig: [{ kind: 'bunk', count: 1 }],
    amenities: ['Private room', 'Bunk bed', 'Shared bathroom', 'Ground floor', 'Wi-Fi'],
    numbers: ['G2'], floor: 0, rate: 22,
  },
  {
    code: 'double-shared',
    name: 'Standard Double Room',
    description: 'A private non-A/C double with a queen-size bed and a shared bathroom.',
    kind: 'room', maxOccupancy: 2, genderPolicy: null,
    bedConfig: [{ kind: 'queen', count: 1 }],
    amenities: ['Queen bed', 'Fan', 'Shared bathroom', 'Wi-Fi'],
    numbers: ['D1'], floor: 0, rate: 25,
  },
  {
    code: 'double-ac-shared',
    name: 'Standard Double Room A/C',
    description: 'A private air-conditioned double with a queen-size bed and a shared bathroom.',
    kind: 'room', maxOccupancy: 2, genderPolicy: null,
    bedConfig: [{ kind: 'queen', count: 1 }],
    amenities: ['Air conditioning', 'Queen bed', 'Shared bathroom', 'Wi-Fi'],
    numbers: ['D2'], floor: 0, rate: 30,
  },
  {
    code: 'double-ensuite-kitchen',
    name: 'Standard Double Ensuite with Kitchen',
    description: 'An apartment-style non-A/C double with a queen-size bed, private bathroom and kitchen.',
    kind: 'room', maxOccupancy: 2, genderPolicy: null,
    bedConfig: [{ kind: 'queen', count: 1 }],
    amenities: ['Kitchen', 'Private bathroom', 'Queen bed', 'Fan', 'Wi-Fi'],
    numbers: ['D3'], floor: 0, rate: 35,
  },
  {
    code: 'double-ac-ensuite',
    name: 'Standard Double Room A/C Ensuite',
    description: 'A private air-conditioned double with a queen-size bed and its own bathroom.',
    kind: 'room', maxOccupancy: 2, genderPolicy: null,
    bedConfig: [{ kind: 'queen', count: 1 }],
    amenities: ['Air conditioning', 'Private bathroom', 'Queen bed', 'Wi-Fi'],
    numbers: ['D4'], floor: 0, rate: 38,
  },
];

/**
 * The website's add-ons, keyed by the website's ids. Prices in minor units,
 * starting at the site's bundled figures; edited in Booking engine → Website
 * add-ons.
 */
const WEBSITE_ADDONS = [
  { id: 'beginner-week', group: 'surf', name: 'Beginner Surf Week', unit: ' / week', priceMinor: 14900 },
  { id: 'intermediate-coaching', group: 'surf', name: 'Intermediate Coaching', unit: ' / week', priceMinor: 18900 },
  { id: 'board-rental', group: 'surf', name: 'Board Rental (from)', unit: ' / half-day', priceMinor: 500 },
  { id: 'skate-lesson', group: 'skate', name: 'Surfskate Lesson', unit: ' / session', priceMinor: 1500 },
  { id: 'skate-rental', group: 'skate', name: 'Surfskate Rental', unit: ' / day', priceMinor: 500 },
  { id: 'yoga-class', group: 'yoga', name: 'Sunrise Yoga Class', unit: ' / class', priceMinor: 800 },
  { id: 'yoga-pack', group: 'yoga', name: '5-Class Yoga Pack', unit: ' / 5 classes', priceMinor: 3500 },
  { id: 'day-pass', group: 'coworking', name: 'Coworking Day Pass', unit: ' per day', priceMinor: 800 },
  { id: 'week-pass', group: 'coworking', name: 'Coworking Week Pass', unit: ' per week', priceMinor: 3900 },
  { id: 'month-pass', group: 'coworking', name: 'Coworking Month Pass', unit: ' per month', priceMinor: 12900 },
];

/** Stay limits: any length from one night up to the online maximum of 90. */
const MIN_STAY = 1;
const MAX_STAY = 90;

// ─── Helpers ─────────────────────────────────────────────────

/** Whole currency units to minor units, without a float rounding surprise. */
const minor = (units: number) => Math.round(units * 100);

/**
 * Empties every table that holds data, leaving the schema alone.
 *
 * Foreign keys are switched off for the duration rather than the tables being
 * ordered by dependency: the order is long, it changes whenever a table is
 * added, and getting it wrong fails halfway through with the database already
 * half-empty. Off-delete-on is the same result and cannot rot.
 */
function wipe() {
  const keep = new Set(['schema_meta', 'sqlite_stat1', 'db_checks']);
  const tables = all<{ name: string }>(
    `SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
  ).map((t) => t.name).filter((t) => !keep.has(t));

  database.exec('PRAGMA foreign_keys = OFF');
  try {
    tx(() => { for (const t of tables) run(`DELETE FROM "${t}"`); });
  } finally {
    database.exec('PRAGMA foreign_keys = ON');
  }
  return tables.length;
}

// ─── Run ─────────────────────────────────────────────────────
migrate();

const existing = scalar<number>('SELECT count(*) AS n FROM properties');
const reservations = scalar<number>('SELECT count(*) AS n FROM reservations');

if (!CONFIRMED) {
  out('');
  out('  Surf & Retreat — setup');
  out('  ────────────────────────────────────────────────');
  out(`  Right now it holds ${existing} propert${existing === 1 ? 'y' : 'ies'} `
    + `and ${reservations} reservation${reservations === 1 ? '' : 's'}.`);
  out('');
  out('  Two ways to start over. Nothing has been changed yet.');
  out('');
  out('   1. Empty the tables and re-seed — same database file:');
  out('');
  out('        npm run setup:surfretreat -- --yes');
  out('');
  out('      Right when you are re-seeding your own property.');
  out('');
  out('   2. A genuinely new database file:');
  out('');
  out('        npm run setup:surfretreat -- --yes --fresh');
  out('');
  out('      Deleting rows does not erase their bytes — they sit in free pages');
  out('      until something reuses them. Use this when the file belonged to a');
  out('      different business, so the new one shares no bytes with the old.');
  out('      The old file and its backups are moved to a dated archive folder,');
  out('      not destroyed.');
  out('');
  process.exit(1);
}

out('');
out('  Surf & Retreat — setup');
out('  ────────────────────────────────────────────────');

if (archived) {
  out(`  archived     ${archived.moved.length} file(s) → ${archived.dir}`);
  out('  database     starting from nothing — no page is inherited');
} else {
  const cleared = wipe();
  out(`  cleared      ${cleared} tables (same file — use --fresh for a new one)`);
}

const businessDate = todayIso();
const propertyId = id('prp');
const ownerId = id('usr');

tx(() => {
  // ── Property ──
  run(
    `INSERT INTO properties(id, code, name, legal_name, kind, address, city, country, timezone,
                            currency, locale, business_date, check_in_time, check_out_time,
                            phone, email, website, tax_id, active, created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)`,
    propertyId, PROPERTY.code, PROPERTY.name, PROPERTY.legalName, PROPERTY.kind,
    null, null, null, PROPERTY.timezone,
    PROPERTY.currency, PROPERTY.locale, businessDate,
    PROPERTY.checkIn, PROPERTY.checkOut,
    null, OWNER.email, null, null, nowIso(),
  );

  // ── Owner ──
  const { hash, salt } = hashPassword(OWNER.password);
  run(
    `INSERT INTO users(id, email, name, password_hash, password_salt, role, active, created_at)
     VALUES(?,?,?,?,?,'admin',1,?)`,
    ownerId, OWNER.email, OWNER.name, hash, salt, nowIso(),
  );
  run('INSERT INTO user_properties(user_id, property_id, role) VALUES(?,?,?)',
    ownerId, propertyId, 'admin');

  // ── Chart of accounts ──
  seedOperationalDefaults(propertyId);

  // ── Rate plan ──
  // One public plan. A hostel this size does not need a rate structure; it
  // needs one price per bed per night that the front desk and the booking page
  // both read. BAR is the code the public endpoints look for by name.
  const ratePlanId = id('rtp');
  run(
    `INSERT INTO rate_plans(id, property_id, code, name, description, kind, refundable,
                            flexible, min_los, max_los, inclusions, deposit_pct_bp,
                            sort_order, active, created_at)
     VALUES(?,?,'BAR','Standard Rate',?,'public',1,1,?,?,?,0,0,1,?)`,
    ratePlanId, propertyId,
    'The nightly rate, free to cancel up to 24 hours before arrival.',
    MIN_STAY, MAX_STAY, jsonCol(['Wi-Fi', 'Bed linen', 'Towel']), nowIso(),
  );

  // ── Room types, rooms, beds and prices ──
  const dates = dateRange(businessDate, addDays(businessDate, CALENDAR_DAYS));

  ROOM_TYPES.forEach((spec, order) => {
    const roomTypeId = id('rt');
    run(
      `INSERT INTO room_types(id, property_id, code, name, description, kind,
                              base_occupancy, max_occupancy, max_adults, max_children,
                              default_rate_minor, extra_adult_minor, extra_child_minor,
                              amenities, gender_policy, sort_order, active, created_at,
                              protect_last_rooms, bed_config)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,0,0,?,?,?,1,?,0,?)`,
      roomTypeId, propertyId, spec.code, spec.name, spec.description, spec.kind,
      // A dorm berth is sold to one person; a private room's standard
      // occupancy is the whole bed it contains.
      spec.kind === 'dorm' ? 1 : spec.maxOccupancy,
      spec.maxOccupancy, spec.maxOccupancy, 0,
      minor(spec.rate), jsonCol(spec.amenities), spec.genderPolicy, order, nowIso(),
      jsonCol(spec.bedConfig),
    );

    // The plan sells every room type, at that type's own base rate.
    run(
      `INSERT INTO rate_plan_room_types(rate_plan_id, room_type_id, base_rate_minor)
       VALUES(?,?,?)`,
      ratePlanId, roomTypeId, minor(spec.rate),
    );

    for (const number of spec.numbers) {
      const roomId = id('rm');
      run(
        `INSERT INTO rooms(id, property_id, room_type_id, number, floor, wing, status,
                           hk_section, features, bed_config, notes, connecting_to,
                           active, created_at)
         VALUES(?,?,?,?,?,NULL,'Vacant Clean',?,?,NULL,NULL,NULL,1,?)`,
        roomId, propertyId, roomTypeId, number, spec.floor,
        `Floor ${spec.floor}`, jsonCol([]), nowIso(),
      );

      // A dorm's sellable inventory is its berths, so they are created with
      // the room. Bunks alternate bottom/top, which is what housekeeping and
      // the bed-level tape chart read.
      if (spec.kind === 'dorm') {
        const count = spec.bedsPerRoom ?? 1;
        for (let i = 1; i <= count; i++) {
          run(
            `INSERT INTO beds(id, property_id, room_id, code, bunk, status, active)
             VALUES(?,?,?,?,?,'Vacant Clean',1)`,
            id('bed'), propertyId, roomId,
            `${number}-${String(i).padStart(2, '0')}`,
            count === 1 ? 'single' : i % 2 === 1 ? 'bottom' : 'top',
          );
        }
      }
    }

    // A year of prices, written date by date so the rate screens, the booking
    // page and the front desk all quote the same number without anyone having
    // to open the calendar first.
    for (const date of dates) {
      run(
        `INSERT INTO rate_calendar(id, property_id, room_type_id, rate_plan_id, date,
                                   price_minor, updated_at, updated_by)
         VALUES(?,?,?,?,?,?,?,'setup')`,
        id('rc'), propertyId, roomTypeId, ratePlanId, date,
        minor(spec.rate), nowIso(),
      );
    }
  });

  // ── Stay limits ──
  // Published as 1–30 nights. Held as restrictions rather than only on the
  // plan so they apply to a walk-in typed at the desk too.
  for (const [type, value] of [['min-stay', MIN_STAY], ['max-stay', MAX_STAY]] as const) {
    run(
      `INSERT INTO restrictions(id, property_id, room_type_id, rate_plan_id, channel_code,
                                date_from, date_to, type, value, note, active, created_by, created_at)
       VALUES(?,?,NULL,NULL,NULL,?,?,?,?,?,1,'setup',?)`,
      id('rst'), propertyId, businessDate, addDays(businessDate, CALENDAR_DAYS),
      type, value, 'Published stay limits', nowIso(),
    );
  }

  // ── Cancellation policy ──
  run(
    `INSERT INTO policies(id, property_id, kind, name, scope, summary, details, active, updated_at)
     VALUES(?,?,'cancellation','Free cancellation until 24 hours before','property',?,?,1,?)`,
    id('pol'), propertyId,
    'Cancel free of charge up to 24 hours before check-in.',
    'Cancellations inside 24 hours, and no-shows, are charged the first night.',
    nowIso(),
  );

  // ── Booking page ──
  // On from the moment the rooms exist. The whole point of the built-in
  // booking engine is that setting up rooms is the only step: there is no
  // second site to build, brand or deploy before the link works.
  const settings: [string, unknown][] = [
    ['booking_engine.enabled', true],
    ['booking_engine.tagline', 'Surf, stay and cowork five minutes from Weligama Bay.'],
    ['booking_engine.intro',
      'Book straight with us — dorm beds and private doubles, plus surf, skate, yoga and desk passes.'],
    // The website's add-on menu and prices; served by /api/public/website-prices.
    ['website.addons', WEBSITE_ADDONS],
  ];
  for (const [key, value] of settings) {
    run(
      `INSERT INTO settings(property_id, key, value, updated_at, updated_by)
       VALUES(?,?,?,?,'setup')`,
      propertyId, key, JSON.stringify(value), nowIso(),
    );
  }
});

// ─── Report ──────────────────────────────────────────────────
const rooms = scalar<number>('SELECT count(*) AS n FROM rooms WHERE property_id = ?', propertyId);
const beds = scalar<number>('SELECT count(*) AS n FROM beds WHERE property_id = ?', propertyId);
const prices = scalar<number>('SELECT count(*) AS n FROM rate_calendar WHERE property_id = ?', propertyId);
const heads = ROOM_TYPES.reduce(
  (sum, s) => sum + s.numbers.length * (s.kind === 'dorm' ? (s.bedsPerRoom ?? 0) : s.maxOccupancy), 0);

out(`  property     ${PROPERTY.name} (${PROPERTY.code}) · ${PROPERTY.currency} · business date ${businessDate}`);
out(`  owner        ${OWNER.name} <${OWNER.email}>`);
out(`  room types   ${ROOM_TYPES.length}`);
out(`  rooms        ${rooms}   (${beds} dorm beds, sleeps ${heads})`);
out(`  prices       ${prices} nightly rates, ${CALENDAR_DAYS} days ahead`);
out(`  stay limits  ${MIN_STAY}–${MAX_STAY} nights`);
out('');

for (const s of ROOM_TYPES) {
  const units = s.kind === 'dorm' ? `${s.numbers.length * (s.bedsPerRoom ?? 0)} beds` : `${s.numbers.length} room`;
  out(`    ${s.numbers.join(',').padEnd(9)} ${s.name}  [${s.code}]`);
  out(`    ${''.padEnd(9)} ${units.padEnd(9)} ${PROPERTY.currency} ${s.rate.toFixed(2)}`);
}
out(`  add-ons      ${WEBSITE_ADDONS.length} (surf, skate, yoga, coworking)`);

out('');
out('  Sign in');
out('  ────────────────────────────────────────────────');
out(`    email     ${OWNER.email}`);
out(`    password  ${OWNER.password}`);
out('');
out('    Change it from the account menu once you are in.');
out('');
out('  Next');
out('  ────────────────────────────────────────────────');
out(`    npm run start:surfretreat                        the API on http://localhost:${config.port}`);
out('    npm --prefix ../frontend run dev:surfretreat     the PMS on http://localhost:3002');
out('');
out('    The website reads its prices from:');
out(`    http://localhost:${config.port}/api/public/website-prices`);
out('');

exec('PRAGMA wal_checkpoint(TRUNCATE)');
