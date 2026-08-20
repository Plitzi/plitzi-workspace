import { createRunGuards } from './runtime/guards';
import { resolveLimits } from './runtime/limits';
import { createActionRunner } from './runtime/runAction';
import { createTaskRegistry } from './tasks/registry';

import type { RunGuards } from './runtime/guards';
import type { ActionRunner } from './runtime/runAction';
import type { ActionsConfig, ActionTaskRegistry, ResolvedActionLimits } from './types';
import type { ActionDocument } from '@plitzi/sdk-shared';

export type ActionsModule = ActionRunner & {
  registry: ActionTaskRegistry;
  guards: RunGuards;
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
  const registry = createTaskRegistry(config.tasks);
  const { runAction } = createActionRunner(config, registry, config.fetchImpl);
  const guards = createRunGuards(config.concurrency);

  return {
    runAction,
    registry,
    guards,
    limitsFor: document => resolveLimits(config.limits, document.limits)
  };
};

export { ActionRunError } from './runtime/errors';
export { precheckRun } from './runtime/precheck';
export { DEFAULT_LIMITS, resolveLimits } from './runtime/limits';
export { createRunGuards, deriveRunKey } from './runtime/guards';
export { createMemoryKv } from './runtime/memoryKv';
export { createTaskRegistry, taskName } from './tasks/registry';
export { describeCatalog, describeTask } from './taskCatalog';
export { handleActionCall } from './transport/callHandler';
export { handleActionCatalog } from './transport/catalogHandler';
export { handleActionCancel } from './transport/cancelHandler';

export type { ActiveRun, RunGuards } from './runtime/guards';
export type { ActionTaskDescriptor } from './taskCatalog';
export type {
  ActionCredential,
  ActionKvStore,
  ActionLookups,
  ActionRunRequest,
  ActionRunResult,
  ActionsConfig,
  ActionTask,
  ActionTaskContext,
  ActionTaskRegistry,
  RegisteredTask,
  ResolvedConnector
} from './types';
