/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

/**
 * The environment variables this app reads.
 *
 * Declaring them turns `import.meta.env.VITE_API_URL` into a typed property
 * and retires the `(import.meta as any).env?.…` casts that were needed before.
 * The cast was not just untidy — it meant a misspelled variable name was a
 * valid expression that evaluated to `undefined`, so the fallback beside it ran
 * and nothing anywhere said why.
 *
 * Every value here is compiled into the bundle and readable by anyone who opens
 * the page. Nothing secret goes in this list; there is no such thing as a
 * private value in a browser build.
 *
 * Adding one? Add it here, add it to src/config.ts, and add it to
 * .env.example — the Vite plugin in vite.config.ts checks the last of those.
 */
interface ImportMetaEnv {
  /** Base URL of the Helio API. Required for a production build. */
  readonly VITE_API_URL?: string;
  /** Display name for the distribution partner. */
  readonly VITE_CHANNEL_HUB_NAME?: string;
  /** Short form of the same, for field labels. */
  readonly VITE_CHANNEL_HUB_SHORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
