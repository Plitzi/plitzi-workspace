import { DEV_SERVER_FILE, DEV_SPACE_FILE, KV_FILE, PROJECT_TMP } from './paths';

import type { CreateAnswers, ProjectFiles } from './types';

/**
 * The server-mode entry point: a page server of this project's own.
 *
 * Where the space comes from is one argument — the adapters — and nothing else in the file changes with it. That
 * is the whole shape of `@plitzi/sdk-server`, and the generated project shows it rather than describing it.
 */

/** Written into both entry points, because how a plugin is registered does not change with where the space lives. */
export const PLUGINS = `/**
 * The project's own components: every folder of \`src/plugins\` is one, registered under its name in camelCase —
 * \`src/plugins/StatCard\` is what a space's \`custom({ renderType: 'statCard' })\` renders. \`plitzi add plugin\` writes
 * a new one there; the next start registers it.
 *
 * \`action: 'compile'\` is what makes them SERVER-rendered. The server builds the entry with esbuild, keeps React
 * external so the plugin runs on the one copy this page already has, serves the bundle to the browser AND imports
 * it into the render — so the component's markup is in the HTML before any JavaScript arrives. See
 * \`src/plugins/README.md\`.
 */
// From the project root, so the path holds whether this file runs as \`src/main.ts\` or compiled as \`dist/main.js\`.
const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const PLUGINS_DIR = path.join(PROJECT_ROOT, 'src/plugins');

const plugins = Object.fromEntries(
  readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => [
      \`\${entry.name.charAt(0).toLowerCase()}\${entry.name.slice(1)}\`,
      { js: path.join(PLUGINS_DIR, entry.name, 'index.ts'), action: 'compile' as const, version: '1.0.0' }
    ])
);

/**
 * Registering a plugin is not the same as turning it on.
 *
 * The map above says a plugin EXISTS and how to build it; the deployment says which ones this space renders with,
 * because a server can host many spaces and not all of them want the same components built and shipped. Nothing
 * hands the server that list on its own — leave it out and the page renders "Custom Component … Not Found" with
 * no error anywhere, which is a long afternoon.
 */
const pluginNames = Object.keys(plugins);`;

/**
 * Which port the server takes. `PORT` set: that one, and a clear error if something else has it. Not set, while
 * developing: 8080, or the next free one — so a second project, or anything else on 8080, does not stop this one.
 */
const PORT_SNIPPET = `// Loopback unless told otherwise: a container publishes a port only from an address it listens on (\`HOST=0.0.0.0\`).
const HOST = process.env.HOST ?? '127.0.0.1';
// \`PORT\` set: that port. Not set, while developing: 8080 or the next free one, written down below for the scripts.
const PORT = process.env.PORT
  ? Number(process.env.PORT)
  : process.env.NODE_ENV === 'production'
    ? 8080
    : await freePort(8080, HOST);`;

/** Where the server says it is: the port it took, for `npm run shot` and the visual tests to find. */
const LISTEN_SNIPPET = `server.listen(PORT, HOST);
mkdirSync(path.join(PROJECT_ROOT, '${PROJECT_TMP}'), { recursive: true });
writeFileSync(
  path.join(PROJECT_ROOT, '${DEV_SERVER_FILE}'),
  \`\${JSON.stringify({ name: SERVER_NAME, port: PORT, url: \`http://127.0.0.1:\${PORT}\` }, null, 2)}\\n\`
);
console.log(\`pages on http://127.0.0.1:\${PORT}/\`);`;

