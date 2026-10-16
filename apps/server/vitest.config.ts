/// <reference types="vitest" />

import { createRequire } from 'node:module';

import { defaultServerConditions, defineConfig } from 'vite';

const require = createRequire(import.meta.url);
const PACKAGE = require('./package.json') as { version: string };

/**
 * The workspace packages are read from their sources under test — `@plitzi/source`, which leads every one of their
 * `exports`, the condition the shared `tsconfig.app.json` gives the editor and the typecheck — so a test runs the code
 * of the packages it depends on as it is now, with no build first.
 */
const SOURCE_CONDITION = '@plitzi/source';

export default defineConfig({
  define: {
    VERSION: JSON.stringify(PACKAGE.version)
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    // The functions' isolates: isolated-vm needs Node's startup snapshot off (see sandbox/isolate.ts).
    execArgv: ['--no-node-snapshot'],
    deps: {
      inline: [/@plitzi\/sdk-.*/, '@modelcontextprotocol/sdk', 'zod']
    }
  },
  resolve: {
    conditions: [SOURCE_CONDITION, ...defaultServerConditions],
    extensions: ['.ts', '.tsx', '.mjs', '.js']
  },
  ssr: {
    resolve: { conditions: [SOURCE_CONDITION, ...defaultServerConditions] }
  }
});
