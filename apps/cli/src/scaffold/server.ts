import type { CreateAnswers, ProjectFiles } from './types';

/**
 * The server-mode entry point: a page server of this project's own.
 *
 * Where the space comes from is one argument — the adapters — and nothing else in the file changes with it. That
 * is the whole shape of `@plitzi/sdk-server`, and the generated project shows it rather than describing it.
 */

/** Written into both entry points, because how a plugin is registered does not change with where the space lives. */
const PLUGINS = `/**
 * The project's own components, by the \`renderType\` the space names them with.
 *
 * \`action: 'compile'\` is what makes them SERVER-rendered. The server builds the entry with esbuild, keeps React
 * external so the plugin runs on the one copy this page already has, serves the bundle to the browser AND imports
 * it into the render — so the component's markup is in the HTML before any JavaScript arrives. Add another by
 * writing it under \`src/plugins\` and adding a line here; see \`src/plugins/README.md\`.
 */
const plugins = {
  statCard: {
    js: path.resolve(import.meta.dirname, 'plugins/StatCard/index.ts'),
    action: 'compile' as const,
    version: '1.0.0'
  }
};

/**
 * Registering a plugin is not the same as turning it on.
 *
 * The map above says a plugin EXISTS and how to build it; the deployment says which ones this space renders with,
 * because a server can host many spaces and not all of them want the same components built and shipped. Nothing
 * hands the server that list on its own — leave it out and the page renders "Custom Component … Not Found" with
 * no error anywhere, which is a long afternoon.
 */
const pluginNames = Object.keys(plugins);`;

const localMain = (): string => `import path from 'node:path';

import { consoleLogger, createJsonAdapters, createServer } from '@plitzi/sdk-server';

import { authorSpace } from '@plitzi/sdk-authoring';

import { space } from './space';

const PORT = Number(process.env.PORT ?? 8080);

/**
 * The space, held in this project.
 *
 * \`authorSpace\` turns the declaration in \`src/space.ts\` into the two documents a renderer wants. It runs at
 * boot, so saving that file and letting \`--watch\` restart it is the whole edit loop.
 */
const offlineData = authorSpace(space);

${PLUGINS}

/**
 * Where the server gets a space from, and the only line that knows.
 *
 * \`createJsonAdapters\` is the file-backed shortcut: hand it a \`{ schema, style }\` and it answers every read a
 * page server makes. A real deployment swaps this for adapters onto its own database, or for
 * \`createCloudAdapters\` to read the live space out of Plitzi — the server never learns the difference.
 */
const server = createServer({
  port: PORT,
  devMode: process.env.NODE_ENV !== 'production',
  adapters: createJsonAdapters({
    offlineData,
    deployment: { spaceId: 1, environment: 'main', revision: 0, pluginNames }
  }),
  plugins,
  logger: consoleLogger
});

server.listen(PORT, '127.0.0.1');
console.log(\`pages on http://127.0.0.1:\${PORT}/\`);
`;

const cloudMain = (): string => `import path from 'node:path';

import { consoleLogger, createCloudAdapters, createServer } from '@plitzi/sdk-server';

const PORT = Number(process.env.PORT ?? 8080);

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
const server = createServer({
  port: PORT,
  devMode: process.env.NODE_ENV !== 'production',
  adapters: createCloudAdapters({
    webKey: HOST_KEY,
    ...(process.env.PLITZI_SERVER_URL ? { serverUrl: process.env.PLITZI_SERVER_URL } : {}),
    environment: (process.env.PLITZI_ENVIRONMENT ?? 'main') as 'main' | 'production',
    ...(process.env.PLITZI_REVISION ? { revision: Number(process.env.PLITZI_REVISION) } : {}),
    deployment: { pluginNames }
  }),
  plugins,
  logger: consoleLogger
});

server.listen(PORT, '127.0.0.1');
console.log(\`pages on http://127.0.0.1:\${PORT}/\`);
`;

export const serverFiles = (answers: CreateAnswers): ProjectFiles => ({
  'src/main.ts': answers.source === 'cloud' ? cloudMain() : localMain()
});