const localMain = (): string => `import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, watch, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  closeOnSignals,
  consoleLogger,
  createJsonAdapters,
  createServer,
  freePort,
  loadFunctions
} from '@plitzi/sdk-server';
import { createFileKv } from '@plitzi/sdk-server/actions';

import { authorSpace } from '@plitzi/sdk-authoring';
import { publicData } from '@plitzi/sdk-authoring/node';

import { actions } from './actions.ts';
import { declarations } from './plugins/declarations.ts';
import { serverOptions } from './serverOptions.ts';
import { space } from './space.ts';

import type { ActionLookups } from '@plitzi/sdk-server/actions';

${PORT_SNIPPET}

/**
 * The space, held in this project.
 *
 * \`authorSpace\` turns the declaration in \`src/space.ts\` into the two documents a renderer wants. It runs at
 * boot, so saving that file and letting \`--watch\` restart it is the whole edit loop — and its warnings are printed
 * here for the same reason: this restart is the output somebody editing the space is actually watching.
 */
// \`declarations\`: what the project's plugins fire, answer and read, so the space's use of them is checked too.
// \`data\`: the files of \`public/\` a provider reads, so a binding onto a path one of them does not have is warned.
const { schema, style, warnings } = authorSpace(space, {
  plugins: declarations,
  data: publicData(new URL('../public/', import.meta.url))
});
const offlineData = { schema, style };

for (const warning of warnings) {
  console.warn(\`[author] \${warning.message}\`);
}

${PLUGINS}

/**
 * While developing, the documents are served from \`${DEV_SPACE_FILE}\`, which the server reads again whenever it changes —
 * so a save is re-authored into it and shown without restarting anything (see \`watchSpace\` below). A by-product, in
 * \`tmp/\` with everything else the project writes for itself: the space is \`src/space.ts\`. A deployment keeps the
 * documents in memory, as authored at boot.
 */
const DEVELOPING = process.env.NODE_ENV !== 'production';
const OFFLINE_DATA = path.join(PROJECT_ROOT, '${DEV_SPACE_FILE}');
if (DEVELOPING) {
  mkdirSync(path.dirname(OFFLINE_DATA), { recursive: true });
  writeFileSync(OFFLINE_DATA, \`\${JSON.stringify(offlineData, null, 2)}\\n\`);
}

/**
 * This project's own server code: \`functions/\` — what \`plitzi functions pull\` writes and \`push\` sends — built
 * the way Plitzi builds a space's and run here, in this process. Nothing there, no functions; code that does not build
 * stops the server with the file and line.
 */
const functions = await loadFunctions(new URL('../functions/', import.meta.url));

/**
 * The space's server actions — \`src/actions.ts\` — found by their id; and the one space this server serves, which is the
 * one it runs the actions on a clock for.
 */
const SPACE_ID = 1;
const actionLookups: ActionLookups = {
  getAction: (_spaceId, actionId) => Promise.resolve(actions.find(entry => entry.id === actionId)),
  listActions: () => Promise.resolve(actions),
  listScheduledSpaces: () => Promise.resolve([SPACE_ID])
};

/**
 * Where the server gets a space from, and the only line that knows.
 *
 * \`createJsonAdapters\` is the file-backed shortcut: hand it a \`{ schema, style }\` and it answers every read a
 * page server makes. A real deployment swaps this for adapters onto its own database, or for
 * \`createCloudAdapters\` to read the live space out of Plitzi — the server never learns the difference.
 */
// What \`/health\` answers with, and \`${DEV_SERVER_FILE}\` records: how a tool knows it reached THIS project.
const SERVER_NAME = schema.definition.permanentUrl;
const server = createServer({
  // What went wrong and nothing else: \`npm start -- --verbose\` adds a line for every request.
  logLevel: process.argv.includes('--verbose') ? 'info' : 'warn',
  logger: consoleLogger,
  // What the server does besides serving the space — \`src/serverOptions.ts\`, the project's own. What follows is this
  // file's, and comes after it: the space, its plugins, its files and its code are wired here.
  ...serverOptions,
  port: PORT,
  devMode: process.env.NODE_ENV !== 'production',
  // A save to the space re-authors it and the open pages load again (\`watchSpace\` below).
  devReload: DEVELOPING,
  health: { name: SERVER_NAME },
  adapters: createJsonAdapters({
    offlineData: DEVELOPING ? OFFLINE_DATA : offlineData,
    deployment: { spaceId: SPACE_ID, environment: 'main', revision: 0, pluginNames }
  }),
  plugins,
  // \`public/\` served as it is: the data an apiContainer reads (\`/data/home.json\`), images, a favicon.
  publicDir: path.join(PROJECT_ROOT, 'public'),
  functions: { native: functions },
  // What the space's actions keep in \`kv\`, in \`${KV_FILE}\`: it outlives a restart, \`start:dev\`'s included. A
  // deployment with several processes, or a database, names its own store in \`src/serverOptions.ts\` (\`action.kv\`).
  action: {
    kv: createFileKv({ file: path.join(PROJECT_ROOT, '${KV_FILE}') }),
    ...serverOptions.action,
    lookups: actionLookups
  }
});

${LISTEN_SNIPPET}

/**
 * A deploy, a restart or ^C closes the server instead of dropping it: requests in flight are answered, and once the
 * space runs scheduled actions, the jobs this server is running finish first — what is still waiting stays in the
 * queue for whichever server runs next. A second ^C exits at once.
 */
closeOnSignals(server);

/**
 * A save to the space, while developing: re-authored by \`src/author.ts\` in a process of its own — the only way to
 * read every file of it again, which an import never does twice — and every open page loads again once it wrote the
 * new documents. What it refuses is printed and the page keeps the last space that authored. A change to the server's
 * own code — this file, the server options, the actions, a plugin — restarts the server instead (\`start:dev\` watches
 * those).
 */
const RESTARTS = ['main.ts', 'serverOptions.ts', 'actions.ts', 'plugins'];
const watchSpace = (): void => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let authoring = false;
  let again = false;
  const author = (): void => {
    if (authoring) {
      again = true;

      return;
    }

    authoring = true;
    const child = spawn(process.execPath, [path.join(PROJECT_ROOT, 'src/author.ts'), '--out', OFFLINE_DATA], {
      cwd: PROJECT_ROOT,
      stdio: 'inherit'
    });
    child.on('close', code => {
      authoring = false;
      if (code === 0) {
        server.reloadPages();
      }

      if (again) {
        again = false;
        author();
      }
    });
  };

  watch(path.join(PROJECT_ROOT, 'src'), { recursive: true }, (_event, file) => {
    if (!file || RESTARTS.some(name => file === name || file.startsWith(\`\${name}\${path.sep}\`))) {
      return;
    }

    clearTimeout(timer);
    timer = setTimeout(author, 100);
  });
};

if (DEVELOPING) {
  watchSpace();
}
`;

