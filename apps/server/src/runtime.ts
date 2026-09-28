/**
 * Space runtimes: a space's own server code run as code of its own, beside the platform that serves the space — for
 * what the sandbox's functions cannot be (Node, its dependencies, connections that stay open, endpoints that stream).
 * The contract a runtime module is written against, the host that runs one for the platform, how one is packed to
 * travel, and the stages that serve one: on a server of its own (`serveRuntime`), or forwarded to (`createRuntimeProxyStage`).
 */
export { defineRuntime, endpointFor, endpointProblem } from './modules/runtime/contract';
export type {
  SpaceRuntime,
  SpaceRuntimeContext,
  SpaceRuntimeEndpoint,
  SpaceRuntimeParts
} from './modules/runtime/contract';
export { RUNTIME_DESCRIBE_PATH, startSpaceRuntime } from './modules/runtime/host';
export type { SpaceRuntimeDescription, SpaceRuntimeHost, SpaceRuntimeHostOptions } from './modules/runtime/host';
export {
  inspectRuntime,
  loadRuntime,
  MAX_RUNTIME_BUNDLE_BYTES,
  packRuntime,
  runtimeBundleId
} from './modules/runtime/bundle';
export { createRuntimeRunner } from './modules/runtime/runner';
export { createRuntimeProxyStage, runtimeEndpointsStage, serveRuntime } from './modules/runtime/stages';
export type { RuntimeProxyConfig, RuntimeTarget, ServedRuntime } from './modules/runtime/stages';
