/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional. Where the PMS serves live room and add-on prices (see src/pms.ts). */
  readonly VITE_PMS_PRICES_URL?: string;
}
