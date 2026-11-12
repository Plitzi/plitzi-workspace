import { availableParallelism } from 'node:os';

import { describe, expect, it } from 'vitest';

import { createCpuMeter } from './cpuMeter';
import { createIsolateRunner } from './isolate';
import { bundleOf, invoke, spinFor, valueOf } from './tests/guest';

/** Two isolates that compute 300 ms each, invoked at once on a runner of 2 vCPU: what each answered and was charged. */
const pair = async (): Promise<{ values: unknown[]; charged: number[] }> => {
  const runner = createIsolateRunner({ concurrency: 4, turns: 2, cpuMeter: createCpuMeter(5, 2) });
  const charged = [0, 0];
  const outcomes = await Promise.all(
    [0, 1].map(index =>
      invoke(runner, bundleOf(spinFor(300)), { cpuMs: 1000 }, { onUsage: usage => (charged[index] = usage.cpuMs) })
    )
  );

  return { values: outcomes.map(valueOf), charged };
};

/**
 * A runner of 2 vCPU — its turns and its meter's cores its quota's — runs two isolates at once, each charged what it
 * took and never the other's, neither stopped for the other's. Read off what each was charged, not off how long the pair
 * took: a bound on the wall clock failed whenever the machine was busy (680 ms against 550 under the workspace's suite)
 * — a busy machine gives each thread less of a core, which only lowers what it is charged. That the two run on threads
 * of their own is isolated-vm's; that the runner admits both at once is its turns' (`turns.test.ts`). On a machine with
 * fewer than two cores there is nothing to measure it on.
 */
describe.skipIf(availableParallelism() < 2)('a runner of 2 vCPU', () => {
  it('runs two isolates at once, each charged what it took', async () => {
    const { values, charged } = await pair();

    expect(values).toEqual(['done', 'done']);
    // Each its own 300 ms at most (measured 294–297 alone, 220–254 beside a core per thread taken), never the pair's
    // 600: charged the other's CPU too, each would read about twice what it ran.
    charged.forEach(ms => {
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(330);
    });
  });

  // Each computes 200 ms on a limit of 300: charged the time it waited for one of the two threads, it would be stopped.
  it('shares two threads between four that compute at once, and stops none of them for the wait', async () => {
    const runner = createIsolateRunner({ concurrency: 4, turns: 2, cpuMeter: createCpuMeter(5, 2) });

    const outcomes = await Promise.all(
      Array.from({ length: 4 }, () => invoke(runner, bundleOf(spinFor(200)), { cpuMs: 300 }))
    );

    expect(outcomes.map(valueOf)).toEqual(['done', 'done', 'done', 'done']);
  });
});
