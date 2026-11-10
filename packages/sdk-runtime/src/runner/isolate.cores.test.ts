import { availableParallelism } from 'node:os';

import { describe, expect, it } from 'vitest';

import { createCpuMeter } from './cpuMeter';
import { createIsolateRunner } from './isolate';
import { bundleOf, invoke, spinFor, valueOf } from './tests/guest';

/**
 * A runner of 2 vCPU — its turns and its meter's cores its quota's — runs two isolates on two real threads at once: two
 * that compute 300 ms each end together, in about the time of one, each charged what it took, neither stopped for the
 * other's. On a machine with fewer than two cores there is nothing to measure it on.
 */
describe.skipIf(availableParallelism() < 2)('a runner of 2 vCPU', () => {
  it('runs two isolates at once on two threads, each charged what it took', async () => {
    const runner = createIsolateRunner({ concurrency: 4, turns: 2, cpuMeter: createCpuMeter(5, 2) });
    const started = Date.now();

    const outcomes = await Promise.all([0, 1].map(() => invoke(runner, bundleOf(spinFor(300)), { cpuMs: 1000 })));

    expect(outcomes.map(valueOf)).toEqual(['done', 'done']);
    // One after the other would take 600 ms: together, about 300.
    expect(Date.now() - started).toBeLessThan(550);
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
