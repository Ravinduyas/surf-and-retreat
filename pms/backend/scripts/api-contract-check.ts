// ─────────────────────────────────────────────────────────────
// Every API path the front end calls, against every route the server has.
//
//   node --experimental-strip-types scripts/api-contract-check.ts
//
// This exists because of a bug that was invisible to everything else we run.
//
// Configuration → Invoice branding was a finished screen — logo upload, size
// validation, wording, a save button — talking to `GET /api/config/invoice-branding`,
// which had never been written. It answered "Not found" every time anybody
// opened it. So did `GET /api/invoices/:id/document`, which meant no invoice
// could be viewed or printed at all: a property could issue one and then had
// no way to show it to the guest.
//
// Nothing caught it. TypeScript checks both halves and cannot see between
// them: `api.get<InvoiceBranding>('/api/config/invoice-branding')` type-checks
// perfectly against a server that has no such route, because the path is a
// string. The browser checks drive the screens somebody thought to script. The
// business suites run against the API and never open a screen.
//
// A missing endpoint is not a subtle failure — it is a whole feature that does
// nothing — so it is worth one cheap check that compares the two lists.
//
// It needs no database and no browser: it reads the front end's source for
// call sites, and asks a running server for its route table.
// ─────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../src/config.ts';

const API = config.apiUrl;
const FRONTEND = join(import.meta.dirname, '..', '..', 'frontend', 'src');

let failures = 0;
let checks = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  checks++;
  process.stdout.write(`  ${ok ? '✓' : '✗'} ${name}\n`);
  if (!ok) {
    failures++;
    if (detail !== undefined) process.stdout.write(`      ${JSON.stringify(detail).slice(0, 400)}\n`);
  }
}
function section(t: string) { process.stdout.write(`\n${t}\n${'─'.repeat(t.length)}\n`); }

/* ----------------------------------------------------- the front end ---- */

interface CallSite { method: string; path: string; file: string; line: number }

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { out.push(...sourceFiles(full)); continue; }
    if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

/**
 * Turn a template literal into the shape the router registers.
 *
 * `/api/reservations/${id}/cancel` and `/api/reservations/:id/cancel` are the
 * same route; the front end writes the first and the server the second, so
 * interpolations become `:param` and the two can be compared at all.
 *
 * Two things a regex gets wrong here, both of which produced nonsense paths
 * like `/api/reports/pace:param)}` on the first run of this check:
 *
 *   · The interpolations nest. `${qs({ from, to })}` contains a `}` of its
 *     own, so a non-greedy `\$\{[^}]*\}` stops at the wrong one and leaves the
 *     rest of the expression in the path. Braces are counted instead.
 *   · Not every interpolation is a path segment. `${qs(…)}` and `${params}`
 *     build a *query string*, which the router never sees — turning those
 *     into `:param` invents a segment and reports a perfectly good call as
 *     missing. They are dropped.
 */
function normalise(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] !== '$' || raw[i + 1] !== '{') { out += raw[i]; continue; }
    // Walk to the matching close brace, counting nesting.
    let depth = 0;
    let j = i + 1;
    for (; j < raw.length; j += 1) {
      if (raw[j] === '{') depth += 1;
      else if (raw[j] === '}') { depth -= 1; if (depth === 0) break; }
    }
    const expr = raw.slice(i + 2, j).trim();
    /*
     * A query-string builder contributes nothing to the route.
     *
     * `qs({ channelId })` produces `?channelId=...`, which the router never
     * sees: it matches on path segments only. Treating one as a segment
     * invents `/api/channel-mappings/:param` and reported eight perfectly
     * good calls as missing on the first run of this check.
     *
     * Matched with plain string tests rather than a pattern. A regex here has
     * to survive being written into this file, and one mangled escape
     * silently turned this whole condition off once already.
     */
    const isQuery = expr.includes('qs(')
      || expr.endsWith('params')
      || expr.endsWith('query')
      // A ternary that yields a literal query string, e.g.
      //   ${date ? `?date=${date}` : ''}
      // which is a quote or backtick immediately followed by a question mark.
      || /['"`]\?/.test(expr);
    out += isQuery ? '' : ':param';
    i = j;
  }
  return out.split('?')[0].replace(/\/+$/, '') || '/';
}

/** Every `api.get('…')` and friends across the front end. */
/**
 * Read one string or template literal, starting at its opening quote.
 *
 * Written as a scanner rather than matched with a pattern, because template
 * literals nest and a character class cannot see that. The path
 *
 *   `/api/cashbox/transactions${date ? `?date=${date}` : ''}`
 *
 * contains a backtick *inside* its own interpolation, so `[^`'"]*` stops
 * there and yields the truncated `/api/cashbox/transactions${date ? `. That
 * then normalises to `/api/cashbox/transactions:param` — a route nobody has,
 * reported against a call that was perfectly fine.
 *
 * Returns null at an unterminated literal rather than guessing.
 */
