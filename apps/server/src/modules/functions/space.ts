import { createHash } from 'node:crypto';

import { buildFunctions, FunctionsBuildError } from './build';
import { answerCall, readCall } from './capabilities';
import { functionLimitsFor } from './config';
import { functionContextFor } from './context';
import { readManifest } from './manifest';
import { FunctionFailure } from './protocol';
import { ActionRefusal } from '../actions/runtime/errors';
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
import type { FunctionsManifest, FunctionsProblem, FunctionTimeLimits } from '@plitzi/sdk-shared';

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
 * {@link FunctionContext}: the same one native functions get, built by the same function. Each is given what
 * `limitsFor` answers for what it asked: its own limits, over its functions'.
 */
export const spaceTasks = (
  functions: SpaceFunctions,
  runner: FunctionRunner,
  limitsFor: (asked: FunctionTimeLimits) => FunctionLimits,
  { admit, onUsage }: Pick<FunctionsConfig, 'admit' | 'onUsage'> = {}
): ActionTask<Record<string, unknown>>[] =>
  functions.manifest.tasks.map(task => {
    const name = taskName(task);
    const limits = limitsFor({ ...functions.manifest.limits, ...task.limits });

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
        } catch (error) {
          // What the code refused with was written for whoever asked: it reaches them, as a platform step's refusal does.
          if (error instanceof FunctionFailure && error.reason === 'refused') {
            throw new ActionRefusal(error.message);
          }

          throw error;
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
      const runner = functions?.runner ?? config.runner;
      if (!functions || !runner) {
        return base;
      }

      // What each task asked is in the bundle; what bounds it is the space's plan and the deployment's.
      const key = `${functions.bundle.id}:${JSON.stringify(functions.limits ?? {})}`;
      const found = cache.get(key);
      if (found) {
        return found;
      }

      const limitsFor = (asked: FunctionTimeLimits) => functionLimitsFor(config.limits, functions.limits, asked);
      const registry = composeRegistry(base, spaceTasks(functions, runner, limitsFor, config));
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
 * stored, so what is stored always passed every rule. `reserved` is every namespace the deployment's own tasks use;
 * `ceilings`, the most it gives one invocation — what a task may ask for.
 */
export const prepareFunctions = async (
  source: FunctionsSource,
  runner: FunctionRunner,
  reserved: ReadonlySet<string>,
  ceilings: FunctionLimits
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

  const { manifest, problems } = readManifest(declared, reserved, ceilings);

  return problems.length
    ? { ok: false, problems: problems.map(message => ({ file: 'index.ts', message })) }
    : { ok: true, functions: { bundle, manifest } };
};
