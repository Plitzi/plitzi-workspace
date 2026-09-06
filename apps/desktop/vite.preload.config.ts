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
 * The preload, as a classic script.
 *
 * A sandboxed preload is not loaded as a module, so an ES build fails at load time — and that failure is a window
 * that renders perfectly with no bridge on it, which reads as "the app forgot my session" rather than as a build
 * that produced the wrong format. Hence `.cjs`, and hence its own config: one Rollup output emits one format.
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
