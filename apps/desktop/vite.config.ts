/// <reference types="vite/client" />
/// <reference types="vitest" />

import { createRequire } from 'node:module';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig } from 'vite';

const require = createRequire(import.meta.url);
const PACKAGE = require('./package.json') as { version: string };

const baseUrl = new URL('.', import.meta.url);
const resolve = (...segments: string[]) => path.resolve(baseUrl.pathname, ...segments);

/**
 * Outside production the workspace packages are read from their sources — `@plitzi/source`, which leads every one of
 * their `exports` — as the builder and the SDK read them; `@plitzi/plitzi-sdk` has no such entry and is read from its
 * build, deliberately: its source resolves through aliases of its own (`@modules/*`) only its build knows about.
 */
const SOURCE_CONDITION = '@plitzi/source';

/**
 * React is pinned to the workspace copy: two Reacts in one window is a tree whose hooks throw on the first render, and
 * the SDK leaves it to the host precisely so there is only ever one.
 */
const reactAliases = {
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
      ...reactAliases,
      '@pmodules': resolve('src/modules'),
      '@pcomponents': resolve('src/components')
    },
    conditions: mode === 'production' ? undefined : [SOURCE_CONDITION, ...defaultClientConditions],
    // `@plitzi/nexus` and `@plitzi/plitzi-ui` may be linked through portals, each carrying its own node_modules. React and
    // CodeMirror check identity (a hook's dispatcher, an extension's `instanceof`), so a second copy breaks them: one each.
    dedupe: [
      'react',
      'react-dom',
      '@codemirror/autocomplete',
      '@codemirror/commands',
      '@codemirror/language',
      '@codemirror/lint',
      '@codemirror/search',
      '@codemirror/state',
      '@codemirror/view',
      '@lezer/common',
      '@lezer/highlight',
      '@lezer/lr'
    ]
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
  /**
   * 6.1, not the 6.0.5 the rest of the workspace is on.
   *
   * On Vite 8, 6.0.5 still sets the deprecated `esbuild` option and Rolldown answers it with
   * `Invalid input options … received "jsx"` once per environment — two warnings on every start, for a setting
   * nothing here asked for. It also ran Babel over the SDK's built bundle and deoptimised on its size. The oxc
   * fork that used to be the answer is deprecated: its changes landed in this package instead.
   */
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [resolve('setupTests.ts')],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'electron/**/*.test.ts'],
    environmentMatchGlobs: [['electron/**', 'node']],
    // Through Vite, so `resolve.dedupe` reaches them: loaded by Node, a portalled plitzi-ui — and the packages in its own
    // node_modules, react-toastify among them — would bring a second React.
    server: { deps: { inline: ['@plitzi/plitzi-ui', /\/plitzi-ui\/node_modules\//] } }
  }
}));
