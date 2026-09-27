import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createRemoteRunner } from './remote';
import { startFunctionsRunnerService } from './service';
import { createActionsModule } from '../../actions';
import { FunctionFailure } from '../protocol';

import type { FunctionsRunnerService } from './service';
import type { FunctionInvocation, FunctionLimits, FunctionRunner, SpaceFunctions } from '../protocol';
import type { ActionEntry, ElementInteraction } from '@plitzi/sdk-shared';

const SECRET = 'a-runner-secret-of-at-least-32-characters';

const LIMITS: FunctionLimits = { cpuMs: 1000, wallMs: 5000, memoryMb: 64, outputBytes: 100_000, calls: 20 };

const invocation: FunctionInvocation = {
  kind: 'task',
  name: 'probe.run',
  params: {},
  context: { spaceId: 3, environment: 'main', runId: 'run-1', trigger: 'call', callerId: 'ip:1' }
};

const node = (id: string, overrides: Partial<ElementInteraction> = {}): ElementInteraction => ({
  id,
  title: id,
  type: 'task',
  action: '',
  params: {},
  preview: {},
  elementId: null,
  beforeNode: '',
  afterNode: '',
  flowId: 'flow',
  enabled: true,
  ...overrides
});

const ENTRY: ActionEntry = {
  id: 'probe',
  document: {
    name: 'Probe',
    output: { value: { type: 'json' } },
    nodes: {
      start: node('start', { type: 'trigger', action: 'call', params: { access: 'public' }, afterNode: 'probe' }),
      probe: node('probe', { action: 'probe.run', afterNode: 'ret' }),
      ret: node('ret', { action: 'flow.output', params: { values: '{"value": {{ probe|json_encode }}}' } })
    }
  }
};

const SOURCE = {
  'index.ts': `export default {
  tasks: [{ namespace: 'probe', action: 'run', title: 'Probe', params: {}, run: async (_params, ctx) => {
    await ctx.kv.increment('hits', 1);
    return { hits: await ctx.kv.get('hits') };
  } }]
};`
};

let service: FunctionsRunnerService;
let remote: FunctionRunner;

beforeAll(async () => {
  service = await startFunctionsRunnerService({ secret: SECRET, port: 0, host: '127.0.0.1' });
  remote = createRemoteRunner({ url: `ws://127.0.0.1:${String(service.address().port)}`, secret: SECRET });
});

afterAll(() => service.close());

describe('the runner service, through the remote runner', () => {
  it('runs a space’s task with its calls answered by the platform that asked', async () => {
    const probe = createActionsModule({
      lookups: { getAction: () => Promise.resolve(undefined) },
      functions: { runner: remote }
    });
    const prepared = await probe.prepareFunctions(SOURCE);
    if (!prepared.ok) {
      throw new Error(prepared.problems.map(problem => problem.message).join('\n'));
    }

    const functions: SpaceFunctions = prepared.functions;
    const module = createActionsModule({
      lookups: { getAction: () => Promise.resolve(undefined), getFunctions: () => Promise.resolve(functions) },
      functions: { runner: remote }
    });
    const run = () =>
      module.runAction({
        entry: ENTRY,
        input: {},
        callerId: 'ip:1',
        spaceId: 3,
        environment: 'main',
        trigger: 'call',
        runId: `run-${String(Math.random())}`
      });

    expect((await run()).output.value).toEqual({ hits: 1 });
    expect((await run()).output.value).toEqual({ hits: 2 });
  });

  it('is sent a bundle only when it does not have it', async () => {
    const bundle = {
      id: 'bundle-sent-once',
      code: 'export default { tasks: [{ namespace: "probe", action: "run", run: () => "ran" }] };'
    };
    const answer = vi.fn(() => Promise.resolve(null));
    const signal = new AbortController().signal;
    const cold = remote.invoke({ bundle, invocation, limits: LIMITS, answer, signal });
    const warm = await cold.then(() =>
      remote.invoke({
        bundle: { id: bundle.id, code: 'not sent, so never compiled' },
        invocation,
        limits: LIMITS,
        answer,
        signal
      })
    );

    expect(await cold).toBe('ran');
    expect(warm).toBe('ran');
  });

  it('carries back what the invocation spent', async () => {
    const onUsage = vi.fn();
    await remote.invoke({
      bundle: {
        id: 'bundle-usage',
        code: 'export default { tasks: [{ namespace: "probe", action: "run", run: () => 1 }] };'
      },
      invocation,
      limits: LIMITS,
      answer: () => Promise.resolve(null),
      signal: new AbortController().signal,
      onUsage
    });

    expect(onUsage).toHaveBeenCalledWith({
      cpuMs: expect.any(Number) as number,
      wallMs: expect.any(Number) as number,
      calls: 0
    });
  });

  it('refuses a platform without the secret', async () => {
    const stranger = createRemoteRunner({
      url: `ws://127.0.0.1:${String(service.address().port)}`,
      secret: 'x'.repeat(40)
    });
    const failure: unknown = await stranger
      .describe({ id: 'x', code: 'export default {};' })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(FunctionFailure);
    expect(String(failure)).toContain('unreachable');
  });

  it('stops an invocation the run aborted', async () => {
    const controller = new AbortController();
    const bundle = {
      id: 'bundle-that-waits',
      code: 'export default { tasks: [{ namespace: "probe", action: "run", run: () => new Promise(() => {}) }] };'
    };
    const invoked = remote.invoke({
      bundle,
      invocation,
      limits: LIMITS,
      answer: () => Promise.resolve(null),
      signal: controller.signal
    });
    setTimeout(() => controller.abort(), 50);
    const failure: unknown = await invoked.catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(FunctionFailure);
    expect(failure instanceof FunctionFailure && failure.reason).toBe('aborted');
  });

  it('needs a real secret to start', async () => {
    await expect(startFunctionsRunnerService({ secret: 'short' })).rejects.toThrow('at least 32 characters');
  });
});
