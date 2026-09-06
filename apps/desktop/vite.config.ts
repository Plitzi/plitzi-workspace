/// <reference types="vite/client" />
/// <reference types="vitest" />

import { createRequire } from 'node:module';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);
const PACKAGE = require('./package.json') as { version: string };

const baseUrl = new URL('.', import.meta.url);
const resolve = (...segments: string[]) => path.resolve(baseUrl.pathname, ...segments);

/**
 * The shared packages come from source; `@plitzi/plitzi-sdk` deliberately does not.
 *
 * The SDK's own source resolves through aliases of its own (`@modules/*`), which only its build knows about, so
 * pointing at `apps/sdk/src` from here fails on the SDK's very first import. The builder consumes it the same
 * way, through its published `exports` — which is also what resolves the stylesheet subpath.
 *
 * React is pinned to the workspace copy all the same: two Reacts in one window is a tree whose hooks throw on the
 * first render, and the SDK leaves it to the host precisely so there is only ever one.
 */
const packages = {
  '@plitzi/sdk-shared': resolve('../../packages/sdk-shared/src'),
  react: resolve('../../node_modules/react'),
  'react-dom': resolve('../../node_modules/react-dom')
};

export default defineConfig(({ mode }) => ({
  root: resolve('.'),
  // Relative, because a packaged renderer is served from `plitzi-app://home` and an absolute `/assets/…` would
  // address the root of that origin rather than the directory the bundle was written to.
  base: './',
  define: {
    'process.env.PLITZI_DESKTOP_VERSION': JSON.stringify(PACKAGE.version)
  },
  resolve: {
    alias: {
      ...packages,
      '@pmodules': resolve('src/modules'),
      '@pcomponents': resolve('src/components')
    },
    dedupe: ['react', 'react-dom']
  },
  server: {
    port: 5180,
    strictPort: true
  },
  build: {
    outDir: resolve('dist/renderer'),
    emptyOutDir: true,
    sourcemap: mode === 'development',
    target: 'chrome130'
  },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [resolve('setupTests.ts')],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'electron/**/*.test.ts'],
    environmentMatchGlobs: [['electron/**', 'node']]
  }
}));
