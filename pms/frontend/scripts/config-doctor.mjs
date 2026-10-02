// ─────────────────────────────────────────────────────────────
// `npm run config` — what a build would compile into the bundle.
//
// The counterpart to the API's own `npm run config`, and it answers the
// question that used to need reading the source: given these .env files, what
// will the app actually talk to?
//
// It takes a mode, because that is where the surprises live. `npm run config`
// shows development; `npm run config -- production` shows what `npm run build`
// would produce. Running both is how you catch a `.env.local` that has been
// quietly overriding the deployed API address for a fortnight.
//
//   npm run config                 development
//   npm run config -- production   what a release build would use
//
// Nothing here can be secret: every VITE_ value is compiled into readable
// JavaScript and shipped to the browser. So unlike the API's report, there is
// nothing to redact — and a variable that *looks* like a credential is called
// out rather than hidden, because its presence is the problem.
// ─────────────────────────────────────────────────────────────
import { loadEnv } from 'vite';

const mode = process.argv[2] ?? 'development';
const env = loadEnv(mode, '.', '');

const RESET = '[0m', BOLD = '[1m', DIM = '[2m';
const GREEN = '[32m', YELLOW = '[33m', RED = '[31m';
const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (tty ? code + s + RESET : s);

/** Kept in step with src/config.ts — the same three variables, same defaults. */
const SPECS = [
  {
    env: 'VITE_API_URL', group: 'API',
    doc: 'Base URL of the Helio API.',
    devFallback: 'http://localhost:5000',
    requiredForBuild: true,
  },
  {
    env: 'VITE_CHANNEL_HUB_NAME', group: 'Branding',
    doc: 'Display name for the distribution partner.',
    fallback: 'the channel manager',
  },
  {
    env: 'VITE_CHANNEL_HUB_SHORT', group: 'Branding',
    doc: 'Short form, for field labels.',
    fallback: 'Channel',
  },
];

const problems = [];
const out = [];

out.push('');
out.push(`${paint(BOLD, 'helio.pms front-end configuration')}  ${paint(DIM, `· mode ${mode}`)}`);
out.push('');

// Which files Vite would read, in the order it reads them. A surprise is
// almost always a `.local` file somebody forgot about.
out.push(paint(BOLD, 'Files'));
const { existsSync } = await import('node:fs');
for (const name of ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]) {
  out.push(existsSync(name)
    ? `  ${paint(GREEN, '✓')} ${name}`
    : `  ${paint(DIM, '·')} ${paint(DIM, `${name} not present`)}`);
}
out.push('');

let group = '';
for (const spec of SPECS) {
  if (spec.group !== group) {
    group = spec.group;
    out.push(paint(BOLD, group));
  }
  const raw = env[spec.env]?.trim();
  let value, source;
  if (raw) {
    value = raw;
    source = 'set';
  } else if (mode === 'development' && spec.devFallback) {
    value = spec.devFallback;
    source = 'development default';
  } else if (spec.fallback !== undefined) {
    value = spec.fallback;
    source = 'default';
  } else {
    value = null;
    source = 'not set';
  }

  if (value === null && spec.requiredForBuild) {
    problems.push(`${spec.env} is not set — a build in mode "${mode}" would fail. ${spec.doc}`);
  }
  if (value && spec.env === 'VITE_API_URL' && mode === 'production'
    && /localhost|127\.0\.0\.1/.test(value)) {
    problems.push(
      `${spec.env} points at ${value} in production — the deployed app would try `
      + 'to reach the browser\'s own machine.',
    );
  }

  const shown = value === null ? paint(RED, 'not set') : paint(raw ? BOLD : DIM, value);
  out.push(`  ${spec.env.padEnd(26)} ${shown}  ${paint(DIM, `(${source})`)}`);
}
out.push('');

// Every VITE_ value ships in readable form, so anything that reads like a
// credential is either a misunderstanding or a leak.
const suspicious = Object.keys(env)
  .filter((k) => k.startsWith('VITE_') && /SECRET|PASSWORD|PRIVATE|_KEY$|TOKEN/i.test(k));
for (const k of suspicious) {
  problems.push(
    `${k} looks like a credential. Every VITE_ variable is compiled into the `
    + 'bundle in readable form — move it to the API.',
  );
}

// Variables that were set but that nothing reads: usually a typo, occasionally
// a leftover from a rename.
const known = new Set(SPECS.map((s) => s.env));
const unread = Object.keys(env).filter((k) => k.startsWith('VITE_') && !known.has(k));
if (unread.length) {
  out.push(paint(BOLD, 'Set but not read by this app'));
  for (const k of unread) out.push(`  ${paint(YELLOW, '!')} ${k}`);
  out.push('');
}

process.stdout.write(out.join('\n') + '\n');

if (problems.length) {
  process.stderr.write(paint(BOLD, `${problems.length} problem(s)\n`));
  for (const p of problems) process.stderr.write(`  ${paint(RED, '✗')} ${p}\n`);
  process.stderr.write('\nEvery variable is documented in frontend/.env.example.\n\n');
  process.exit(1);
}
process.stdout.write(paint(GREEN, '  No problems found.\n\n'));
