import { consoleLogger, createCloudAdapters, createServer } from '@plitzi/sdk-server';

const PORT = Number(process.env.PORT ?? 4005);
const SERVER_URL = process.env.PLITZI_SERVER_URL ?? 'https://server.plitzi.com/graphql';
const WEB_KEY = process.env.PLITZI_WEB_KEY ?? '';

if (!WEB_KEY) {
  throw new Error('Set PLITZI_WEB_KEY to the space key from Credentials in the builder.');
}

/**
 * The space stays in Plitzi; the SERVER is this one.
 *
 * `createJsonAdapters` (example 04) serves a file somebody exported, which stops being the space the moment anyone
 * edits it. This reads the live document over the same query the browser-rendered SDK uses, with the same space
 * key — so the space keeps being edited, published and versioned in the builder while every request is served from
 * here, under this deployment's own domain, auth, actions and logs.
 */
const adapters = createCloudAdapters({
  serverUrl: SERVER_URL,
  webKey: WEB_KEY,
  // `main` is the live document the builder edits. Point it at a published environment and a revision to serve a
  // version that cannot change under the deployment.
  environment: 'main',
  // A minute, so an edit shows up without a restart and a burst of traffic is still one fetch.
  cacheSeconds: 60
});

const server = createServer({
  port: PORT,
  devMode: true,
  adapters,
  logger: consoleLogger
});

server.listen(PORT, '127.0.0.1');
console.log(`[example] pages on http://127.0.0.1:${PORT}/`);
