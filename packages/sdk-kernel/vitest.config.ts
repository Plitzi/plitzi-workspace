/// <reference types="vitest" />

import { defaultServerConditions, defineConfig } from 'vite';

/** The workspace packages are read from their sources under test (`@plitzi/source`), as the typecheck reads them. */
const SOURCE_CONDITION = '@plitzi/source';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    // Vitest's timeouts scaled under the workspace's suite, where every package runs at once.
    setupFiles: ['../sdk-shared/setupTimeouts.ts']
  },
  resolve: {
    conditions: [SOURCE_CONDITION, ...defaultServerConditions],
    extensions: ['.ts', '.tsx', '.mjs', '.js']
  },
  ssr: {
    resolve: { conditions: [SOURCE_CONDITION, ...defaultServerConditions] }
  }
});
