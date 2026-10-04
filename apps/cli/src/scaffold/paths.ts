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

/** The port `npm start` took and the name its `/health` answers with: what `check`, `shot` and `visual` find it by. */
export const DEV_SERVER_FILE = `${PROJECT_TMP}/dev-server.json`;

/** The space as last authored while developing, re-read by the server on every change: never the source of it. */
export const DEV_SPACE_FILE = `${PROJECT_TMP}/space.json`;

/** What Playwright leaves of a run: traces, failures' pictures. */
export const VISUAL_OUTPUT = `${PROJECT_TMP}/visual`;
