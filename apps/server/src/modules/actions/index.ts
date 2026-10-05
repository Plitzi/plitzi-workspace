import { createActionJobs } from './jobs';
import { createRunGuards } from './runtime/guards';
import { createKvStore } from './runtime/kvStore';
import { resolveLimits } from './runtime/limits';
import { createMemoryKv, KV_METHODS } from './runtime/memoryKv';
import { namespaceKv } from './runtime/namespaceKv';
import { createActionRunner } from './runtime/runAction';
import { createTaskRegistry } from './tasks/registry';
import { fleetStore } from '../../core/server/fleet/link';
import { functionCeilings } from '../functions/config';
import { readManifest } from '../functions/manifest';
import { createRoutes } from '../functions/routes';
import { createSpaceRegistries, prepareFunctions } from '../functions/space';

import type { ActionJobs } from './jobs';
import type { RunGuards } from './runtime/guards';
import type { ActionRunner } from './runtime/runAction';
import type {
  ActionKvAdapter,
  ActionKvStore,
  ActionRunRequest,
  ActionsConfig,
  ActionTaskRegistry,
  ResolvedActionLimits,
  SpaceRevision
} from './types';
import type { FunctionsSource } from '../functions/build';
import type { FunctionsDefinition } from '../functions/contract';
import type { ManifestReading } from '../functions/manifest';
import type { RouteHandler, RouteVisit } from '../functions/routes';
import type { FunctionScope } from '../functions/scope';
import type { PreparedFunctions } from '../functions/space';
import type { ActionDocument } from '@plitzi/sdk-shared';

export type ActionsModule = ActionRunner & {
  /** The deployment's own tasks: shipped, and its native functions. */
  registry: ActionTaskRegistry;
  /**
   * What a space's actions can use as of that revision: the deployment's tasks and the space's own functions — what
   * its catalog offers, what a check checks against and what its runs run.
   */
  registryFor: (spaceId: number, at?: SpaceRevision) => Promise<ActionTaskRegistry>;
  /**
   * A space's functions source, built, read and checked — ready to store, or the problems to show where they are. The
   * one way a space's functions become storable; refused when this server has no runner. With a `scope`, a plugin's
   * server half: its tasks named after the plugin, its routes its own.
   */
  prepareFunctions: (source: FunctionsSource, scope?: FunctionScope) => Promise<PreparedFunctions>;
  /**
   * What a space's code declares, read by every rule a saved space's functions meet — for code that is not built here:
   * a space runtime's, described by the runtime itself when it starts. The manifest, and the problems that refuse it.
   */
  readManifest: (declared: unknown) => ManifestReading;
  /**
   * The function that answers `method path` under `/api/` for this visit — the deployment's own routes, then the space's
   * — or none, and the page server answers as it would have.
   */
  routeFor: (visit: RouteVisit, method: string, path: string) => Promise<RouteHandler | undefined>;
  guards: RunGuards;
  /** The key/value store, namespaced to one space — the same one the `kv` tasks write through, so a rate limit the
   *  transport keeps and a counter a flow keeps cannot end up in different places. */
  kv: (spaceId: number) => ActionKvStore;
  /** What this server will allow one run of that document to spend — the deployment's ceilings, tightened by it. */
  limitsFor: (document: ActionDocument) => ResolvedActionLimits;
  /**
   * Puts the server half of a plugin this server ships in place — or takes it away, with none — while it runs: what a
   * development server does when a plugin's `functions/` change, instead of restarting. Checked as at boot: a task not
   * named after the plugin throws, and nothing changes.
   */
  setPluginFunctions: (plugin: string, definition: FunctionsDefinition | undefined) => void;
  /**
   * Scheduled runs: the queue, the sweep that fills it and the workers that drain it.
   *
   * Built but NOT started — whoever owns the process decides when background work begins, and a server nobody
   * listened on must not be quietly claiming jobs. Absent when the deployment cannot list a space's actions, since
   * there is then no way to know what is scheduled.
   */
  jobs?: ActionJobs;
};

/**
 * The module's whole public surface: build it once from the deployment's config, then run actions through it.
 *
 * Constructed rather than imported piecemeal so the task registry is validated ONCE, at boot, and so the guards
 * are a single set for the process — two instances would each think they were the only run in flight, which is
 * the same as having no single-flight at all. Nothing outside this folder needs to know how a run is assembled.
 */
/**
 * The workers of one server are one replica, so with no `kv` configured they share the primary's: a flow's counter,
 * a webhook's rate limit, a run's single-flight key, a cancel and a replayed answer then mean the same whichever
 * worker the request lands on — the path a deployment with its own shared store already takes. One process keeps
 * its own map.
 */
const withFleetKv = (config: ActionsConfig): ActionsConfig => {
  if (config.kv) {
    return config;
  }

  // One store either way, made HERE: the runner, the guards and the module's own `kv` are handed the same adapter —
  // left to default each, they made a Map apiece, and a key a flow wrote was not the key a guard or a webhook read.
  return { ...config, kv: fleetStore<ActionKvAdapter>('actions.kv', KV_METHODS) ?? createMemoryKv() };
};

