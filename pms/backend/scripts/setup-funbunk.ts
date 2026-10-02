// ─────────────────────────────────────────────────────────────
// The Fun Bunk — first-run setup.
//
//   npm run setup -- --yes
//
// Builds the whole installation from an empty database: one property, its
// owner, its rooms and beds, the rate plan they sell on, a year of prices and
// the booking page's settings. Run it once on a new machine; run it again with
// --yes to start over from clean.
//
// Deliberately written straight to the tables rather than through the API,
// because it has to run before there is a server, a login or a property to
// authenticate against — the chicken-and-egg the built-in setup wizard solves
// by asking a person eight questions. This answers them once, from the room
// list the property already published on Hostelworld.
//
// Everything it writes is ordinary configuration, editable afterwards in
// Configuration → Room types, Rooms and Rates. Nothing here is sample data:
// there are no demo bookings, no fake guests and no history. The property
// starts empty and real.
//
// ── --fresh: a genuinely new database file ──
//
//   npm run setup -- --yes --fresh
//
// Without it, setup empties the tables of the database that is already there.
// That is the right thing when you are re-seeding your own property, and the
// wrong thing when the file previously belonged to somebody else.
//
// Deleting a row in SQLite does not erase its bytes. The page is returned to a
// free list and the old content sits there until something happens to reuse
// it. On the file this installation started from, that left 550 readable
// strings from the previous business — the former staff's names and email
// addresses, and eighty-odd of their booking references — inside the file the
// new owner was trading on, with half the file being free pages.
//
// `--fresh` therefore does not empty tables. It moves the old file and the old
// backups into a dated archive folder and starts a new file from nothing, so
// the new business shares no bytes with the old one.
// ─────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, renameSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';

const args = process.argv.slice(2);
const CONFIRMED = args.includes('--yes');
const FRESH = args.includes('--fresh');

function out(s = '') { process.stdout.write(`${s}\n`); }

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
  code: 'FUNBUNK',
  name: 'The Fun Bunk',
  legalName: 'The Fun Bunk',
  kind: 'hostel',
  currency: 'USD',
  timezone: 'UTC',
  locale: 'en',
  checkIn: '14:00',
  checkOut: '11:00',
};

const OWNER = {
  name: 'Thilina',
  email: process.env.FUNBUNK_ADMIN_EMAIL?.trim() || 'thilina@funbunk.com',
  // Changed on first sign-in. Kept out of the code by preference, but a
  // default that is printed loudly beats a setup that cannot finish.
  password: process.env.FUNBUNK_ADMIN_PASSWORD?.trim() || 'FunBunk2026',
};

/**
 * The rooms, exactly as the property sells them.
 *
 * Taken from the Hostelworld rate calendar, which is the list the property has
 * already committed to publicly — so the PMS and the OTA agree on what a
 * "Deluxe 6 Bed Female Dorm Ensuite" is without anyone reconciling two lists.
 *
 * `rate` is the nightly price in whole currency units. Two rate shapes appear
 * in that calendar and both are reproduced below:
 *
 *   · a season — most rooms step up on 1 October and stay there, which is the
 *     property's high season rather than a weekend pattern;
 *   · a weekend — the standard double is dearer on Friday and Saturday all
 *     year, and does not move with the season at all.
 */
interface RoomTypeSpec {
  code: string;
  name: string;
  /** Shown to guests on the booking page. */
  description: string;
  kind: 'room' | 'dorm';
  /** How many physical rooms of this type exist. */
  rooms: number;
  /** Dorm berths per room. Ignored for private rooms. */
  bedsPerRoom?: number;
  /** Heads per sellable unit: a whole room for a private, one berth for a dorm. */
  maxOccupancy: number;
  genderPolicy: 'mixed' | 'female' | null;
  bedConfig: { kind: string; count: number }[];
  amenities: string[];
  /** Room numbers, in the order they are created. */
  numbers: string[];
  floor: number;
  /** Nightly rate in whole units, low season / ordinary weekday. */
  rate: number;
  /** Nightly rate from HIGH_SEASON_FROM onwards. Absent means no season. */
  highSeasonRate?: number;
  /** Friday and Saturday rate, all year. Absent means no weekend uplift. */
  weekendRate?: number;
}

/** The date the published calendar steps up to its higher rates. */
const HIGH_SEASON_FROM = '2026-10-01';

/** How far ahead prices are written. A year is what the rate screens expect. */
const CALENDAR_DAYS = 365;

