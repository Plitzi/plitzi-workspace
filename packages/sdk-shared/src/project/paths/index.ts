/**
 * The layout of a project `@plitzi/cli` writes, relative to its root — names alone, nothing of Node, so a browser imports
 * them too (`@plitzi/sdk-shared/project/paths`; the folder above it is Node only): the one place the CLI that writes and checks it,
 * the server that serves it (`@plitzi/sdk-server/project`) and the authoring that checks its space
 * (`@plitzi/sdk-authoring/node`'s `projectAuthoring`) read it from.
 *
 * `tmp/` is what the project writes for itself, never committed, everything in it rebuilt when it is missing — the
 * server's plugin bundles (`tmp/.sdk-plugins`) and resized pictures (`tmp/images`), both `@plitzi/sdk-server`'s
 * defaults, beside what the files below name. One folder, so a reader of the project — a person, an agent — knows at a
 * glance what is the project and what is a by-product of running it.
 */
export const PROJECT_TMP = 'tmp';

/**
 * Where `plitzi run` keeps a run of agents: each task's copy of the project lives below it. A copy holds no
 * `.env` on purpose — an agent never reads credentials — so a check run inside one says nothing of a missing one.
 */
export const RUNS_DIR = `${PROJECT_TMP}/plitzi-runs`;

/**
 * The project's one open run, named (`{ runId, since, by }`): created when a run opens, gone with it. What the project's
 * own server reads to say, while developing, that it serves the project as it is and not the agents' work.
 */
export const ACTIVE_RUN_FILE = `${RUNS_DIR}/active.json`;

/** The project's own code — its space, plugins, data, functions and server — which the server watches while developing. */
export const SOURCE_DIR = 'src';

/**
 * The CLI's own part of a project — the script that authors the space, the types its plugins import besides code, the
 * page's base styles — beside what it records (`scaffold.json`, `space.json`, `team.json`), in one folder: apart from
 * `src/`, which is the project's. `plitzi upgrade` keeps it current, and a person reads `src/` without wading through it.
 */
export const CLI_DIR = '.plitzi';

/** Where an older CLI kept its part of the project: `plitzi doctor --fix` moves it into `CLI_DIR`. */
export const LEGACY_CLI_DIR = 'plitzi';

/**
 * What authors the space and says what it found: `npm run author`, and the server's re-authoring on a save, which runs
 * it in a process of its own and is handed the documents over IPC (`--ipc`).
 */
export const AUTHOR_FILE = `${CLI_DIR}/author.ts`;

/**
 * The space, in a folder of its own — it grows a page, a layout, a component at a time — whose `index.ts` exports it as
 * `space`: what the server's entry point, the author script, the visual test and the CLI's checks import.
 */
export const SPACE_DIR = 'src/space';
export const SPACE_ENTRY = `${SPACE_DIR}/index.ts`;

/**
 * The project's own components: every folder is one, registered under its name in camelCase — `src/plugins/StatCard`
 * renders a space's `statCard` element, placed from its declaration — built from its entry (`PLUGIN_ENTRIES`) and declared by its
 * `declaration.ts`.
 */
export const PLUGINS_DIR = 'src/plugins';

/**
 * What a plugin folder is built from: `index.ts`, or `index.tsx` for one that writes its JSX there — TypeScript both,
 * and one of them, never both.
 */
export const PLUGIN_ENTRIES = ['index.ts', 'index.tsx'] as const;

/** What a plugin folder declares itself in — its type, attributes, triggers — as `plitzi plugin add` writes it. */
export const PLUGIN_DECLARATION_FILE = 'declaration.ts';

/** A plugin's server half, a folder of its own beside its component: built from its `index.ts`. */
export const PLUGIN_FUNCTIONS_DIR = 'functions';

/**
 * Plugins no source of was kept, as they were built (a project made from a space): `vendor/plugins/<type>/`, each
 * beside the manifest it was published with (`PLUGIN_MANIFEST_FILE`).
 */
export const VENDOR_PLUGINS_DIR = 'vendor/plugins';