export const createActionsModule = (given: ActionsConfig): ActionsModule => {
  const config = withFleetKv(given);
  // The plugins' server halves this server ships: a table a development server changes as their code does.
  const plugins = new Map(Object.entries(config.functions?.plugins ?? {}));
  const build = (from: ReadonlyMap<string, FunctionsDefinition>): ActionTaskRegistry =>
    createTaskRegistry(config.functions?.native, {
      db: (config.dbDrivers?.length ?? 0) > 0,
      plugins: Object.fromEntries(from)
    });
  let current = build(plugins);
  // Handed out once and read through, so whoever holds it — a space's registry, the catalog — sees a plugin replaced.
  const registry: ActionTaskRegistry = { get: name => current.get(name), list: () => current.list() };
  const spaceRegistries = createSpaceRegistries(registry, config.functions);
  const reserved = (): ReadonlySet<string> => new Set(current.list().map(task => task.namespace));
  // Asked whenever the deployment answers it: a space's code may run in the sandbox or in a runtime of its own.
  const registryFor = async (spaceId: number, at?: SpaceRevision): Promise<ActionTaskRegistry> => {
    const [functions, plugins] = await Promise.all([
      config.lookups.getFunctions?.(spaceId, at),
      config.lookups.getPluginFunctions?.(spaceId, at)
    ]);

    return spaceRegistries.registryFor(functions, plugins);
  };
  // A run whose every step is the deployment's never asks for the space's functions: most runs, and no lookup.
  const registryForRun = (request: ActionRunRequest): ActionTaskRegistry | Promise<ActionTaskRegistry> =>
    Object.values(request.entry.document.nodes).every(
      node => node.type !== 'task' || !node.action || registry.get(node.action)
    )
      ? registry
      : registryFor(request.spaceId, request.at);
  const { runAction, taskContext } = createActionRunner(config, registryForRun, config.fetchImpl);
  const routes = createRoutes({
    config: config.functions ?? {},
    plugins: () => plugins,
    ...(config.lookups.getFunctions ? { getFunctions: config.lookups.getFunctions } : {}),
    ...(config.lookups.getPluginFunctions ? { getPluginFunctions: config.lookups.getPluginFunctions } : {}),
    taskContext
  });
  /**
   * Single-flight over the store the deployment already gave the `kv` tasks — its own Redis, table or whatever it
   * runs — because per process it is not a guarantee: the same double-click behind a load balancer lands on two
   * replicas and both run. With none configured this is one process's Map, which is exactly right for one.
   */
  const guards = createRunGuards(config.concurrency, config.kv, config.idempotency);
  const kv = createKvStore(config.kv ?? createMemoryKv());
  const limitsFor = (document: ActionDocument) => resolveLimits(config.limits, document.limits);
  const module: ActionsModule = {
    runAction,
    registry,
    registryFor,
    routeFor: routes.routeFor,
    prepareFunctions: (source, scope) => {
      const runner = config.functions?.runner;

      return runner
        ? prepareFunctions(source, runner, reserved(), functionCeilings(config.functions?.limits), scope)
        : Promise.resolve({ ok: false, problems: [{ message: 'This server runs no space functions' }] });
    },
    readManifest: declared => readManifest(declared, reserved(), functionCeilings(config.functions?.limits)),
    guards,
    kv: spaceId => namespaceKv(kv, spaceId),
    limitsFor,
    setPluginFunctions: (plugin, definition) => {
      const next = new Map(plugins);
      if (definition) {
        next.set(plugin, definition);
      } else {
        next.delete(plugin);
      }

      // Built first, so a plugin that does not check out throws here and leaves the running one as it was.
      current = build(next);
      plugins.clear();
      next.forEach((value, key) => plugins.set(key, value));
    }
  };

  if (config.jobs !== false && config.lookups.listActions) {
    module.jobs = createActionJobs(config.jobs ?? {}, module, config.lookups);
  }

  return module;
};

export { ActionRefusal, ActionRunError } from './runtime/errors';
export { precheckRun } from './runtime/precheck';
export { spaceKvPatterns } from './runtime/namespaceKv';
export { checkAction } from './runtime/check';
export { DEFAULT_LIMITS, resolveLimits } from './runtime/limits';
export { createRunGuards, deriveRunKey } from './runtime/guards';
export { createActionJobs, createJobWorker, createMemoryJobQueue, createScheduler } from './jobs';
export { createMemoryKv } from './runtime/memoryKv';
export { createRunLogger, createRejectLogger } from './runtime/runLogger';
export { createTaskRegistry, taskName } from './tasks/registry';
export { describeCatalog, describeTask } from './taskCatalog';
export { handleActionCall } from './transport/callHandler';
export { handleActionCatalog } from './transport/catalogHandler';
export { handleActionWebhook } from './transport/webhookHandler';
export { verifySignature } from './transport/verifySignature';
export { handleActionCancel } from './transport/cancelHandler';

export type { ActionJobs, JobWorker, JobWorkerOptions, Scheduler, SchedulerOptions, SweepResult } from './jobs';
export type { ActiveRun, RunGuards } from './runtime/guards';
export type { ActionTaskDescriptor } from './taskCatalog';
export type { TaskRegistryOptions } from './tasks/registry';
export type {
  ActionCredential,
  ActionDbDriver,
  ActionEmailConfig,
  ActionEmailDelivery,
  ActionEmailMessage,
  ActionEmailTransport,
  ActionJobsConfig,
  ActionKvStore,
  ActionLookups,
  ActionRejectRecord,
  ActionRunRecord,
  ActionRunRequest,
  ActionRunResult,
  ActionsConfig,
  ActionTask,
  ActionTaskContext,
  ActionTaskOrigin,
  ActionTaskRegistry,
  RegisteredTask,
  ResolvedConnector
} from './types';
