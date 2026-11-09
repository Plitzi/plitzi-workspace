/**
 * `@plitzi/sdk-runtime`: the contract a space's own code is written against, and what runs it with no access (RFC 0032).
 *
 * The root is the contract alone — what a space's functions and its runtime import, the same file whether a self-hosted
 * server loads it natively or the platform runs it in its sandbox:
 *
 * - `defineFunctions`, `ActionRefusal` and the `ctx` they are handed;
 * - `defineRuntime`, for a space's code that runs as a process of its own.
 *
 * What runs it is in its own entries, so the code a space writes loads none of it:
 *
 * - `./runner`: the functions runner service and its isolates;
 * - `./host`: the host a space's runtime runs in.
 */
export { ActionRefusal, defineFunctions } from '@plitzi/sdk-shared/functions';
export { defineRuntime } from './contract/runtime';

export type {
  FunctionContext,
  FunctionFetch,
  FunctionFetchInit,
  FunctionJob,
  FunctionJobHandle,
  FunctionJobs,
  FunctionJobStop,
  FunctionOAuth,
  FunctionOAuthOwner,
  FunctionOAuthStatus,
  FunctionOAuthToken,
  FunctionRoute,
  FunctionRouteContext,
  FunctionsDefinition,
  FunctionTask,
  FunctionUser
} from '@plitzi/sdk-shared/functions';
export type {
  SpaceRuntime,
  SpaceRuntimeContext,
  SpaceRuntimeEndpoint,
  SpaceRuntimeParts
} from '@plitzi/sdk-shared/functions';
