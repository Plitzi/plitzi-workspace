import { consoleLogger, createCloudAdapters, createServer } from '@plitzi/sdk-server';

const PORT = Number(process.env.PORT ?? 8080);
/**
 * The space's HOST key — not the public one the published page embeds.
 *
 * They are different credentials on purpose. The public `render` key is readable by anyone who views source on the
 * published site, and what keeps a copied one from working is that a browser is made to state the origin it is
 * presenting from. A server has no such statement to make, so it gets a key whose protection is that it is secret:
 * issued once, never committed, never shipped in a page, and revocable on its own without touching the live site.
 */
const HOST_KEY = process.env.PLITZI_HOST_KEY ?? '';

if (!HOST_KEY) {
  throw new Error('Set PLITZI_HOST_KEY to the space’s self-hosting key from Credentials in the builder.');
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
  webKey: HOST_KEY,
  // Left unset this is Plitzi's production server, which is where a self-hosted deployment reads from. Set
  // PLITZI_SERVER_URL only to point at a staging or local Plitzi (see the README on Node and the mkcert CA).
  ...(process.env.PLITZI_SERVER_URL ? { serverUrl: process.env.PLITZI_SERVER_URL } : {}),
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
