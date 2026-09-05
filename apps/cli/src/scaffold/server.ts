import type { CreateAnswers, ProjectFiles } from './types';

/**
 * The server-mode entry point: a page server of this project's own.
 *
 * Where the space comes from is one argument — the adapters — and nothing else in the file changes with it. That
 * is the whole shape of `@plitzi/sdk-server`, and the generated project shows it rather than describing it.
 */

const localMain = (): string => `import { consoleLogger, createJsonAdapters, createServer } from '@plitzi/sdk-server';

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
  adapters: createJsonAdapters({ offlineData }),
  logger: consoleLogger
});

server.listen(PORT, '127.0.0.1');
console.log(\`pages on http://127.0.0.1:\${PORT}/\`);
`;

const cloudMain = (): string => `import { consoleLogger, createCloudAdapters, createServer } from '@plitzi/sdk-server';

const PORT = Number(process.env.PORT ?? 8080);

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
    ...(process.env.PLITZI_REVISION ? { revision: Number(process.env.PLITZI_REVISION) } : {})
  }),
  logger: consoleLogger
});

server.listen(PORT, '127.0.0.1');
console.log(\`pages on http://127.0.0.1:\${PORT}/\`);
`;

export const serverFiles = (answers: CreateAnswers): ProjectFiles => ({
  'src/main.ts': answers.source === 'cloud' ? cloudMain() : localMain()
});
