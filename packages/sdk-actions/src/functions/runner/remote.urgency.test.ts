import { describe, expect, it } from 'vitest';

import { startFunctionsRunnerService } from '@plitzi/sdk-runtime/runner';

import { createRemoteRunner } from './remote';

import type { FunctionInvocation, FunctionLimits } from '@plitzi/sdk-shared/functions';

const SECRET = 'a-runner-secret-of-at-least-32-characters';
const MIB = 1_048_576;

// 64 MB reserves 79 MB: a runner of 200 MB takes 170 MB of them, two at once — work nobody waits on, three quarters of
// that, one.
/**
 * How much slower this run is than an idle machine (`vitest.config.ts`): every wait and budget below is scaled by it
 * together, so their order — what the test is about — holds when the whole workspace's suite shares the cores. Fixed,
 * a visitor's call measured 879 ms against a 300 ms budget there, and passed alone.
 */
const SLOW = Number(process.env.PERF_MULTIPLIER ?? '1');

const LIMITS: FunctionLimits = { cpuMs: 1000, wallMs: 5000, memoryMb: 64, outputBytes: 100_000, calls: 20 };

const CODE =
  'export default { tasks: [{ namespace: "probe", action: "run", run: async ({ ms }) => { await new Promise(r => setTimeout(r, Number(ms))); return "ran"; } }] };';

const invocationOf = (trigger: string, ms: number): FunctionInvocation => ({
  kind: 'task',
  name: 'probe.run',
  params: { ms },
  context: { spaceId: 3, environment: 'main', runId: `run-${trigger}-${String(ms)}`, trigger, callerId: 'ip:1' }
});

/**
 * Under a load probe, minute-long job slices and scheduled actions filled every runner, and visitors' calls waited
 * behind them in the same queue past their own timeout (129 of 1000). What nobody waits on now takes three quarters of a
 * runner's room at most, and a visitor's request is let in first.
 */
describe('a runner, between a visitor’s request and work nobody waits on', () => {
  const withRunner = async (body: (run: (trigger: string, ms: number) => Promise<number>) => Promise<void>) => {
    const service = await startFunctionsRunnerService({
      secret: SECRET,
      port: 0,
      host: '127.0.0.1',
      readMemory: () => ({ usedBytes: 0, limitBytes: 200 * MIB })
    });
    const runner = createRemoteRunner({ url: `ws://127.0.0.1:${String(service.address().port)}`, secret: SECRET });
    const started = Date.now();
    // When each ended, from the start.
    const run = (trigger: string, ms: number): Promise<number> =>
      runner
        .invoke({
          bundle: { id: 'urgency', load: () => Promise.resolve(CODE) },
          invocation: invocationOf(trigger, ms),
          limits: LIMITS,
          answer: () => Promise.resolve(null),
          signal: new AbortController().signal,
          onWaited: () => undefined
        })
        .then(() => Date.now() - started);
    try {
      await body(run);
    } finally {
      await service.close();
    }
  };

  const settle = () => new Promise(resolve => setTimeout(resolve, 50 * SLOW));

  it('keeps room for a visitor’s request beside work nobody waits on', async () => {
    await withRunner(async run => {
      const first = run('schedule', 400 * SLOW);
      await settle();
      const second = run('schedule', 400 * SLOW);
      await settle();
      const visitor = run('call', 20 * SLOW);

      // Taken at once beside the first schedule's run, never behind the second's.
      expect(await visitor).toBeLessThan(300 * SLOW);
      expect(await second).toBeGreaterThanOrEqual(800 * SLOW);
      await first;
    });
  });

  it('lets a visitor’s request in before work nobody waits on that came first', async () => {
    await withRunner(async run => {
      const ends = run('call', 200 * SLOW);
      const stays = run('call', 700 * SLOW);
      await settle();
      const scheduled = run('schedule', 200 * SLOW);
      await settle();
      const visitor = run('call', 20 * SLOW);

      // The room the first call frees at 200 ms is the visitor's, not the schedule's that waited longer.
      expect(await visitor).toBeLessThan(400 * SLOW);
      expect(await scheduled).toBeGreaterThan(await visitor);
      await Promise.all([ends, stays]);
    });
  });
});
