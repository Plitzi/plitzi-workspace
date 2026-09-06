/// <reference types="vite/client" />

import { builtinModules } from 'node:module';
import path from 'node:path';

import { defineConfig } from 'vite';

const baseUrl = new URL('.', import.meta.url);
const resolve = (...segments: string[]) => path.resolve(baseUrl.pathname, ...segments);

/** Electron supplies both; bundling either of them produces a main process that cannot start. */
export const external = ['electron', ...builtinModules, ...builtinModules.map(name => `node:${name}`)];

/**
 * The main process.
 *
 * Built apart from the renderer because almost nothing about the two is the same — a different platform, a
 * different module format, a different idea of what "external" means — and apart from the preload because a
 * sandboxed preload has to be a classic script, which is a second format one Rollup output cannot also emit.
 */
export default defineConfig(({ mode }) => ({
  build: {
    outDir: resolve('dist/electron'),
    // The preload is written into the same directory by its own build, which runs first.
    emptyOutDir: false,
    sourcemap: mode === 'development',
    minify: false,
    target: 'node22',
    lib: { entry: resolve('electron/main.ts'), formats: ['es'], fileName: () => 'main.js' },
    rollupOptions: { external }
  }
}));
