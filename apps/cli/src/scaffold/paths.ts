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
