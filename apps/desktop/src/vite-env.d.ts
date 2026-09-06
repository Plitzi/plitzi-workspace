/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Which deployment a build talks to: `development`, `staging` or `production`. See `config/environments`. */
  readonly VITE_PLITZI_DESKTOP_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