const cloudMain = (name: string): string => `import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  closeOnSignals,
  consoleLogger,
  createCloudAdapters,
  createServer,
  freePort,
  loadFunctions
} from '@plitzi/sdk-server';

import { serverOptions } from './serverOptions.ts';

${PORT_SNIPPET}

${PLUGINS}

/**
 * The space's HOST key — not the public one a published page embeds.
 *
 * They are different credentials on purpose. The public \`render\` key is readable by anyone who views source on
 * the published site, and what keeps a copied one from working is that a browser is made to state the origin it
 * is presenting from. A server has no such statement to make, so it gets a key whose protection is that it is
 * secret: issued once, never committed, never shipped in a page, and revocable on its own.
 */
const HOST_KEY = process.env.PLITZI_HOST_KEY ?? '';

if (!HOST_KEY) {
  throw new Error('Set PLITZI_HOST_KEY in .env — Credentials, in the builder.');
}

/**
 * This project's own server code: \`functions/\` — what \`plitzi functions pull\` writes and \`push\` sends — built
 * the way Plitzi builds a space's and run here, in this process. Nothing there, no functions; code that does not build
 * stops the server with the file and line.
 */
const functions = await loadFunctions(new URL('../functions/', import.meta.url));

/**
 * The space stays in Plitzi; the SERVER is this one.
 *
 * The live document is read over the same query the browser-rendered SDK uses, so the space keeps being edited,
 * published and versioned in the builder while every request is served from here — under this deployment's own
 * domain, auth, actions and logs.
 *
 * \`environment\` is the decision worth being deliberate about: \`main\` is what the builder is editing, read live
 * on every request; a published environment with no \`revision\` serves the latest and releases itself; with a
 * \`revision\` it serves exactly that version, for a deployment that rolls forward on its own schedule.
 */
// What \`/health\` answers with, and \`${DEV_SERVER_FILE}\` records: how a tool knows it reached THIS project.
const SERVER_NAME = ${JSON.stringify(name)};
const server = createServer({
  // What went wrong and nothing else: \`npm start -- --verbose\` adds a line for every request.
  logLevel: process.argv.includes('--verbose') ? 'info' : 'warn',
  logger: consoleLogger,
  // What the server does besides serving the space — \`src/serverOptions.ts\`, the project's own. What follows is this
  // file's, and comes after it: the space, its plugins, its files and its code are wired here.
  ...serverOptions,
  port: PORT,
  devMode: process.env.NODE_ENV !== 'production',
  health: { name: SERVER_NAME },
  adapters: createCloudAdapters({
    webKey: HOST_KEY,
    ...(process.env.PLITZI_SERVER_URL ? { serverUrl: process.env.PLITZI_SERVER_URL } : {}),
    environment: (process.env.PLITZI_ENVIRONMENT ?? 'main') as 'main' | 'production',
    ...(process.env.PLITZI_REVISION ? { revision: Number(process.env.PLITZI_REVISION) } : {}),
    deployment: { pluginNames }
  }),
  plugins,
  // \`public/\` served as it is: the data an apiContainer reads (\`/data/home.json\`), images, a favicon.
  publicDir: path.join(PROJECT_ROOT, 'public'),
  functions: { native: functions },
  action: serverOptions.action
});

${LISTEN_SNIPPET}

/**
 * A deploy, a restart or ^C closes the server instead of dropping it: requests in flight are answered, and once the
 * space runs scheduled actions, the jobs this server is running finish first — what is still waiting stays in the
 * queue for whichever server runs next. A second ^C exits at once.
 */
closeOnSignals(server);
`;

