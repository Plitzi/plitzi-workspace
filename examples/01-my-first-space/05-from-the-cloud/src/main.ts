import { consoleLogger, createCloudAdapters, createServer } from '@plitzi/sdk-server';

const PORT = Number(process.env.PORT ?? 4005);
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
  // `serverUrl` is not passed: it defaults to Plitzi's production server, which is where a self-hosted deployment
  // reads from. Set it only to point at a staging Plitzi.
  webKey: WEB_KEY,
  /**
   * Which version this server serves — the one decision to be deliberate about:
   *
   * - `main` is the document the builder is editing. Read live on every request, never cached, because seeing the
   *   edit is the reason to point at it. A development target.
   * - A published environment with no `revision` serves the LATEST and releases itself: a cheap probe every
   *   `cacheSeconds` asks which revision is current, and the space is refetched only when that answer moves.
   * - A published environment WITH a `revision` serves exactly that version, fetched once and kept — for a
   *   deployment that rolls forward on its own schedule.
   */
  environment: (process.env.PLITZI_ENVIRONMENT as 'main' | 'production') ?? 'main',
  ...(process.env.PLITZI_REVISION ? { revision: Number(process.env.PLITZI_REVISION) } : {})
});

const server = createServer({
  port: PORT,
  devMode: true,
  adapters,
  logger: consoleLogger
});

server.listen(PORT, '127.0.0.1');
console.log(`[example] pages on http://127.0.0.1:${PORT}/`);
