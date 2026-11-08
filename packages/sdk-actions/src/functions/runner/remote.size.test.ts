import { describe, expect, it } from 'vitest';

import { startFunctionsRunnerService } from '@plitzi/sdk-runtime/runner';
import { FunctionFailure } from '@plitzi/sdk-shared/functions';

import { createRemoteRunner } from './remote';

import type { FunctionInvocation, FunctionLimits } from '@plitzi/sdk-shared/functions';

const SECRET = 'a-runner-secret-of-at-least-32-characters';
const MIB = 1_048_576;

// A large task (256 MB) reserves 290 MB: a runner of 200 MB, 170 of them for invocations, could never hold it.
const LARGE: FunctionLimits = { cpuMs: 1000, wallMs: 5000, memoryMb: 256, outputBytes: 100_000, calls: 20 };

const CODE = 'export default { tasks: [{ namespace: "probe", action: "run", run: async () => "ran" }] };';

const invocation: FunctionInvocation = {
  kind: 'task',
  name: 'probe.run',
  params: {},
  context: { spaceId: 3, environment: 'main', runId: 'run-large', trigger: 'call', callerId: 'ip:1' }
};

const runnerOf = (limitMb: number) =>
  startFunctionsRunnerService({
    secret: SECRET,
    port: 0,
    host: '127.0.0.1',
    readMemory: () => ({ usedBytes: 0, limitBytes: limitMb * MIB })
  });

const urlOf = (service: Awaited<ReturnType<typeof runnerOf>>) => `ws://127.0.0.1:${String(service.address().port)}`;

/**
 * A task's size is what a runner reserves for it, so whether one fits is known before it runs: a runner that could never
 * hold it says so at once (`too_large`), and the task goes to one that can — or fails at once, naming what it needs.
 * Before it, such a task was `busy` like any other, and kept in a runner's queue for room that would never come.
 */
describe('a task larger than a runner could ever hold', () => {
  it('runs on a runner large enough, never kept by one too small', async () => {
    const small = await runnerOf(200);
    const large = await runnerOf(1024);
    try {
      // Asked in turn, the small one first.
      let next = 0;
      const urls = [urlOf(small), urlOf(large)];
      const runner = createRemoteRunner({ url: () => urls[next++ % urls.length] ?? '', secret: SECRET });

      expect(
        await runner.invoke({
          bundle: { id: 'large', load: () => Promise.resolve(CODE) },
          invocation,
          limits: LARGE,
          answer: () => Promise.resolve(null),
          signal: new AbortController().signal
        })
      ).toBe('ran');
    } finally {
      await Promise.all([small.close(), large.close()]);
    }
  });

  it('fails at once, naming what it needs, when no runner could hold it', async () => {
    const small = await runnerOf(200);
    try {
      const runner = createRemoteRunner({ url: urlOf(small), secret: SECRET });
      const started = Date.now();

      const failure = await runner
        .invoke({
          bundle: { id: 'large', load: () => Promise.resolve(CODE) },
          invocation,
          limits: LARGE,
          answer: () => Promise.resolve(null),
          signal: AbortSignal.timeout(10_000)
        })
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(FunctionFailure);
      expect((failure as FunctionFailure).reason).toBe('too_large');
      expect((failure as FunctionFailure).message).toContain('could never hold it: it may hold 290 MB');
      expect(Date.now() - started).toBeLessThan(2000);
    } finally {
      await small.close();
    }
  });
});
