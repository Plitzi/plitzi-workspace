/**
 * How much slower than an idle machine a test run is: five times under the root `yarn test` (`TURBO_RUN`), where every
 * package runs at once and a test waits for a core, or what `PERF_MULTIPLIER` says (CI's shared runner). The timing
 * budgets read it (`setupTests.ts`), and so do Vitest's own timeouts.
 */
export const perfMultiplier = (): number => Number(process.env.PERF_MULTIPLIER ?? (process.env.TURBO_RUN ? 5 : 1));

/**
 * Vitest's timeouts scaled by it, for a package's `test` config: a test that passes alone timed out only under the
 * workspace's suite — load, not a bug. A test slow alone (a real build, a real server) still says its own.
 */
export const testTimeouts = (): { testTimeout: number; hookTimeout: number } => ({
  testTimeout: 5_000 * perfMultiplier(),
  hookTimeout: 10_000 * perfMultiplier()
});
