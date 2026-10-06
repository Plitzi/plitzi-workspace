/**
 * Where a project the CLI writes keeps each part of it. What the server and the authoring read too is
 * `@plitzi/sdk-shared/project/paths`'s, said there once; what follows is the CLI's alone.
 *
 * `.plitzi/` is the other half of what is not the source: what the CLI records about the project and that travels with
 * it — where it came from (`space.json`), the functions' working copy (`functions.json`), what `create` wrote
 * (`scaffold.json`). Committed.
 */
import { PROJECT_TMP } from '@plitzi/sdk-shared/project/paths';

export {
  AUTHOR_FILE,
  CLI_DIR,
  DATA_DIR,
  DEV_SERVER_FILE,
  FUNCTIONS_DIR,
  KV_FILE,
  PLUGIN_MANIFEST_FILE,
  PLUGINS_DIR,
  PROJECT_STATE,
  PROJECT_TMP,
  PUBLIC_DIR,
  RUNTIME_BUNDLE,
  VENDOR_PLUGINS_DIR
} from '@plitzi/sdk-shared/project/paths';

/**
 * The project's entry point — the page server, or the Vite app — in `src/`, where an entry point is looked for. The
 * CLI's all the same: `plitzi upgrade` keeps it current, and what a project changes goes in `src/config/serverOptions.ts`.
 */
export const MAIN_FILE = 'src/main.ts';

/**
 * What reads `.env` into the process: the first import of the server's entry point, so every module after it — the
 * project's options, its actions — finds its settings in `process.env` when it is evaluated. The CLI's, as is the entry
 * point.
 */
export const ENV_FILE = 'src/env.ts';

/**
 * The space, in a folder of its own — it grows a page, a layout, a component at a time — whose `index.ts` exports it as
 * `space`: what the server, the author script, the visual test and the CLI's checks import.
 */
export const SPACE_DIR = 'src/space';
export const SPACE_ENTRY = `${SPACE_DIR}/index.ts`;

/** The space's runtime — its own server code, run as a process of its own on the platform — a folder like the space. */
export const RUNTIME_DIR = 'src/runtime';
export const RUNTIME_ENTRY = `${RUNTIME_DIR}/index.ts`;

/** The space's server actions, a folder like the space: `index.ts` lists them for the server, one action a file. */
export const ACTIONS_DIR = 'src/actions';
export const ACTIONS_ENTRY = `${ACTIONS_DIR}/index.ts`;

/** What the server does besides serving the space: the project's configuration, never its content. */
export const SERVER_OPTIONS_FILE = 'src/config/serverOptions.ts';

/** What Playwright leaves of a run: traces, failures' pictures. */
export const VISUAL_OUTPUT = `${PROJECT_TMP}/visual`;