const ROOM_TYPES: RoomTypeSpec[] = [
  {
    code: 'DLXDBLENS',
    name: 'Deluxe Double Bed Private Ensuite',
    description: 'A private room with a kingsize bed and its own bathroom.',
    kind: 'room',
    rooms: 1,
    maxOccupancy: 2,
    genderPolicy: null,
    bedConfig: [{ kind: 'king', count: 1 }],
    amenities: ['Ensuite bathroom', 'Kingsize bed', 'Towels included', 'Wi-Fi'],
    numbers: ['101'],
    floor: 1,
    rate: 30,
    highSeasonRate: 35,
  },
  {
    code: 'STDDBLSHR',
    name: 'Standard Double Bed Private Shared Bathroom',
    description: 'A private double room. The bathroom is just outside, shared with one other room.',
    kind: 'room',
    rooms: 1,
    maxOccupancy: 2,
    genderPolicy: null,
    bedConfig: [{ kind: 'double', count: 1 }],
    amenities: ['Shared bathroom', 'Double bed', 'Towels included', 'Wi-Fi'],
    numbers: ['102'],
    floor: 1,
    rate: 25,
    weekendRate: 30,
  },
  {
    code: 'DLX4MIXENS',
    name: 'Deluxe 4 Bed Mixed Dorm Ensuite',
    description: 'A four-berth mixed dorm with its own bathroom. Sold by the bed.',
    kind: 'dorm',
    rooms: 1,
    bedsPerRoom: 4,
    maxOccupancy: 1,
    genderPolicy: 'mixed',
    bedConfig: [{ kind: 'dorm_bunk', count: 4 }],
    amenities: ['Ensuite bathroom', 'Reading light', 'Power socket per bed', 'Locker', 'Wi-Fi'],
    numbers: ['201'],
    floor: 2,
    rate: 9,
    highSeasonRate: 15,
  },
  {
    code: 'DLX6MIXENS',
    name: 'Deluxe 6 Bed Mixed Dorm Ensuite',
    description: 'A six-berth mixed dorm with its own bathroom. Sold by the bed.',
    kind: 'dorm',
    rooms: 1,
    bedsPerRoom: 6,
    maxOccupancy: 1,
    genderPolicy: 'mixed',
    bedConfig: [{ kind: 'dorm_bunk', count: 6 }],
    amenities: ['Ensuite bathroom', 'Reading light', 'Power socket per bed', 'Locker', 'Wi-Fi'],
    numbers: ['202'],
    floor: 2,
    rate: 8.3,
    highSeasonRate: 14,
  },
  {
    code: 'DLX6FEMENS',
    name: 'Deluxe 6 Bed Female Dorm Ensuite',
    description: 'A six-berth female-only dorm with its own bathroom. Sold by the bed.',
    kind: 'dorm',
    rooms: 1,
    bedsPerRoom: 6,
    maxOccupancy: 1,
    genderPolicy: 'female',
    bedConfig: [{ kind: 'dorm_bunk', count: 6 }],
    amenities: ['Female only', 'Ensuite bathroom', 'Reading light', 'Power socket per bed', 'Locker', 'Wi-Fi'],
    numbers: ['203'],
    floor: 2,
    rate: 8.3,
    highSeasonRate: 16,
  },
  {
    code: 'STD8MIXENS',
    name: 'Standard 8 Bed Mixed Dorm Ensuite',
    description: 'An eight-berth mixed dorm with its own bathroom. Sold by the bed.',
    kind: 'dorm',
    rooms: 2,
    bedsPerRoom: 8,
    maxOccupancy: 1,
    genderPolicy: 'mixed',
    bedConfig: [{ kind: 'dorm_bunk', count: 8 }],
    amenities: ['Ensuite bathroom', 'Reading light', 'Power socket per bed', 'Locker', 'Wi-Fi'],
    numbers: ['301', '302'],
    floor: 3,
    rate: 8,
    highSeasonRate: 14,
  },
];

/** Stay limits, as published: any length from one night up to a month. */
const MIN_STAY = 1;
const MAX_STAY = 30;

// ─── Helpers ─────────────────────────────────────────────────

/** Whole currency units to minor units, without a float rounding surprise. */
const minor = (units: number) => Math.round(units * 100);

/** Friday or Saturday, the two nights the standard double is dearer. */
function isWeekend(date: string): boolean {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 5 || d === 6;
}

/** What one room type costs on one date, by the two rules above. */
function rateFor(spec: RoomTypeSpec, date: string): number {
  if (spec.weekendRate !== undefined && isWeekend(date)) return spec.weekendRate;
  if (spec.highSeasonRate !== undefined && date >= HIGH_SEASON_FROM) return spec.highSeasonRate;
  return spec.rate;
}

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
  out('  The Fun Bunk — setup');
  out('  ────────────────────────────────────────────────');
  out(`  Right now it holds ${existing} propert${existing === 1 ? 'y' : 'ies'} `
    + `and ${reservations} reservation${reservations === 1 ? '' : 's'}.`);
  out('');
  out('  Two ways to start over. Nothing has been changed yet.');
  out('');
  out('   1. Empty the tables and re-seed — same database file:');
  out('');
  out('        npm run setup -- --yes');
  out('');
  out('      Right when you are re-seeding your own property.');
  out('');
  out('   2. A genuinely new database file:');
  out('');
  out('        npm run setup -- --yes --fresh');
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
out('  The Fun Bunk — setup');
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
        minor(rateFor(spec, date)), nowIso(),
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
    ['booking_engine.tagline', 'Beds and private rooms, booked direct.'],
    ['booking_engine.intro',
      'Book straight with us — the same beds the big sites list, without their commission.'],
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
  const season = s.highSeasonRate !== undefined ? ` → ${s.highSeasonRate.toFixed(2)} from ${HIGH_SEASON_FROM}` : '';
  const weekend = s.weekendRate !== undefined ? ` · ${s.weekendRate.toFixed(2)} Fri & Sat` : '';
  out(`    ${s.numbers.join(',').padEnd(9)} ${s.name}`);
  out(`    ${''.padEnd(9)} ${units.padEnd(9)} ${PROPERTY.currency} ${s.rate.toFixed(2)}${season}${weekend}`);
}

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
out('    npm start                    the API on http://localhost:5000');
out('    npm --prefix ../frontend run dev    the PMS on http://localhost:3000');
out('');
out('    The booking page is live the moment the API is:');
out('    http://localhost:5000/book');
out('');

exec('PRAGMA wal_checkpoint(TRUNCATE)');
