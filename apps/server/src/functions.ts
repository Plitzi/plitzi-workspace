/**
 * Functions: a server's own code, and the contract a space's code is written against — the same file whether a
 * self-hosted server loads it natively or the platform runs it in its sandbox. Its own entry so a space's code imports
 * the contract alone, and nothing that runs it.
 */
export { ActionRefusal, defineFunctions } from './modules/functions/contract';
export type {
  FunctionContext,
  FunctionFetch,
  FunctionFetchInit,
  FunctionRoute,
  FunctionRouteContext,
  FunctionsDefinition,
  FunctionTask,
  FunctionUser
} from './modules/functions/contract';
export type { FunctionsConfig, FunctionUsageRecord } from './modules/functions/config';
export { DEFAULT_FUNCTION_LIMITS } from './modules/functions/config';
/**
 * What the platform keeps of a space's functions, and what it hands a runner: the built bundle and what it declared
 * when it was saved (`prepareFunctions` on the actions module is the one way to make one).
 */
export type { FunctionsSource } from './modules/functions/build';
export type { FunctionsManifest, FunctionTaskManifest, FunctionsProblem } from '@plitzi/sdk-shared';
export type {
  FunctionInvocation,
  FunctionInvokeRequest,
  FunctionLimits,
  FunctionRunner,
  FunctionsBundle,
  FunctionStopReason,
  FunctionUsage,
  SpaceFunctions
} from './modules/functions/protocol';
export type { PreparedFunctions } from './modules/functions/space';
export { functionTryEntry, TRY_STEP } from './modules/functions/tryEntry';