/** What `plitzi plugin pack` writes beside a plugin's bundle: its version, its files, and the elements it provides. */
export const PLUGIN_MANIFEST_FILE = 'plugin-manifest.json';

/** A runtime that came across built only (a project made from a space): run as it was built. */
export const RUNTIME_BUNDLE = 'vendor/runtime.bundle';

/** Served to anyone as it is: pictures, a favicon — every file in it is on the internet once the project is deployed. */
export const PUBLIC_DIR = 'public';

/**
 * The project's own data, server mode: JSON its server reads (`dataDir`) and never serves — a provider asks for
 * `/data/<file>` on the server. A project with no server keeps it in `public/data/`, where the browser fetches it.
 */
export const DATA_DIR = 'src/data';

/**
 * Where a project's own data answers: a provider whose `query` is `/data/<file>` reads `<file>` from the folder the
 * server keeps it in (`dataDir`), which is never served — so only a provider resolved on the server reads it. The
 * server's resolver and the authoring check that refuses a browser read hold the same prefix.
 */
export const PROJECT_DATA_PREFIX = '/data/';

/** The project's own server code — the tasks and `/fn/` routes `defineFunctions` declares — built at boot. */
export const FUNCTIONS_DIR = 'src/functions';

/**
 * The space's runtime — its own server code, run as a process of its own on Plitzi and by the project's server in its
 * process — a folder like the space, whose `index.ts` exports it.
 */
export const RUNTIME_DIR = 'src/runtime';
export const RUNTIME_ENTRY = `${RUNTIME_DIR}/index.ts`;

/**
 * What `npm run build` compiles `src/` into — the server's own code, as JavaScript, for `start:prod` to run with no
 * TypeScript in the process. The same tree: `src/runtime/index.ts` is `dist/runtime/index.js`.
 */
export const BUILD_DIR = 'dist';

/**
 * What the running server keeps for the space — its `kv`: saved layouts, counters, a source's cached answer. Not
 * committed either, but not a by-product: it is the deployment's state, so it is never rebuilt and `tmp/` is no place
 * for it. A deployment that keeps it elsewhere says so in `src/config/serverOptions.ts` (`action.kv`).
 */
export const PROJECT_STATE = 'state';

/** The `kv` a project's server keeps, as one JSON file (`createFileKv`). */
export const KV_FILE = `${PROJECT_STATE}/kv.json`;

/**
 * The job queue a project's server keeps beside its `kv` — what `ctx.later`, the schedules and the functions' jobs wait
 * in — as one JSON file (`createFileJobQueue`): a job due while the server was down runs once it is back.
 */
export const JOBS_FILE = `${PROJECT_STATE}/jobs.json`;

/**
 * What `plitzi functions later` asks the project's running server, and where it answers: the server holds its queue's
 * file, so a run set for later is read and started now through it — a spec of a show waited five real minutes a pass.
 */
export const LATER_ASK_FILE = `${PROJECT_TMP}/later-ask.json`;
export const LATER_ANSWER_FILE = `${PROJECT_TMP}/later-answer.json`;

/** The port the server took and the name its `/health` answers with: what `check`, `shot` and `visual` find it by. */
export const DEV_SERVER_FILE = `${PROJECT_TMP}/dev-server.json`;

/**
 * Where a project's server writes its record instead of \`DEV_SERVER_FILE\`, when this variable says: the visual suite's
 * own server keeps its record apart, so the one a person runs is still what \`check\` and \`shot\` find.
 */
export const SERVER_RECORD_ENV = 'PLITZI_SERVER_RECORD';

/**
 * Where a project's server keeps its \`kv\` instead of \`KV_FILE\`: the visual suite's own server keeps its own state, as
 * it keeps its own record — one file is held by one process, and its server beside a person's open one (or the one
 * the CLI keeps of a run's copy) was refused: encore's Playwright runs crashed on "createFileKv … is in use".
 */
export const KV_FILE_ENV = 'PLITZI_KV_FILE';
