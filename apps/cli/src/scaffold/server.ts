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
mkdirSync(path.join(PROJECT_ROOT, '.plitzi'), { recursive: true });
writeFileSync(
  path.join(PROJECT_ROOT, '.plitzi/dev-server.json'),
  \`\${JSON.stringify({ name: SERVER_NAME, port: PORT, url: \`http://127.0.0.1:\${PORT}\` }, null, 2)}\\n\`
);
console.log(\`pages on http://127.0.0.1:\${PORT}/\`);`;

const localMain = (): string => `import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  closeOnSignals,
  consoleLogger,
  createJsonAdapters,
  createServer,
  freePort,
  loadFunctions
} from '@plitzi/sdk-server';

import { authorSpace } from '@plitzi/sdk-authoring';

import { declarations } from './plugins/declarations.ts';
import { space } from './space.ts';

${PORT_SNIPPET}

/**
 * The space, held in this project.
 *
 * \`authorSpace\` turns the declaration in \`src/space.ts\` into the two documents a renderer wants. It runs at
 * boot, so saving that file and letting \`--watch\` restart it is the whole edit loop — and its warnings are printed
 * here for the same reason: this restart is the output somebody editing the space is actually watching.
 */
// \`declarations\`: what the project's plugins fire, answer and read, so the space's use of them is checked too.
const { schema, style, warnings } = authorSpace(space, { plugins: declarations });
const offlineData = { schema, style };

for (const warning of warnings) {
  console.warn(\`[author] \${warning.message}\`);
}

${PLUGINS}

/**
 * This project's own server code: \`functions/\` — what \`plitzi functions pull\` writes and \`push\` sends — built
 * the way Plitzi builds a space's and run here, in this process. Nothing there, no functions; code that does not build
 * stops the server with the file and line.
 */
const functions = await loadFunctions(new URL('../functions/', import.meta.url));

/**
 * Where the server gets a space from, and the only line that knows.
 *
 * \`createJsonAdapters\` is the file-backed shortcut: hand it a \`{ schema, style }\` and it answers every read a
 * page server makes. A real deployment swaps this for adapters onto its own database, or for
 * \`createCloudAdapters\` to read the live space out of Plitzi — the server never learns the difference.
 */
// What \`/health\` answers with, and \`.plitzi/dev-server.json\` records: how a tool knows it reached THIS project.
const SERVER_NAME = schema.definition.permanentUrl;
const server = createServer({
  port: PORT,
  devMode: process.env.NODE_ENV !== 'production',
  health: { name: SERVER_NAME },
  adapters: createJsonAdapters({
    offlineData,
    deployment: { spaceId: 1, environment: 'main', revision: 0, pluginNames }
  }),
  plugins,
  // \`public/\` served as it is: the data an apiContainer reads (\`/data/home.json\`), images, a favicon.
  publicDir: path.join(PROJECT_ROOT, 'public'),
  functions: { native: functions },
  // What went wrong and nothing else: \`npm start -- --verbose\` adds a line for every request.
  logLevel: process.argv.includes('--verbose') ? 'info' : 'warn',
  logger: consoleLogger
});

${LISTEN_SNIPPET}

/**
 * A deploy, a restart or ^C closes the server instead of dropping it: requests in flight are answered, and once the
 * space runs scheduled actions, the jobs this server is running finish first — what is still waiting stays in the
 * queue for whichever server runs next. A second ^C exits at once.
 */
closeOnSignals(server);
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
// What \`/health\` answers with, and \`.plitzi/dev-server.json\` records: how a tool knows it reached THIS project.
const SERVER_NAME = ${JSON.stringify(name)};
const server = createServer({
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
  // What went wrong and nothing else: \`npm start -- --verbose\` adds a line for every request.
  logLevel: process.argv.includes('--verbose') ? 'info' : 'warn',
  logger: consoleLogger
});

${LISTEN_SNIPPET}

/**
 * A deploy, a restart or ^C closes the server instead of dropping it: requests in flight are answered, and once the
 * space runs scheduled actions, the jobs this server is running finish first — what is still waiting stays in the
 * queue for whichever server runs next. A second ^C exits at once.
 */
closeOnSignals(server);
`;

export const serverFiles = (answers: CreateAnswers): ProjectFiles => ({
  'src/main.ts': answers.source === 'cloud' ? cloudMain(answers.name) : localMain(),
  // Where data with no backend goes — `public/data/*.json`, read by an apiContainer — served by `publicDir`.
  'public/data/.gitkeep': ''
});
