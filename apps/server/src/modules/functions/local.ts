import { randomUUID } from 'node:crypto';

import { createIsolateRunner } from './sandbox/isolate';
import { functionsInHand } from './space';
import { functionTryEntry } from './tryEntry';
import { createActionsModule } from '../actions';

import type { FunctionsSource } from './build';
import type { FunctionLimits, SpaceFunctions } from './protocol';
import type { ActionRunResult, ActionsModule } from '../actions';
import type { FunctionsProblem, SSRUser } from '@plitzi/sdk-shared';

export type LocalFunctionsOptions = {
  /** Credentials `ctx.fetch` may name, by id — a project's own, from its environment; none by default. */
  credentials?: Record<string, Record<string, string>>;
  /** As the platform's: a plan's limits, for code that must fit them there. */
  limits?: Partial<FunctionLimits>;
  fetchImpl?: typeof fetch;
};

export type LocalFunctions = {
  /** Builds and checks the source as the platform does, and keeps it as what `tryTask` runs. */
  load: (
    source: FunctionsSource
  ) => Promise<{ ok: true; tasks: string[] } | { ok: false; problems: FunctionsProblem[] }>;
  /** One task of what was loaded, in an isolate, with its value, logs and error — the platform's Try, here. */
  tryTask: (task: string, params: Record<string, unknown>) => Promise<ActionRunResult>;
};

/** Who a local run is for: somebody signed in, with nothing to forward. */
const LOCAL_USER: SSRUser = {
  id: 0,
  username: 'local',
  email: 'local@localhost',
  verified: true,
  permissions: [],
  roles: [],
  token: ''
};

/**
 * A space's functions run on this machine exactly as the platform runs them — the same build, the same checks, the same
 * isolates and limits, `ctx` over the same actions module — so what works here works there. `kv` lives as long as this
 * does. What `plitzi functions dev` is made of; needs `isolated-vm` and `core-js` installed, as any runner does.
 */
export const createLocalFunctions = ({
  credentials = {},
  limits,
  fetchImpl
}: LocalFunctionsOptions = {}): LocalFunctions => {
  const runner = createIsolateRunner({ concurrency: 1 });
  let loaded: SpaceFunctions | undefined;
  const module: ActionsModule = createActionsModule({
    lookups: {
      getAction: () => Promise.resolve(undefined),
      getCredential: (_spaceId, identifier) =>
        Promise.resolve(Object.hasOwn(credentials, identifier) ? credentials[identifier] : undefined),
      getFunctions: () => Promise.resolve(loaded)
    },
    functions: { runner, ...(limits ? { limits } : {}) },
    jobs: false,
    ...(fetchImpl ? { fetchImpl } : {})
  });

  return {
    load: async source => {
      const prepared = await module.prepareFunctions(source);
      if (!prepared.ok) {
        return prepared;
      }

      loaded = functionsInHand(prepared.functions);

      return { ok: true, tasks: prepared.functions.manifest.tasks.map(task => `${task.namespace}.${task.action}`) };
    },
    tryTask: (task, params) =>
      module.runAction({
        entry: functionTryEntry(task, params),
        input: {},
        callerId: 'local',
        user: LOCAL_USER,
        spaceId: 0,
        environment: 'main',
        trigger: 'call',
        runId: randomUUID()
      })
  };
};
