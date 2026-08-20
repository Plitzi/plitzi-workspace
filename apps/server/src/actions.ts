/**
 * Server actions, for the deployment that supplies them.
 *
 * Its own entry, and not part of the barrel, for the same reason `mysql` is: what a deployment needs here is the
 * task contract and the run types, and reaching for them through the package root would load the whole render
 * path to get at a type. A page server that runs no actions never touches this file.
 *
 * The server builds the module itself from `action.lookups` — that is not a deployment's call — so what is
 * exported is what a deployment writes AGAINST: its own tasks, and the shapes its lookups must answer.
 */
/**
 * Builds a runner outside a page server.
 *
 * The page server builds its own from `action.lookups`; this is for the deployment that needs to run an action
 * from somewhere else — a scheduler, a queue consumer, or the API role answering a builder's test run. Same
 * runner, same checks: a trigger that skipped them would be a weaker path to the same work.
 */
export { createActionsModule } from './modules/actions';
export { createScheduleRunner } from './modules/actions/runtime/schedule';
export { cronMatches, parseCron } from './modules/actions/runtime/cron';
export { ActionRunError } from './modules/actions/runtime/errors';
export { DEFAULT_LIMITS } from './modules/actions/runtime/limits';
export { createTaskRegistry, taskName } from './modules/actions/tasks/registry';
export { describeCatalog, describeTask } from './modules/actions/taskCatalog';

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
} from './modules/actions/types';

export type { ActionsModule } from './modules/actions';
export type { ActiveRun, RunGuards } from './modules/actions/runtime/guards';
export type { ScheduleResult, ScheduleRunner, ScheduleTick } from './modules/actions/runtime/schedule';
export type { ActionTaskDescriptor } from './modules/actions/taskCatalog';
