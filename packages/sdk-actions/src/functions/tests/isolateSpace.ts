import { createIsolateRunner } from '@plitzi/sdk-runtime/runner';

import { createActionsModule } from '../../engine/module';
import { functionsInHand } from '../space';

import type { FunctionsConfig } from '../config';
import type { IsolateRunner } from '@plitzi/sdk-runtime/runner';
import type { ActionEntry, ElementInteraction, SSRUser } from '@plitzi/sdk-shared';
import type { FunctionLimits, SpaceFunctions } from '@plitzi/sdk-shared/functions';

/** A space whose functions run in isolates, as the tests of the isolate runner build it: its source, its run. */

export const runner = createIsolateRunner({ concurrency: 4 });

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

const entryFor = (action: string, params: Record<string, unknown> = {}): ActionEntry => ({
  id: 'probe',
  document: {
    name: 'Probe',
    output: { value: { type: 'json' } },
    nodes: {
      start: node('start', { type: 'trigger', action: 'call', params: { access: 'public' }, afterNode: 'probe' }),
      probe: node('probe', { action, params, afterNode: 'ret' }),
      ret: node('ret', { action: 'flow.output', params: { values: '{"value": {{ probe|json_encode }}}' } })
    }
  }
});

export const USER: SSRUser = {
  token: 'session-token-never-for-functions',
  id: 7,
  username: 'ana',
  email: 'ana@example.com',
  verified: true,
  permissions: [],
  roles: []
};

export const SIGNING_SECRET = 'the-deployment-signing-secret-32c';

/** A space whose `functions/index.ts` declares one task, `probe.run`, running `body` with `(params, ctx)`. */
export interface SourceOptions {
  hosts?: string[];
  extra?: string;
  /** What the task asks for itself: an invocation's CPU is the task's to ask, the space's limits only cap it. */
  asks?: { cpuMs?: number; wallMs?: number };
}

/**
 * Room for a runner slower than a laptop: the 100 ms a task gets by default is a third spent on one here. A test that
 * stops a run on its CPU caps it with the space's `limits`, which this never overrides.
 */
export const ASKS_ENOUGH = { cpuMs: 1000 };

export const sourceOf = (body: string, { hosts = [], extra = '', asks = ASKS_ENOUGH }: SourceOptions = {}) => ({
  'index.ts': `import { defineFunctions } from '@plitzi/sdk-runtime';
${extra}
export default defineFunctions({
  allow: { hosts: ${JSON.stringify(hosts)} },
  tasks: [{ namespace: 'probe', action: 'run', title: 'Probe', params: {}, limits: ${JSON.stringify(asks)}, run: async (params, ctx) => { ${body} } }]
});`
});

export type Space = {
  run: (
    params?: Record<string, unknown>
  ) => Promise<{ status: string; value: unknown; error: string; refusal: string | undefined; logs: string[] }>;
  module: ReturnType<typeof createActionsModule>;
};

export const spaceWith = async (
  source: Record<string, string>,
  {
    fetchImpl,
    credential,
    limits,
    admit,
    onUsage,
    unsigned,
    runner: own = runner
  }: {
    fetchImpl?: typeof fetch;
    credential?: Record<string, string>;
    limits?: Partial<FunctionLimits>;
    admit?: FunctionsConfig['admit'];
    onUsage?: FunctionsConfig['onUsage'];
    /** A server that was given no signing secret. */
    unsigned?: boolean;
    /** Another runner than the suite's: one sized for what the test is about. */
    runner?: IsolateRunner;
  } = {}
): Promise<Space> => {
  const probe = createActionsModule({
    lookups: { getAction: () => Promise.resolve(undefined) },
    functions: { runner: own }
  });
  const prepared = await probe.prepareFunctions(source);
  if (!prepared.ok) {
    throw new Error(prepared.problems.map(problem => problem.message).join('\n'));
  }

  const functions: SpaceFunctions = { ...functionsInHand(prepared.functions), ...(limits ? { limits } : {}) };
  const module = createActionsModule({
    lookups: {
      getAction: () => Promise.resolve(undefined),
      getCredential: () => Promise.resolve(credential),
      getFunctions: () => Promise.resolve(functions)
    },
    functions: { runner: own, ...(admit ? { admit } : {}), ...(onUsage ? { onUsage } : {}) },
    ...(unsigned ? {} : { signingSecret: SIGNING_SECRET }),
    ...(fetchImpl ? { fetchImpl } : {})
  });

  return {
    module,
    run: async (params = {}) => {
      const result = await module.runAction({
        entry: entryFor('probe.run', params),
        input: {},
        callerId: 'user:7',
        user: USER,
        spaceId: 3,
        environment: 'main',
        trigger: 'call',
        runId: `run-${String(Math.random())}`
      });
      const failed = result.trace.find(step => step.status === 'failed');

      return {
        status: result.status,
        logs: result.steps.find(step => step.id === 'probe')?.logs ?? [],
        value: result.output.value,
        refusal: result.error,
        error:
          failed && typeof failed.result === 'object' && failed.result && 'error' in failed.result
            ? String(failed.result.error)
            : ''
      };
    }
  };
};
