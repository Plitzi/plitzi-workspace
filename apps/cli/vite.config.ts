/// <reference types="vite/client" />
/// <reference types="vitest" />

import { chmod } from 'node:fs/promises';
import path from 'node:path';

import { defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

import type { Plugin } from 'vite';

/**
 * The workspace packages are read from their sources under test — `@plitzi/source`, which leads every one of their
 * `exports`, the condition the shared `tsconfig.app.json` gives the editor and the typecheck — so a test runs the code
 * of the packages it depends on as it is now, with no build first.
 */
const SOURCE_CONDITION = '@plitzi/source';
/** Only the tests: the build bundles what CI built, as it always has. */
const testConditions = process.env.VITEST ? [SOURCE_CONDITION, ...defaultServerConditions] : undefined;

/**
 * `bin.js` left as a program. Yarn marks a workspace's bin executable when it installs, and every build writes the file
 * anew without the mark: after one, `plitzi` in any project that links this one answered "Permission denied" — the
 * agent benchmark's runs spent their turns working round it. npm marks it on install, so what is published never needed
 * this; what is built here does.
 */
const executableBin = (): Plugin => ({
  name: 'plitzi-executable-bin',
  async writeBundle(options) {
    await chmod(path.join(options.dir ?? 'dist', 'bin.js'), 0o755);
  }
});

/**
 * A command, not a library.
 *
 * So there are no type declarations to emit and no consumer to keep an export surface stable for: what ships is one
 * executable file with a shebang (`index.js`), started by a small one (`bin.js`) that `bin` in the manifest points at. `commander` and `chalk` stay external —
 * they are the package's own dependencies, and bundling them would ship two copies to anyone who has them already.
 */
export default defineConfig({
  plugins: [executableBin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'node20',
    // `bin` turns the compile cache on before the CLI's code is read; `index` is the CLI.
    lib: { entry: { bin: './src/bin.ts', index: './src/index.ts' }, formats: ['es'] },
    rollupOptions: {
      // A package's subpaths too (`@plitzi/sdk-authoring/node`): naming the root alone bundled the subpaths' code — 1 MB,
      // a second copy of the modules the root loads from `node_modules`, compiled again on every start.
      external: [/^(chalk|commander|esbuild|fflate|playwright-core|@plitzi\/sdk-authoring)(\/|$)/, /^node:/],
      output: { entryFileNames: '[name].js', banner: '#!/usr/bin/env node' }
    },
    minify: false,
    sourcemap: false
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Each test file on a config folder of its own: never the person's account nor this machine's pace.
    setupFiles: ['../../packages/sdk-shared/setupTimeouts.ts', 'src/tests/isolatedConfig.ts'],
    // As `plitzi functions dev` runs itself: the isolates need Node's startup snapshot off.
    execArgv: ['--no-node-snapshot']
  },
  resolve: { conditions: testConditions },
  ssr: { resolve: { conditions: testConditions } }
});
