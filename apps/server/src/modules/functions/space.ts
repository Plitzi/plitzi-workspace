import { createHash } from 'node:crypto';

import { buildFunctions, FunctionsBuildError } from './build';
import { answerCall, readCall } from './capabilities';
import { functionLimitsFor } from './config';
import { functionContextFor } from './context';
import { readManifest } from './manifest';
import { taskName } from '../actions/tasks/registry';

import type { FunctionsSource } from './build';
import type { FunctionsConfig } from './config';
import type { FunctionContext } from './contract';
import type {
  FunctionsBundle,
  FunctionInvocationContext,
  FunctionLimits,
  FunctionRunner,
  FunctionUsage,
  SpaceFunctions
} from './protocol';
import type { ActionTask, ActionTaskRegistry, RegisteredTask } from '../actions/types';
import type { FunctionsManifest, FunctionsProblem } from '@plitzi/sdk-shared';

const invocationContextOf = ({
  spaceId,
  environment,
  runId,
  trigger,
  callerId,
  user
}: FunctionContext): FunctionInvocationContext => ({
  spaceId,
  environment,
  runId,
  trigger,
  callerId,
  ...(user ? { user } : {})
});

/**
 * A space's tasks as the registry holds them — each run by the runner, answering the code's calls with the run's own
 * {@link FunctionContext}: the same one native functions get, built by the same function.
 */
export const spaceTasks = (
  functions: SpaceFunctions,
  runner: FunctionRunner,
  limits: FunctionLimits,
  { admit, onUsage }: Pick<FunctionsConfig, 'admit' | 'onUsage'> = {}
): ActionTask<Record<string, unknown>>[] =>
  functions.manifest.tasks.map(task => {
    const name = taskName(task);

    return {
      namespace: task.namespace,
      action: task.action,
      title: task.title,
      ...(task.description ? { description: task.description } : {}),
      params: task.params,
      run: async (params, ctx) => {
        const refusal = await admit?.(ctx.spaceId);
        if (refusal) {
          throw new Error(refusal);
        }

        const fnCtx = functionContextFor(ctx, functions.manifest.hosts);
        let ok = false;
        let spent: FunctionUsage | undefined;
        try {
          const value = await runner.invoke({
            bundle: functions.bundle,
            invocation: { kind: 'task', name, params, context: invocationContextOf(fnCtx) },
            limits,
            answer: call => answerCall(fnCtx, readCall(call)),
            signal: ctx.signal,
            onUsage: usage => {
              spent = usage;
            }
          });
          ok = true;

          return value;
        } finally {
          if (spent) {
            onUsage?.({ spaceId: ctx.spaceId, task: name, ok, usage: spent });
          }
        }
      }
    };
  });

/** The deployment's tasks and a space's, one registry: a space's never answers a name the deployment's already does. */
const composeRegistry = (
  base: ActionTaskRegistry,
  tasks: ActionTask<Record<string, unknown>>[]
): ActionTaskRegistry => {
  const own = new Map<string, RegisteredTask>();
  tasks.forEach(task => {
    const name = taskName(task);
    if (!base.get(name)) {
      own.set(name, { ...task, name });
    }
  });

  return {
    get: name => base.get(name) ?? own.get(name),
    list: () => [...base.list(), ...own.values()]
  };
};

const REGISTRY_CACHE = 500;

export type SpaceRegistries = {
  /** The tasks one run of that space can use: the deployment's, and its own functions' when it has any. */
  registryFor: (functions: SpaceFunctions | undefined) => ActionTaskRegistry;
};

/**
 * Registries per space bundle, built once per bundle and limits — a space's functions change when they are saved, and
 * a saved bundle is a new id.
 */
export const createSpaceRegistries = (base: ActionTaskRegistry, config: FunctionsConfig = {}): SpaceRegistries => {
  const cache = new Map<string, ActionTaskRegistry>();

  return {
    registryFor: functions => {
      const { runner } = config;
      if (!functions || !runner) {
        return base;
      }

      const limits = functionLimitsFor(config.limits, functions.limits);
      const key = `${functions.bundle.id}:${JSON.stringify(limits)}`;
      const found = cache.get(key);
      if (found) {
        return found;
      }

      const registry = composeRegistry(base, spaceTasks(functions, runner, limits, config));
      cache.set(key, registry);
      if (cache.size > REGISTRY_CACHE) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) {
          cache.delete(oldest);
        }
      }

      return registry;
    }
  };
};

/** Functions whose code is already in hand — prepared a moment ago, or a deployment's own — as a run reaches them. */
export const functionsInHand = ({
  bundle,
  manifest
}: {
  bundle: FunctionsBundle;
  manifest: FunctionsManifest;
}): SpaceFunctions => ({ bundle: { id: bundle.id, load: () => Promise.resolve(bundle.code) }, manifest });

/** A source made ready to store: the bundle whole — storing is the one place its code travels — and what it declared. */
export type PreparedFunctions =
  | { ok: true; functions: { bundle: FunctionsBundle; manifest: FunctionsManifest } }
  | { ok: false; problems: FunctionsProblem[] };

/**
 * A space's source made ready to save: built, read by the runner, and checked — the only way a space's functions are
 * stored, so what is stored always passed every rule. `reserved` is every namespace the deployment's own tasks use.
 */
export const prepareFunctions = async (
  source: FunctionsSource,
  runner: FunctionRunner,
  reserved: ReadonlySet<string>
): Promise<PreparedFunctions> => {
  let code: string;
  try {
    ({ code } = await buildFunctions(source));
  } catch (error) {
    if (error instanceof FunctionsBuildError) {
      return { ok: false, problems: error.problems };
    }

    throw error;
  }

  const bundle = { id: createHash('sha256').update(code).digest('hex'), code };
  let declared: unknown;
  try {
    declared = await runner.describe(bundle);
  } catch (error) {
    return {
      ok: false,
      problems: [{ file: 'index.ts', message: error instanceof Error ? error.message : String(error) }]
    };
  }

  const { manifest, problems } = readManifest(declared, reserved);

  return problems.length
    ? { ok: false, problems: problems.map(message => ({ file: 'index.ts', message })) }
    : { ok: true, functions: { bundle, manifest } };
};
