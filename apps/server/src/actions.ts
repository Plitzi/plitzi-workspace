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
export { ActionRunError } from './modules/actions/runtime/errors';
export { DEFAULT_LIMITS } from './modules/actions/runtime/limits';
export { taskName } from './modules/actions/tasks/registry';

export type {
  ActionCredential,
  ActionLookups,
  ActionRunRequest,
  ActionRunResult,
  ActionsConfig,
  ActionTask,
  ActionTaskContext,
  ActionTaskRegistry,
  RegisteredTask
} from './modules/actions/types';

export type { ActiveRun, RunGuards } from './modules/actions/runtime/guards';
