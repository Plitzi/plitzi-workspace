import { defineConfig } from 'vitest/config';

// Only the bench's own tests: `.cache/` holds projects the bench generates, with suites of their own.
export default defineConfig({
  test: { include: ['src/**/*.test.ts', 'probe/**/*.test.ts'] }
});
