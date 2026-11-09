import { randomUUID } from 'node:crypto';

import { dataDirLookup } from '@plitzi/sdk-kernel/data';

import { functionsInHand } from './space';
import { functionTryEntry } from './tryEntry';
import { createActionsModule } from '../engine/module';
import { credentialsFromEnv } from '../engine/runtime/credentials';

import type { FunctionsSource } from './build';
import type { ActionRunResult, ActionsModule } from '../engine/module';
import type { FunctionsProblem, SSRUser } from '@plitzi/sdk-shared';
import type { FunctionLimits, FunctionRunner, SpaceFunctions } from '@plitzi/sdk-shared/functions';

export type LocalFunctionsOptions = {
  /**
   * What runs the code: an isolate, as on the platform — `createIsolateRunner({ concurrency: 1 })` of
   * `@plitzi/sdk-runtime/runner`. Handed in, so what holds the runs never loads what runs a space's code (RFC 0032, D8).
   */
  runner: FunctionRunner;
  /** Credentials `ctx.fetch` may name, by id — by default the project's own, from its environment (`PLITZI_CREDENTIALS`). */
  credentials?: Record<string, Record<string, string>>;
  /** As the platform's: a plan's limits, for code that must fit them there. */
  limits?: Partial<FunctionLimits>;
  /** The project's data folder (`src/data/`), what `ctx.data` reads — as the project's server reads it. */
  dataDir?: string;
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
 * does. What `plitzi functions dev` is made of, with the isolate runner of `@plitzi/sdk-runtime`.
 */
export const createLocalFunctions = ({
  runner,
  credentials = credentialsFromEnv(),
  limits,
  dataDir,
  fetchImpl
}: LocalFunctionsOptions): LocalFunctions => {
  let loaded: SpaceFunctions | undefined;
  const module: ActionsModule = createActionsModule({
    lookups: {
      getAction: () => Promise.resolve(undefined),
      getCredential: (_spaceId, identifier) =>
        Promise.resolve(Object.hasOwn(credentials, identifier) ? credentials[identifier] : undefined),
      getFunctions: () => Promise.resolve(loaded),
      ...(dataDir ? { getData: dataDirLookup(dataDir) } : {})
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
