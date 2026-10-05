import fs from 'node:fs/promises';
import path from 'node:path';

import type { Plugin } from 'esbuild';

/**
 * What a plugin's bundle carries INSIDE it, as data URIs: the images and fonts a library's stylesheet drags in (a map,
 * a date picker, an editor). Inlined rather than emitted beside the bundle, because a plugin travels as its module and
 * its stylesheet — through `plitzi pack`, an upload, a server's `copy` or `download` — and a third file nothing carries
 * would leave a stylesheet with broken references in it.
 *
 * One list for every builder of a plugin (`plitzi pack`, a server compiling one), so a plugin that builds in one builds
 * in the other.
 */
export const PLUGIN_INLINED_ASSETS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.avif',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf'
] as const;

/** `PLUGIN_INLINED_ASSETS` as esbuild's `loader` option takes it. */
export const pluginAssetLoaders = (): Record<string, 'dataurl'> =>
  Object.fromEntries(PLUGIN_INLINED_ASSETS.map(extension => [extension, 'dataurl' as const]));

const QUERY = /\?(raw|inline)$/;

/** The types a browser checks: WebAssembly's streaming compile refuses anything not `application/wasm`. */
const MIME_TYPES: Record<string, string> = {
  '.wasm': 'application/wasm',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2'
};

/**
 * A file a plugin needs whole, imported the way Vite imports it — so the same line works in a client-mode project's
 * dev server and in every bundle built for a plugin:
 *
 * - `import source from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?raw'` — the file's text: a library's worker, made
 *   with `URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))`.
 * - `import url from './engine.wasm?inline'` — the file as a data URI: a WebAssembly module, `fetch(url)` and instantiate.
 *
 * Both are carried inside the bundle, for the reason `PLUGIN_INLINED_ASSETS` is: a plugin travels as its module and its
 * stylesheet. The cost is the bundle's size — right for a worker or a small module, wrong for a 20 MB model, which
 * belongs on a CDN the plugin reads from.
 */
export const pluginImportQueries = (): Plugin => ({
  name: 'plitzi-import-queries',
  setup: build => {
    build.onResolve({ filter: QUERY }, async args => {
      const query = QUERY.exec(args.path)?.[1] ?? 'raw';
      const resolved = await build.resolve(args.path.replace(QUERY, ''), {
        kind: args.kind,
        importer: args.importer,
        resolveDir: args.resolveDir
      });
      if (resolved.errors.length > 0) {
        return { errors: resolved.errors };
      }

      return { path: resolved.path, namespace: `plitzi-${query}` };
    });
    build.onLoad({ filter: /.*/, namespace: 'plitzi-raw' }, async args => ({
      contents: await fs.readFile(args.path),
      loader: 'text',
      watchFiles: [args.path]
    }));
    // Base64 always, rather than esbuild's `dataurl`, which percent-encodes whatever looks like text — and a binary
    // module can look like text to it while carrying bytes a URL cannot.
    build.onLoad({ filter: /.*/, namespace: 'plitzi-inline' }, async args => {
      const type = MIME_TYPES[path.extname(args.path).toLowerCase()] ?? 'application/octet-stream';
      const data = (await fs.readFile(args.path)).toString('base64');

      return {
        contents: `export default ${JSON.stringify(`data:${type};base64,${data}`)};`,
        loader: 'js',
        watchFiles: [args.path]
      };
    });
  }
});
