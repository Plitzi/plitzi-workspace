import os from 'node:os';

/**
 * Whether lines that failed did so only by running out of time on a machine too busy to run them: Playwright's "Test
 * timeout of 30000ms exceeded", a step "Timeout 5000ms exceeded". A run's finish refused twice on drag specs timing out
 * at a load of 35–50 — they passed alone right after — and its report blamed the tasks' changes.
 */

/** What a check prints when it ran out of time, rather than finding the page otherwise. */
const TIMED_OUT = /Test timeout of \d+ms exceeded|Timeout \d+ms exceeded|timed out after/i;

/** Past this load a core, the machine is busier than a check's timeouts were written for. */
const BUSY_PER_CORE = 1.5;

/** The phrase a refusal over such lines carries: what the run's report reads to leave them out of what broke. */
export const BUSY_TIMEOUTS = 'timed out while this machine was busy';

/**
 * The line a refusal says when every failed line ran out of time and the machine was busy — `load` (the last minute's)
 * past `cores` × 1.5 — or nothing: a failure that is no timeout, or a timeout on a quiet machine, is the page's.
 */
export const busyTimeoutsNote = (
  outputs: readonly (readonly string[])[],
  { load, cores }: { load: number; cores: number } = { load: os.loadavg()[0] ?? 0, cores: os.cpus().length }
): string | undefined =>
  outputs.length > 0 &&
  outputs.every(output => output.some(line => TIMED_OUT.test(line))) &&
  load > cores * BUSY_PER_CORE
    ? `Every line that failed ${BUSY_TIMEOUTS} (load ${load.toFixed(0)} on ${String(cores)} cores): nothing says the result is broken — finish again once it is quieter, or run those lines alone to see`
    : undefined;
