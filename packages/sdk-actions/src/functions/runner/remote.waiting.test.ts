import { describe, expect, it } from 'vitest';

import { startFunctionsRunnerService } from '@plitzi/sdk-runtime/runner';

import { createRemoteRunner } from './remote';

import type { FunctionInvocation, FunctionLimits } from '@plitzi/sdk-shared/functions';

const SECRET = 'a-runner-secret-of-at-least-32-characters';
const MIB = 1_048_576;
const LIMITS: FunctionLimits = { cpuMs: 1000, wallMs: 5000, memoryMb: 32, outputBytes: 100_000, calls: 20 };
const CODE = 'export default { tasks: [{ namespace: "probe", action: "run", run: () => "ran" }] };';

const invocation: FunctionInvocation = {
  kind: 'task',
  name: 'probe.run',
  params: {},
  context: { spaceId: 3, environment: 'main', runId: 'run-waiting', trigger: 'schedule', callerId: 'schedule' }
};

/**
 * What a job worker holds back by: an invocation no runner has taken yet — kept in a full runner's queue — is counted
 * until one takes it, and never after, however it ends.
 */
describe('the invocations waiting for a runner with room', () => {
  it('counts one a full runner keeps, until the runner takes it', async () => {
    // 90 of 100 MiB held: past the 85% it takes work to, so it keeps what it is asked.
    let usedBytes = 90 * MIB;
    const full = await startFunctionsRunnerService({
      secret: SECRET,
      port: 0,
      host: '127.0.0.1',
      readMemory: () => ({ usedBytes, limitBytes: 100 * MIB })
    });
    const runner = createRemoteRunner({ url: `ws://127.0.0.1:${String(full.address().port)}`, secret: SECRET });
    try {
      expect(runner.waitingForRoom?.()).toBe(0);
      const asked = runner.invoke({
        bundle: { id: 'waiting', load: () => Promise.resolve(CODE) },
        invocation,
        limits: LIMITS,
        answer: () => Promise.resolve(null),
        signal: new AbortController().signal
      });
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(runner.waitingForRoom?.()).toBe(1);

      usedBytes = 0;
      expect(await asked).toBe('ran');
      expect(runner.waitingForRoom?.()).toBe(0);
    } finally {
      await full.close();
    }
  });
});
