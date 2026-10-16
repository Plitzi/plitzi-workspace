import { defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

/** The workspace packages from their sources (`@plitzi/source`), as every test of the workspace reads them. */
const conditions = ['@plitzi/source', ...defaultServerConditions];

// Only the bench's own tests: `.cache/` holds projects the bench generates, with suites of their own.
export default defineConfig({
  test: { include: ['src/**/*.test.ts', 'probe/**/*.test.ts', 'agents/**/*.test.ts'] },
  resolve: { conditions },
  ssr: { resolve: { conditions } }
});
