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
/**
 * Cron, straight from `sdk-shared`, where the parser lives because the validator needs it too.
 *
 * Re-exported HERE and nowhere in between: a deployment mounting its own scheduler reaches for one package, and
 * the file that used to sit in `runtime/` existed only so a neighbouring import could look local.
 */
export { cronMatches, parseCron } from '@plitzi/sdk-shared/actions';
/**
 * What only this deployment can answer about an action, before anybody runs it: a task it does not register, a
 * credential the space has not got, a key missing from the one it has, a connector that was deleted, an engine
 * with no driver, a cron that will never fire. The document validator in `sdk-shared` catches the other half.
 */
export { checkAction } from './modules/actions/runtime/check';
export type { ActionCheckDeps } from './modules/actions/runtime/check';
export { ActionRunError } from './modules/actions/runtime/errors';
export { DEFAULT_LIMITS } from './modules/actions/runtime/limits';
export { createTaskRegistry, taskName } from './modules/actions/tasks/registry';
export { describeCatalog, describeTask } from './modules/actions/taskCatalog';

/**
 * The `kv` seam: an ADAPTER a deployment fills, and the logic that sits on top of it.
 *
 * There is deliberately nothing here that talks to a store — no Redis, no database, no client of any kind. A
 * deployment passes five string operations over whatever it already runs, and `createKvStore` supplies everything
 * that decides how a counter behaves, so the rule a rate limit depends on is written once rather than once per
 * deployment. The in-process Map is the same shape, which is why the default and a cluster's store behave
 * identically instead of nearly so.
 */
export { createMemoryKv } from './modules/actions/runtime/memoryKv';
export { createKvStore } from './modules/actions/runtime/kvStore';

/**
 * `onRun` and `onReject` for a deployment that wants to SEE its flows without building somewhere to keep them: a
 * run — and a request that never became one — becomes one more event on the log stream the server already
 * reports through.
 *
 * The two are separate hooks because they are separate questions. A deployment that keeps run history in a table
 * and still wants refusals on the log stream wires one of each; that is the normal shape, not a workaround.
 */
export { createRunLogger, createRejectLogger } from './modules/actions/runtime/runLogger';

export type {
  ActionCredential,
  ActionDbDriver,
  ActionKvAdapter,
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
} from './modules/actions/types';

export type { ActionsModule } from './modules/actions';
export type { ActiveRun, RunGuards } from './modules/actions/runtime/guards';
export type { ScheduleResult, ScheduleRunner, ScheduleTick } from './modules/actions/runtime/schedule';
export type { ActionTaskDescriptor } from './modules/actions/taskCatalog';
