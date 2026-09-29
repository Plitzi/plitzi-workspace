import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** A static file server in thirty lines, with no dependencies — the point of this example is that nothing is
 *  compiled, so pulling in a bundler or a server framework to serve it would defeat it. Any static host does. */

const PORT = Number(process.env.PORT ?? 4000);
const here = path.dirname(fileURLToPath(import.meta.url));

const PUBLIC_DIR = path.join(here, 'public');
// The SDK's built assets, served under the same /sdk-assets prefix a real Plitzi deployment uses.
const SDK_DIST = path.resolve(here, '../../../apps/sdk/dist');
const SPACE = path.resolve(here, '../../shared-space/offline-data.json');
// Tailwind's preflight — a plain stylesheet, no JavaScript and nothing to compile.
const TAILWIND = path.resolve(here, '../../../node_modules/tailwindcss/preflight.css');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const resolveFile = (urlPath) => {
  if (urlPath === '/offline-data.json') {
    return SPACE;
  }

  if (urlPath === '/vendor/preflight.css') {
    return TAILWIND;
  }

  if (urlPath.startsWith('/sdk-assets/')) {
    return path.join(SDK_DIST, urlPath.slice('/sdk-assets/'.length));
  }

  return path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);
};

createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  const file = resolveFile(urlPath);

  // Never serve outside the three roots above, whatever the URL claims.
  const allowed = [PUBLIC_DIR, SDK_DIST, SPACE, TAILWIND].some(root => file === root || file.startsWith(root + path.sep));
  if (!allowed || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end('Not found');

    return;
  }

  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`[example] open http://127.0.0.1:${PORT}/`);
  if (!existsSync(path.join(SDK_DIST, 'plitzi-sdk-vendor.js'))) {
    console.warn('[example] missing apps/sdk/dist — run `yarn build:dev && yarn build-vendor:prod` from the repo root');
  }

  if (!existsSync(TAILWIND)) {
    console.warn('[example] missing tailwindcss — run `yarn install` from the repo root');
  }
});
