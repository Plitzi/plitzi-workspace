/**
 * Where a project the CLI writes keeps each part of it. What the server and the authoring read too is
 * `@plitzi/sdk-shared/project/paths`'s, said there once; what follows is the CLI's alone.
 *
 * `.plitzi/` is the other half of what is not the source: what the CLI records about the project and that travels with
 * it — where it came from (`space.json`), the functions' working copy (`functions.json`), what `create` wrote
 * (`scaffold.json`). Committed.
 */
import { CLI_DIR, PROJECT_TMP } from '@plitzi/sdk-shared/project/paths';

export {
  AUTHOR_FILE,
  BUILD_DIR,
  CLI_DIR,
  DATA_DIR,
  DEV_SERVER_FILE,
  FUNCTIONS_DIR,
  KV_FILE,
  PLUGIN_DECLARATION_FILE,
  PLUGIN_ENTRIES,
  PLUGIN_FUNCTIONS_DIR,
  PLUGIN_MANIFEST_FILE,
  PLUGINS_DIR,
  PROJECT_STATE,
  PROJECT_TMP,
  PUBLIC_DIR,
  RUNTIME_BUNDLE,
  RUNTIME_DIR,
  RUNTIME_ENTRY,
  SPACE_DIR,
  SPACE_ENTRY,
  VENDOR_PLUGINS_DIR
} from '@plitzi/sdk-shared/project/paths';

/**
 * The project's entry point — the page server, or the Vite app — in `src/`, where an entry point is looked for. The
 * CLI's all the same: `plitzi upgrade` keeps it current, and what a project changes goes in `src/config/serverOptions.ts`.
 */
export const MAIN_FILE = 'src/main.ts';

/**
 * The project's own notes for agents — how it is built, what must not be undone — which `CLAUDE.md` and `AGENTS.md`,
 * both the CLI's, point at. The project's: `plitzi upgrade` never touches it.
 */
export const PROJECT_NOTES = 'NOTES.md';

/** The compiler options the CLI keeps up, which the project's own `tsconfig.json` extends. */
export const TSCONFIG_BASE = `${CLI_DIR}/tsconfig.base.json`;

/** The space's server actions, a folder like the space: `index.ts` lists them for the server, one action a file. */
export const ACTIONS_DIR = 'src/actions';
export const ACTIONS_ENTRY = `${ACTIONS_DIR}/index.ts`;

/** What the server does besides serving the space: the project's configuration, never its content. */
export const SERVER_OPTIONS_FILE = 'src/config/serverOptions.ts';

/** What Playwright leaves of a run: traces, failures' pictures. */
export const VISUAL_OUTPUT = `${PROJECT_TMP}/visual`;

/**
 * The certificate `plitzi cert` makes for this machine as its network reaches it, and its key — `TLS_CERT` and `TLS_KEY`
 * in `.env`. In `tmp/`: made again on each machine, and a key never committed.
 */
export const TLS_CERT_FILE = `${PROJECT_TMP}/tls/cert.pem`;
export const TLS_KEY_FILE = `${PROJECT_TMP}/tls/key.pem`;
