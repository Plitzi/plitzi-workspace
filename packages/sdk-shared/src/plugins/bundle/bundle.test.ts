// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { build } from 'esbuild';
import { afterAll, describe, expect, it } from 'vitest';

import { pluginAssetLoaders, pluginImportQueries } from './bundle';

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'plitzi-plugin-bundle-'));

afterAll(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

/** An entry that hands one import straight back out, as `name`. */
const reexport = (from: string, name = 'value'): string => `export { default as ${name} } from '${from}';`;

/** Bundles an entry written on the spot, and runs the bundle for what it exports. */
const bundled = async (files: Record<string, string | Uint8Array>): Promise<Record<string, unknown>> => {
  const root = fs.mkdtempSync(path.join(folder, 'case-'));
  Object.entries(files).forEach(([name, contents]) => {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), contents);
  });
  const result = await build({
    entryPoints: [path.join(root, 'index.ts')],
    bundle: true,
    format: 'esm',
    write: false,
    loader: pluginAssetLoaders(),
    plugins: [pluginImportQueries()],
    logLevel: 'silent'
  });
  const out = path.join(root, 'out.mjs');
  fs.writeFileSync(out, result.outputFiles[0].text);

  return (await import(out)) as Record<string, unknown>;
};

describe('pluginImportQueries', () => {
  it('imports a file’s text with `?raw` — a worker a plugin starts from a Blob', async () => {
    const module = await bundled({
      'index.ts': reexport('./worker.js?raw', 'source'),
      'worker.js': 'self.onmessage = event => self.postMessage(event.data);'
    });

    expect(module.source).toBe('self.onmessage = event => self.postMessage(event.data);');
  });

  it('imports a file as a data URI with `?inline` — a WebAssembly module', async () => {
    const module = await bundled({
      'index.ts': reexport('./engine.wasm?inline', 'url'),
      'engine.wasm': new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])
    });

    expect(module.url).toBe('data:application/wasm;base64,AGFzbQEAAAA=');
  });

  it('resolves a package’s file the way a plain import of it would', async () => {
    const module = await bundled({
      'index.ts': reexport('lib/dist/worker.js?raw', 'source'),
      'node_modules/lib/package.json': '{ "name": "lib", "version": "1.0.0" }',
      'node_modules/lib/dist/worker.js': 'postMessage(1);'
    });

    expect(module.source).toBe('postMessage(1);');
  });

  it('fails the build naming a file that is not there', async () => {
    await expect(bundled({ 'index.ts': reexport('./missing.js?raw') })).rejects.toThrow('missing.js');
  });
});

describe('pluginAssetLoaders', () => {
  it('carries an image a stylesheet points at inside the bundle', async () => {
    const module = await bundled({
      'index.ts': reexport('./pin.svg', 'pin'),
      'pin.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>'
    });

    expect(module.pin).toMatch(/^data:image\/svg\+xml/);
  });
});
