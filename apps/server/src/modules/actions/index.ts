import { createRunGuards } from './runtime/guards';
import { resolveLimits } from './runtime/limits';
import { createMemoryKv } from './runtime/memoryKv';
import { namespaceKv } from './runtime/namespaceKv';
import { createActionRunner } from './runtime/runAction';
import { createTaskRegistry } from './tasks/registry';

import type { RunGuards } from './runtime/guards';
import type { ActionRunner } from './runtime/runAction';
import type { ActionKvStore, ActionsConfig, ActionTaskRegistry, ResolvedActionLimits } from './types';
import type { ActionDocument } from '@plitzi/sdk-shared';

export type ActionsModule = ActionRunner & {
  registry: ActionTaskRegistry;
  guards: RunGuards;
  /** The key/value store, namespaced to one space — the same one the `kv` tasks write through, so a rate limit the
   *  transport keeps and a counter a flow keeps cannot end up in different places. */
  kv: (spaceId: number) => ActionKvStore;
  /** What this server will allow one run of that document to spend — the deployment's ceilings, tightened by it. */
  limitsFor: (document: ActionDocument) => ResolvedActionLimits;
};

/**
 * The module's whole public surface: build it once from the deployment's config, then run actions through it.
 *
 * Constructed rather than imported piecemeal so the task registry is validated ONCE, at boot, and so the guards
 * are a single set for the process — two instances would each think they were the only run in flight, which is
 * the same as having no single-flight at all. Nothing outside this folder needs to know how a run is assembled.
 */
export const createActionsModule = (config: ActionsConfig): ActionsModule => {
  const registry = createTaskRegistry(config.tasks, (config.dbDrivers?.length ?? 0) > 0);
  const { runAction } = createActionRunner(config, registry, config.fetchImpl);
  const guards = createRunGuards(config.concurrency);
  const kv = config.kv ?? createMemoryKv();

  return {
    runAction,
    registry,
    guards,
    kv: spaceId => namespaceKv(kv, spaceId),
    limitsFor: document => resolveLimits(config.limits, document.limits)
  };
};

export { ActionRunError } from './runtime/errors';
export { precheckRun } from './runtime/precheck';
export { DEFAULT_LIMITS, resolveLimits } from './runtime/limits';
export { createRunGuards, deriveRunKey } from './runtime/guards';
export { createScheduleRunner } from './runtime/schedule';
export { cronMatches, parseCron } from './runtime/cron';
export { createMemoryKv } from './runtime/memoryKv';
export { createTaskRegistry, taskName } from './tasks/registry';
export { describeCatalog, describeTask } from './taskCatalog';
export { handleActionCall } from './transport/callHandler';
export { handleActionCatalog } from './transport/catalogHandler';
export { handleActionWebhook } from './transport/webhookHandler';
export { verifySignature } from './transport/verifySignature';
export { handleActionCancel } from './transport/cancelHandler';

export type { ActiveRun, RunGuards } from './runtime/guards';
export type { ScheduleResult, ScheduleRunner, ScheduleTick } from './runtime/schedule';
export type { ActionTaskDescriptor } from './taskCatalog';
export type {
  ActionCredential,
  ActionDbDriver,
  ActionKvStore,
  ActionLookups,
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