/**
 * What the project's server does besides serving the space, in a file of the project's own: `src/main.ts` is the CLI's
 * — `plitzi upgrade` keeps it current — and a server that needed its images, its actions' limits or its `kv` had to edit
 * it, and port the edit by hand at every upgrade.
 */
/** What a local project's server options say about its actions — the server runs them itself. */
const ACTION_OPTIONS_DOC = ` * - \`action: { limits: { maxRequests, timeoutMs } }\` — a server action reading many sources: 20 requests and 10 s a
 *   run by default. \`action.kv\` — where \`kv\` keeps what it writes; this process's memory by default.
`;

const serverOptionsModule = (local: boolean): string => `import type { ServerConfig } from '@plitzi/sdk-server';

/** What \`src/main.ts\` sets itself — where the space comes from, its plugins, its files, its code — so not this file's. */
type SetByMain =
  'port' | 'devMode' | 'devReload' | 'health' | 'adapters' | 'plugins' | 'publicDir' | 'functions' | 'action';

/** What \`createServer\` takes but for what \`src/main.ts\` sets — and an action's \`lookups\`: \`src/actions.ts\`. */
type ServerOptions = Partial<Omit<ServerConfig, SetByMain>> & {
  action?: Omit<NonNullable<ServerConfig['action']>, 'lookups'>;
};

/**
 * What this project's server does besides serving the space — yours. \`src/main.ts\` is the CLI's (\`plitzi upgrade\`
 * keeps it current) and hands these to \`createServer\`; what it sets itself is not offered here, and wins if written.
 * The ones a project reaches for:
 *
 * - \`images: { domains: ['images.example.com'] }\` — pictures from those hosts resized here, with \`sharp\` installed.
${local ? ACTION_OPTIONS_DOC : ''} * - \`rsc: { elementTimeoutMs }\` — how long a section resolved on the server is waited for: 5 s by default.
 */
export const serverOptions: ServerOptions = {};
`;

/** The space's server actions, in a file of the project's own that `src/main.ts` hands to the server. */
const actionsModule = (): string => `import type { ActionEntry } from '@plitzi/sdk-authoring';

/**
 * The space's server actions — what a page asks the server to do (\`runServerAction\`), what feeds a provider before the
 * HTML (\`apiContainer({ runtime: 'server', action })\`), what runs on a clock (a \`schedule\` trigger). One
 * \`defineAction({ … })\` from \`@plitzi/sdk-authoring\` each, listed here: \`src/main.ts\` hands them to the server.
 */
export const actions: ActionEntry[] = [];
`;

/** What `functions/` is, in the folder itself — and the folder there from the start, for `start:dev` to watch. */
const FUNCTIONS_README = `# functions/

This project's own server code: the tasks a server action's steps run (\`task: 'namespace.action'\`) and the routes
under \`/fn/\`, from \`functions/index.ts\` — \`export default defineFunctions({ tasks, routes, allow })\` from
\`@plitzi/sdk-server/functions\`. \`src/main.ts\` builds it at boot the way Plitzi builds a space's, and \`start:dev\`
restarts on a change here. Nothing here, no functions.

\`plitzi functions pull\` writes the space's functions here, and \`push\` sends them back.

A file imports its siblings with their extension — \`import { reader } from './sources.ts'\` — as \`src/\` does: the
build reads it either way, and a script or a test then runs the same file under Node, with nothing to bundle.
`;

export const serverFiles = (answers: CreateAnswers): ProjectFiles => ({
  'src/main.ts': answers.source === 'cloud' ? cloudMain(answers.name) : localMain(),
  'functions/README.md': FUNCTIONS_README,
  'src/serverOptions.ts': serverOptionsModule(answers.source !== 'cloud'),
  ...(answers.source === 'cloud' ? {} : { 'src/actions.ts': actionsModule() }),
  // Where data with no backend goes — `public/data/*.json`, read by an apiContainer — served by `publicDir`.
  'public/data/.gitkeep': ''
});
