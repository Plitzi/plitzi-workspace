// What both sides of the wire between the platform and a space's own code speak (plitzi-workspace RFC 0032 D5): the
// runner's messages, `ctx` and its vocabulary. It loads no other package: a runner, the platform and the builder's
// editor (its types) all read it. The wire helpers encode bodies with Node's `Buffer`, so they run on a server.
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
  FunctionOAuthRefusal,
  FunctionOAuthStatus,
  FunctionOAuthToken,
  FunctionPresence,
  FunctionRoute,
  FunctionRouteContext,
  FunctionsDefinition,
  FunctionTask,
  FunctionUser,
  FunctionVisitor
} from './contract';
export { defineFunctions } from './contract';
export type { ActionKvStore, KvListEntry, KvListPut, KvListPutOptions, KvListRange } from './kv';
export { changeKv, changeListEntry } from './kvChange';
export type { KvChangeLifetime, KvChangeOptions, KvChangeStore, KvListChangeStore } from './kvChange';
export type { LaterAnswer, LaterRequest } from './later';
export { readRequestMessage, readResponseMessage } from './messages';
export {
  errorOfAnswer,
  failedAnswerOf,
  FUNCTIONS_PROTOCOL,
  FunctionFailure,
  isFunctionLimit,
  isStreamedRouteAnswer,
  protocolKnows,
  protocolRefusal
} from './protocol';
export type {
  FunctionAnswer,
  FunctionCall,
  FunctionFailureReason,
  FunctionInvocation,
  FunctionInvocationContext,
  FunctionInvokeRequest,
  FunctionJobSlice,
  FunctionLimitReason,
  FunctionLimits,
  FunctionRunner,
  FunctionsBundle,
  FunctionsBundleRef,
  FunctionStopReason,
  FunctionUsage,
  RunnerRequestMessage,
  RunnerResponseMessage,
  SpaceFunctions,
  StreamedRouteAnswer,
  WireBody,
  WireFetchInit,
  WireHeaders,
  WireRequest,
  WireResponse
} from './protocol';
export type { RateCount, RateLimit } from './rateLimit';
export { ActionRefusal, isActionRefusal, refusalCodeOf } from './refusal';
export {
  bodyOf,
  requestFromWire,
  responseOf,
  wireBodyOf,
  wireRequestOf,
  wireResponseFrom,
  wireResponseOf
} from './wire';
export { endpointFor, endpointProblem, PLATFORM_HEADERS, RUNTIME_DESCRIBE_PATH } from './runtime';
export type { SpaceRuntime, SpaceRuntimeContext, SpaceRuntimeEndpoint, SpaceRuntimeParts } from './runtime';