function readLiteral(text: string, openQuote: number): string | null {
  const quote = text[openQuote];
  let depth = 0;
  for (let i = openQuote + 1; i < text.length; i += 1) {
    const c = text[i];
    if (c === '\\') { i += 1; continue; }
    if (quote === '`' && c === '$' && text[i + 1] === '{') { depth += 1; i += 1; continue; }
    if (depth > 0) {
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      continue;
    }
    if (c === quote) return text.slice(openQuote + 1, i);
    // A newline inside a plain quoted string means we have lost the plot.
    if (quote !== '`' && c === '\n') return null;
  }
  return null;
}

function callSites(): CallSite[] {
  const found: CallSite[] = [];
  // Finds the call and its opening quote; the literal itself is read above.
  const re = /\bapi\s*\.\s*(get|post|put|patch|delete)\s*(?:<[^>]*>)?\s*\(\s*(['"`])/g;
  for (const file of sourceFiles(FRONTEND)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(re)) {
      const quoteAt = m.index + m[0].length - 1;
      const raw = readLiteral(text, quoteAt);
      if (raw === null) continue;
      // Only absolute API paths. One built from a variable cannot be checked
      // from the source at all, and is skipped rather than guessed at.
      if (!raw.startsWith('/')) continue;
      found.push({
        method: m[1].toUpperCase(),
        path: normalise(raw),
        file: file.slice(file.indexOf('frontend')),
        line: text.slice(0, m.index).split('\n').length,
      });
    }
  }
  return found;
}

/* --------------------------------------------------------- the server --- */

/** `GET /api/rooms/:id` → the same shape a call site normalises to. */
function serverRoutes(list: string[]): Set<string> {
  const set = new Set<string>();
  for (const entry of list) {
    const [method, path] = entry.split(' ');
    if (!method || !path) continue;
    set.add(`${method} ${path.replace(/:[^/]+/g, ':param').replace(/\/+$/, '')}`);
  }
  return set;
}

async function main() {
  process.stdout.write(`\nAPI contract\n${'─'.repeat(12)}\n${API}\n`);

  let routes: string[];
  try {
    routes = await (await fetch(`${API}/routes`)).json() as string[];
  } catch (e) {
    process.stderr.write(
      `\nCould not read the route table from ${API}.\n`
      + 'Start the API first: npm start\n');
    throw e;
  }

  const server = serverRoutes(routes);
  const sites = callSites();

  section('1 · Both lists were actually found');
  check('the server published its routes', routes.length > 50, routes.length);
  check('the front end has API call sites', sites.length > 50, sites.length);

  section('2 · Every path the front end calls exists on the server');
  const unique = new Map<string, CallSite>();
  for (const s of sites) unique.set(`${s.method} ${s.path}`, s);

  /*
   * Anything not in the route table is *probed* before it is called missing.
   *
   * Two things live outside the table and are perfectly real: `/health`, which
   * `index.ts` answers before the router is consulted, and anything a future
   * change handles the same way. Keeping a hand-written exception list for
   * those rots — so the check asks the server instead.
   *
   * Probed without a token on purpose. A 401 proves the route exists just as
   * well as a 200 does, and proves it without touching any data. Only a 404
   * means nothing is there. GET only: probing a POST would be a side effect,
   * and those are compared against the table alone.
   */
  const missing: CallSite[] = [];
  for (const [key, site] of unique) {
    if (server.has(key)) continue;
    if (site.method === 'GET') {
      try {
        const probe = await fetch(`${API}${site.path.replace(/:param/g, 'probe')}`);
        if (probe.status !== 404) continue;
      } catch {
        // Unreachable is not the same as absent; fall through and report it.
      }
    }
    missing.push(site);
  }

  process.stdout.write(`  ${unique.size} distinct calls checked against ${server.size} routes\n`);
  check('none of them is missing', missing.length === 0);
  for (const m of missing) {
    process.stdout.write(
      `      ${m.method} ${m.path}\n`
      + `        called from ${m.file}:${m.line} — no such route on the server\n`);
  }

  section('3 · The screens that broke before');
  // Named explicitly as well as covered by the sweep above, so a regression
  // here says which feature died rather than only that a count changed.
  for (const [label, key] of [
    ['Invoice branding reads', 'GET /api/config/invoice-branding'],
    ['Invoice branding saves', 'PUT /api/config/invoice-branding'],
    ['An invoice can be viewed and printed', 'GET /api/invoices/:param/document'],
    ['The booking page has a link to show', 'GET /api/booking-engine/link'],
    ['The channel connection can be diagnosed', 'GET /api/channels/:param/diagnosis'],
  ] as const) {
    check(label, server.has(key), key);
  }

  process.stdout.write(`\n${checks - failures}/${checks} contract checks passed\n`);
  if (failures) {
    process.stdout.write(
      '\nA screen calling a route that does not exist shows "Not found" and does\n'
      + 'nothing. Either write the route, or remove the screen.\n');
    process.exitCode = 1;
    return;
  }
  process.stdout.write('Every screen has a server behind it.\n');
}

try {
  await main();
} catch (e) {
  process.stderr.write(`\nAborted: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
}
