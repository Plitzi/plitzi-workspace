/// <reference types="vite/client" />

import { builtinModules } from 'node:module';
import path from 'node:path';

import { defineConfig } from 'vite';

const baseUrl = new URL('.', import.meta.url);
const resolve = (...segments: string[]) => path.resolve(baseUrl.pathname, ...segments);

/** Electron supplies both; bundling either of them produces a main process that cannot start. */
export const external = ['electron', ...builtinModules, ...builtinModules.map(name => `node:${name}`)];

/**
 * The main process, as CommonJS.
 *
 * **The format is not a style choice.** Electron's own `electron` module is CommonJS, so an ES main process that
 * writes `import { BrowserWindow } from 'electron'` dies at load with "does not provide an export named
 * 'BrowserWindow'" — the window never opens, and the only place that says so is the terminal Electron was
 * started from. `.cjs` and not `.js` because this package is `"type": "module"`, which would make a bare `.js`
 * an ES module again.
 *
 * Built apart from the preload, and one entry per build is the whole point: the two share `./contract`, and a
 * single build with both entries hoists that shared module into a third file each of them then `require`s by
 * relative path. This process may do that; a sandboxed preload may not. See `vite.preload.config.ts`.
 *
 * The preload is written into the same directory by its own build, which runs first and owns clearing it.
 */
export default defineConfig(({ mode }) => ({
  build: {
    outDir: resolve('dist/electron'),
    emptyOutDir: false,
    sourcemap: mode === 'development',
    minify: false,
    target: 'node22',
    lib: { entry: resolve('electron/main.ts'), formats: ['cjs'], fileName: () => 'main.cjs' },
    rollupOptions: { external }
  }
}));
