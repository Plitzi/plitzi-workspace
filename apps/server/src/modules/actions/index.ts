import { createActionJobs } from './jobs';
import { createRunGuards } from './runtime/guards';
import { createKvStore } from './runtime/kvStore';
import { resolveLimits } from './runtime/limits';
import { createMemoryKv, KV_METHODS } from './runtime/memoryKv';
import { namespaceKv } from './runtime/namespaceKv';
import { createActionRunner } from './runtime/runAction';
import { createTaskRegistry } from './tasks/registry';
import { fleetStore } from '../../core/server/fleet/link';

import type { ActionJobs } from './jobs';
import type { RunGuards } from './runtime/guards';
import type { ActionRunner } from './runtime/runAction';
import type { ActionKvAdapter, ActionKvStore, ActionsConfig, ActionTaskRegistry, ResolvedActionLimits } from './types';
import type { ActionDocument } from '@plitzi/sdk-shared';

export type ActionsModule = ActionRunner & {
  registry: ActionTaskRegistry;
  guards: RunGuards;
  /** The key/value store, namespaced to one space — the same one the `kv` tasks write through, so a rate limit the
   *  transport keeps and a counter a flow keeps cannot end up in different places. */
  kv: (spaceId: number) => ActionKvStore;
  /** What this server will allow one run of that document to spend — the deployment's ceilings, tightened by it. */
  limitsFor: (document: ActionDocument) => ResolvedActionLimits;
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
  const registry = createTaskRegistry(config.tasks, { db: (config.dbDrivers?.length ?? 0) > 0 });
  const { runAction } = createActionRunner(config, registry, config.fetchImpl);
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
    guards,
    kv: spaceId => namespaceKv(kv, spaceId),
    limitsFor
  };

  if (config.jobs !== false && config.lookups.listActions) {
    module.jobs = createActionJobs(config.jobs ?? {}, module, config.lookups);
  }

  return module;
};

export { ActionRunError } from './runtime/errors';
export { precheckRun } from './runtime/precheck';
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
  ActionTaskRegistry,
  RegisteredTask,
  ResolvedConnector
} from './types';
