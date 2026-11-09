/// <reference types="vitest" />

import { defaultServerConditions, defineConfig } from 'vite';

import { perfMultiplier } from '../sdk-shared/testTimeouts.ts';

/** The workspace packages are read from their sources under test (`@plitzi/source`), as the typecheck reads them. */
const SOURCE_CONDITION = '@plitzi/source';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    // Vitest's timeouts scaled under the workspace's suite, where every package runs at once.
    setupFiles: ['../sdk-shared/setupTimeouts.ts'],
    // …and what a test that measures time scales its own waits and budgets by (`remote.urgency.test.ts`).
    env: { PERF_MULTIPLIER: String(perfMultiplier()) },
    // The isolates its tests run functions in: isolated-vm needs Node's startup snapshot off.
    execArgv: ['--no-node-snapshot']
  },
  resolve: {
    conditions: [SOURCE_CONDITION, ...defaultServerConditions],
    extensions: ['.ts', '.tsx', '.mjs', '.js']
  },
  ssr: {
    resolve: { conditions: [SOURCE_CONDITION, ...defaultServerConditions] }
  }
});
