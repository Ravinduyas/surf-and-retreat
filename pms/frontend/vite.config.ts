import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

/**
 * Refuses to build a bundle that is missing configuration it needs.
 *
 * The runtime check in `src/config.ts` can only complain into a console that
 * nobody is watching — by then the bundle is built and deployed. This runs
 * while `npm run build` is still going and fails it, which is the only point
 * where a missing API address is cheap to fix.
 *
 * Deliberately quiet in `serve`: `npm run dev` has a working localhost default
 * and should start on a fresh clone with no setup at all.
 */
function validateEnv(env: Record<string, string>, mode: string): Plugin {
  return {
    name: 'helio-validate-env',
    apply: 'build',
    config() {
      const problems: string[] = [];

      const api = env.VITE_API_URL?.trim();
      if (!api) {
        problems.push(
          'VITE_API_URL is not set. A build has no safe default for it — the app '
          + 'would have no API to talk to.\n'
          + `      Set it in .env.${mode}, or in the hosting platform's environment.`,
        );
      } else {
        let url: URL | null = null;
        try { url = new URL(api); } catch { /* reported below */ }
        if (!url) {
          problems.push(`VITE_API_URL is not a valid URL: ${JSON.stringify(api)}`);
        } else if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          problems.push(`VITE_API_URL must be http or https, not ${url.protocol}`);
        } else if (
          mode === 'production'
          && /localhost|127\.0\.0\.1/.test(url.hostname)
          && env.VITE_LOCAL_INSTALL?.trim() !== 'true'
        ) {
          // Catches the build that was run on a laptop with a .env.local still
          // in place. The bundle would look fine and reach nothing.
          //
          // A single-machine installation is the one case where localhost is
          // correct rather than a mistake — the API, the app and the browser
          // are all the same computer. That case has to say so out loud with
          // VITE_LOCAL_INSTALL=true, which keeps it a deliberate choice rather
          // than an oversight that quietly builds anyway.
          problems.push(
            `VITE_API_URL points at ${url.hostname} in a production build. `
            + 'The deployed app would try to reach the browser\'s own machine.\n'
            + '      If this really is a single-machine installation, set '
            + 'VITE_LOCAL_INSTALL=true in .env.production.',
          );
        }
      }

      // Nothing secret can survive a browser build, so a variable that looks
      // like a credential is either a misunderstanding or a leak. Either way it
      // should not reach a bundle unnoticed.
      for (const key of Object.keys(env)) {
        if (!key.startsWith('VITE_')) continue;
        if (/SECRET|PASSWORD|PRIVATE|_KEY$|TOKEN/i.test(key)) {
          problems.push(
            `${key} looks like a credential, and every VITE_ variable is compiled `
            + 'into the bundle in readable form.\n'
            + '      Move it to the API, or rename it if it genuinely is not secret.',
          );
        }
      }

      if (problems.length) {
        throw new Error(
          `\n\nCannot build: the front-end configuration is incomplete (mode: ${mode}).\n\n`
          + problems.map((p) => `  ✗ ${p}`).join('\n\n')
          + '\n\nEvery variable is documented in frontend/.env.example.\n',
        );
      }
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      validateEnv(env, mode),
      react(),
      tailwindcss(),
      VitePWA({
        // Offered, not forced. `autoUpdate` reloads the page as soon as a new
        // build lands, which for an all-day tool means a receptionist loses a
        // half-typed booking to a deploy. The update toast asks instead.
        registerType: 'prompt',
        injectRegister: 'auto',
        includeAssets: ['favicon.ico', 'robots.txt'],
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // A hash-routed SPA: every route is index.html. Without this the app
          // opens offline only at the exact URL that was cached, so a shortcut
          // to /#/housekeeping showed the browser's dinosaur.
          navigateFallback: 'index.html',
          // The bundle is ~1.5 MB; the default 2 MB limit silently drops files
          // over it, which produces an app that installs and then fails to boot.
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          // A tab left open overnight must not keep serving last night's build
          // after a deploy.
          cleanupOutdatedCaches: true,
          // Cache strategies aligned with the spec (Part 2.10):
          //  - Network-first for API/data-like requests so live PMS data is fresh.
          //  - Stale-while-revalidate for fonts/static.
          //  - Cache-first for icons/images.
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'google-fonts-stylesheets' },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              urlPattern: /^https:\/\/i\.pravatar\.cc\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'avatar-cache',
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
        manifest: {
          name: 'helio.pms — Property Management Suite',
          short_name: 'helio.pms',
          description: 'Property management for hotels & hostels — reservations, front office, cashier, housekeeping, night audit, and Beds24 channel manager.',
          theme_color: '#FCDD06',
          background_color: '#F8F8F6',
          display: 'standalone',
          orientation: 'any',
          scope: '/',
          start_url: '/',
          lang: 'en',
          categories: ['business', 'productivity'],
          icons: [
            { src: '/pwa-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
            { src: '/pwa-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
            { src: '/pwa-maskable.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
          ],
          // The three jobs done away from a desk, on a phone, often on the worst
          // wifi in the building. Cashier and the channel manager are desk work
          // and need a connection anyway, so they are not shortcuts.
          shortcuts: [
            { name: 'Arrivals', short_name: 'Arrivals', url: '/#/arrivals', description: 'Today\'s arrivals' },
            { name: 'In-house', short_name: 'In-house', url: '/#/in-house', description: 'Guests staying tonight' },
            { name: 'Housekeeping', short_name: 'Rooms', url: '/#/housekeeping', description: 'Room status and tasks' },
            { name: 'Calendar', short_name: 'Calendar', url: '/#/calendar', description: 'Open the calendar' },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          /**
           * Keep the big third-party libraries in chunks of their own.
           *
           * Screens are already split by `lazy()` in App.tsx, but without this
           * a library used by two screens is duplicated into both, and — worse
           * for an installed PWA — React and friends land in the same chunk as
           * application code, so editing one screen makes every client
           * re-download the framework too.
           *
           * Grouped rather than one-chunk-per-package on purpose: a hundred
           * tiny requests is its own problem, and these four move at completely
           * different rates. React changes twice a year, the app changes daily.
           */
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            // react-dom pulls react in; keeping them together avoids a chunk
            // that cannot initialise until a sibling has already run.
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
            // Only Dashboard and Reports use it, and it is the single largest
            // dependency here.
            if (id.includes('recharts') || id.includes('d3-')) return 'charts';
            if (id.includes('motion') || id.includes('framer')) return 'motion';
            if (id.includes('i18next')) return 'i18n';
            return 'vendor';
          },
        },
      },
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
