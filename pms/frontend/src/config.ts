// ─────────────────────────────────────────────────────────────
// Every setting the front end has.
//
// The mirror of `backend/src/config.ts`, and it exists for the same reason:
// configuration used to be read inline wherever it was wanted, with a fallback
// written next to it. In this app that produced something worse than an
// untidy default —
//
//     import.meta.env.VITE_API_URL ?? 'https://…execute-api…amazonaws.com'
//
// — a *production* API address compiled into the source. A build with the
// variable missing or misspelled did not fail, and did not fall back to
// localhost. It quietly pointed a developer's browser at the live property's
// bookings. The address now lives in `.env.production`, where it is a
// deployment decision rather than a line of code, and a build that has no
// answer for it says so.
//
// One thing to understand about Vite: these values are **inlined at build
// time**, not read when the page loads. `npm run build` bakes in whatever was
// set then, so changing an API address means rebuilding, and nothing here can
// ever be a secret — every value ships to the browser in readable JavaScript.
// Anything that must stay private belongs to the API, behind a login.
// ─────────────────────────────────────────────────────────────

type Kind = 'url' | 'text';

interface Spec {
  /** Full variable name, so a search for `VITE_API_URL` lands on it. */
  readonly env: string;
  readonly kind: Kind;
  readonly doc: string;
  /** Used when the variable is absent. Absent default means "required". */
  readonly fallback?: string;
  /** Development-only fallback, for values that must be explicit in a build. */
  readonly devFallback?: string;
}

const SPECS = {
  apiUrl: {
    env: 'VITE_API_URL',
    kind: 'url',
    doc: 'Base URL of the Helio API. Must be an origin the API allows in its '
      + 'own CORS_ORIGIN list, or every request fails in a way the app cannot '
      + 'tell apart from the server being down.',
    // Deliberately no production fallback. In development the API on its
    // default port is a safe and obvious guess; in a build, guessing means
    // shipping something nobody chose.
    devFallback: 'https://api.funbunkpms.grobern.com',
  },

  channelHubName: {
    env: 'VITE_CHANNEL_HUB_NAME',
    kind: 'text',
    doc: 'What the distribution partner is called anywhere a user can read it. '
      + 'The default hides the supplier\'s name from customers; set it to the '
      + 'real name on an internal build. Must match HELIO_CHANNEL_HUB_NAME on '
      + 'the API, or the two halves of the app disagree on screen.',
    fallback: 'the channel manager',
  },

  appUrl: {
    env: 'VITE_APP_URL',
    kind: 'url',
    doc: 'Public address of this app, used when building a link somebody else has '
      + 'to open — the check-in QR code, for one. Defaults to whatever host served '
      + 'the page, which is right in production and wrong on a developer machine: '
      + 'a code containing "localhost" points a phone at itself.',
    fallback: '',
  },

  channelHubShort: {
    env: 'VITE_CHANNEL_HUB_SHORT',
    kind: 'text',
    doc: 'Short form for field labels: "Channel room id" rather than "the '
      + 'channel manager room id".',
    fallback: 'Channel',
  },
} satisfies Record<string, Spec>;

// ─── Reading ─────────────────────────────────────────────────

/**
 * Vite replaces `import.meta.env.VITE_X` textually during the build, so the
 * property has to be written out in full — a lookup by variable never gets
 * substituted and is `undefined` in the bundle. That is why this is a literal
 * map rather than a loop over `SPECS`.
 */
const RAW: Record<string, string | undefined> = {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_APP_URL: import.meta.env.VITE_APP_URL,
  VITE_CHANNEL_HUB_NAME: import.meta.env.VITE_CHANNEL_HUB_NAME,
  VITE_CHANNEL_HUB_SHORT: import.meta.env.VITE_CHANNEL_HUB_SHORT,
};

const DEV: boolean = import.meta.env.DEV;

export interface ConfigProblem {
  readonly env: string;
  readonly message: string;
}

const problems: ConfigProblem[] = [];

function read(key: keyof typeof SPECS): string {
  const spec: Spec = SPECS[key];
  const raw = RAW[spec.env]?.trim();

  if (!raw) {
    if (spec.fallback !== undefined) return spec.fallback;
    if (DEV && spec.devFallback !== undefined) return spec.devFallback;
    problems.push({
      env: spec.env,
      message: `is not set, and there is no safe default for a build. ${spec.doc}`,
    });
    return '';
  }

  if (spec.kind === 'url') {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      problems.push({ env: spec.env, message: `is not a valid URL: ${JSON.stringify(raw)}` });
      return '';
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      problems.push({ env: spec.env, message: `must be http or https, not ${parsed.protocol}` });
      return '';
    }
    // A trailing slash turns every request path into a double slash once it is
    // concatenated, so it is removed once here rather than in every caller.
    return parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, ''));
  }

  return raw;
}

/**
 * The settings, validated and frozen. Read this rather than `import.meta.env`.
 */
export const config = Object.freeze({
  apiUrl: read('apiUrl'),
  /** Empty when unset — callers fall back to `window.location.origin`. */
  appUrl: read('appUrl'),
  channelHubName: read('channelHubName'),
  channelHubShort: read('channelHubShort'),
  /** `development` or `production`, as Vite resolved it for this build. */
  mode: import.meta.env.MODE as string,
  isDev: DEV,
});

export const configProblems: readonly ConfigProblem[] = problems;

// A misconfigured build is worth interrupting for. It is not worth a blank
// screen, though: the app still starts, because an operator staring at nothing
// learns less than one looking at a running app with a loud console. The
// build-time check in vite.config.ts is the gate that actually stops a bad
// bundle being produced; this is the safety net for a bundle that got out.
if (problems.length) {
  const lines = problems.map((p) => `  · ${p.env} ${p.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(
    `helio.pms is misconfigured:\n${lines}\n\n`
    + 'These are build-time values. Set them in an .env file and rebuild — '
    + 'see frontend/.env.example.',
  );
}

export type Config = typeof config;
