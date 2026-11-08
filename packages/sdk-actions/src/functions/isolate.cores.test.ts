import { availableParallelism } from 'node:os';

import { describe, expect, it } from 'vitest';

import { createCpuMeter, createIsolateRunner } from '@plitzi/sdk-runtime/runner';

import { sourceOf, spaceWith } from './tests/isolateSpace';

const spin = (ms: number, cpuMs = 1000) =>
  sourceOf(`const until = Date.now() + ${String(ms)}; while (Date.now() < until) {} return "done";`, {
    asks: { cpuMs }
  });

/**
 * A runner of 2 vCPU — its turns and its meter's cores its quota's — runs two isolates on two real threads at once: two
 * that compute 300 ms each end together, in about the time of one, each charged what it took, neither stopped for the
 * other's. On a machine with fewer than two cores there is nothing to measure it on.
 */
describe.skipIf(availableParallelism() < 2)('a runner of 2 vCPU', () => {
  it('runs two isolates at once on two threads, each charged what it took', async () => {
    const runner = createIsolateRunner({ concurrency: 4, turns: 2, cpuMeter: createCpuMeter(5, 2) });
    const space = await spaceWith(spin(300), { runner });
    const started = Date.now();

    const results = await Promise.all([space.run(), space.run()]);

    results.forEach(result => expect(result.value).toBe('done'));
    // One after the other would take 600 ms: together, about 300.
    expect(Date.now() - started).toBeLessThan(550);
  });

  // Each computes 200 ms on a limit of 300: charged the time it waited for one of the two threads, it would be stopped.
  it('shares two threads between four that compute at once, and stops none of them for the wait', async () => {
    const runner = createIsolateRunner({ concurrency: 4, turns: 2, cpuMeter: createCpuMeter(5, 2) });
    const space = await spaceWith(spin(200, 300), { runner });

    const results = await Promise.all(Array.from({ length: 4 }, () => space.run()));

    results.forEach(result => expect(result.value).toBe('done'));
  });
});
