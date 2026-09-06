/// <reference types="vite/client" />

import { createRequire } from 'node:module';
import path from 'node:path';

import { defineConfig } from 'vite';

import { external } from './vite.electron.config.ts';

const require = createRequire(import.meta.url);
const PACKAGE = require('./package.json') as { version: string };

const baseUrl = new URL('.', import.meta.url);
const resolve = (...segments: string[]) => path.resolve(baseUrl.pathname, ...segments);

/**
 * The preload, as one self-contained CommonJS file.
 *
 * **Both halves of that matter.** A sandboxed preload — and this one is, see `webPreferences` in `main.ts` — is
 * loaded as a classic script, so an ES build fails at load; and its `require` is a polyfill over four Electron
 * modules and nothing else, so it cannot load a sibling file either. Hence its own build rather than a second
 * entry alongside the main process: two entries in one build hoist what they share — `./contract`, here — into a
 * third chunk that both then `require` by relative path, which this file is the one place that cannot.
 *
 * Either failure looks the same from the outside, and it does not look like a build: the window renders
 * perfectly with no bridge on it, which reads as "the app forgot my session".
 *
 * This build runs first and owns clearing the directory; the main-process build then adds to it.
 */
export default defineConfig(({ mode }) => ({
  // Baked in rather than read at run time: nothing sets this variable in a packaged app, so the bridge would
  // report `0.0.0` to every window that ever shipped.
  define: { 'process.env.PLITZI_DESKTOP_VERSION': JSON.stringify(PACKAGE.version) },
  build: {
    outDir: resolve('dist/electron'),
    emptyOutDir: true,
    sourcemap: mode === 'development',
    minify: false,
    target: 'node22',
    lib: { entry: resolve('electron/preload.ts'), formats: ['cjs'], fileName: () => 'preload.cjs' },
    rollupOptions: { external }
  }
}));
