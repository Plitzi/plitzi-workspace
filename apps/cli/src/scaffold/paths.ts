/**
 * Where a project the CLI writes keeps what it writes for itself: `tmp/`, never committed, everything in it rebuilt
 * when it is missing — the server's plugin bundles (`tmp/.sdk-plugins`) and resized pictures (`tmp/images`), both
 * `@plitzi/sdk-server`'s defaults, beside what the files below name. One folder, so a reader of the project — a person,
 * an agent — knows at a glance what is the project and what is a by-product of running it.
 *
 * `.plitzi/` is the other half: what the CLI records about the project and that travels with it — where it came from
 * (`space.json`), the functions' working copy (`functions.json`), what `create` wrote (`scaffold.json`). Committed.
 */

export const PROJECT_TMP = 'tmp';

/**
 * The CLI's own part of a project — the script that authors the space, the types its plugins import besides code, the
 * page's base styles — apart from `src/`, which is the project's: `plitzi upgrade` keeps this folder current, and a
 * person reads `src/` without wading through it.
 */
export const CLI_DIR = 'plitzi';

/**
 * The project's entry point — the page server, or the Vite app — in `src/`, where an entry point is looked for. The
 * CLI's all the same: `plitzi upgrade` keeps it current, and what a project changes goes in `src/serverOptions.ts`.
 */
export const MAIN_FILE = 'src/main.ts';

/** What authors the space and says what it found: `npm run author`, and the server's re-authoring on a save. */
export const AUTHOR_FILE = `${CLI_DIR}/author.ts`;

/**
 * What the running server keeps for the space — its `kv`: saved layouts, counters, a source's cached answer. Not
 * committed either, but not a by-product: it is the deployment's state, so it is never rebuilt and `tmp/` is no place
 * for it. A deployment that keeps it elsewhere says so in `src/serverOptions.ts` (`action.kv`).
 */
export const PROJECT_STATE = 'state';

/** The `kv` a project's server keeps, as one JSON file (`createFileKv`). */
export const KV_FILE = `${PROJECT_STATE}/kv.json`;

/** The project's own server code — the tasks and `/fn/` routes `defineFunctions` declares — built at boot. */
export const FUNCTIONS_DIR = 'src/functions';

/**
 * The project's own data, server mode: JSON its server reads (`dataDir`) and never serves — a provider asks for
 * `/data/<file>` on the server. A project with no server keeps it in `public/data/`, where the browser fetches it.
 */
export const DATA_DIR = 'src/data';

/** The port `npm start` took and the name its `/health` answers with: what `check`, `shot` and `visual` find it by. */
export const DEV_SERVER_FILE = `${PROJECT_TMP}/dev-server.json`;

/** The space as last authored while developing, re-read by the server on every change: never the source of it. */
export const DEV_SPACE_FILE = `${PROJECT_TMP}/space.json`;

/** What Playwright leaves of a run: traces, failures' pictures. */
export const VISUAL_OUTPUT = `${PROJECT_TMP}/visual`;
