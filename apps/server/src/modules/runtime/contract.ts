import { FUNCTION_ROUTES_PREFIX } from '@plitzi/sdk-shared/actions';

import type { FunctionsDefinition } from '../functions/contract';

/** What a runtime starts with. */
export type SpaceRuntimeContext = {
  /** Its variables: those the platform keeps for it (`REDIS_URL`…), or a self-hosted server's own environment. */
  env: Readonly<Record<string, string | undefined>>;
  /** Where people reach the space — what a link written for a person, or an agent, is handed. */
  publicUrl: string;
};

/**
 * A path of the space's own answered by the runtime: a web handler, streaming if it likes — an agent's endpoint, a
 * webhook that speaks a protocol of its own. The visitor's cookies and `Authorization` never reach it: the host's are
 * the platform's.
 */
export type SpaceRuntimeEndpoint = (request: Request) => Response | Promise<Response>;

/** What a started runtime is made of. */
export type SpaceRuntimeParts = {
  /** Its tasks and `/fn/` routes, run with a `ctx` that is the platform's — the space's `kv`, its channels, its key. */
  functions?: FunctionsDefinition;
  /** Paths it answers itself, each with everything beneath it (`/mcp` answers `/mcp/…`) — see {@link endpointProblem}. */
  endpoints?: Record<string, SpaceRuntimeEndpoint>;
  /** Called when it is stopped: close what `start` opened. */
  close?: () => Promise<void>;
};

/**
 * A space's own server code, run as code of its own — Node, its dependencies, its connections — beside the platform
 * that serves the space: a runtime of the space, where the sandbox's functions are not enough. `start` is handed its
 * variables and answers what it serves.
 */
export type SpaceRuntime = {
  start: (context: SpaceRuntimeContext) => SpaceRuntimeParts | Promise<SpaceRuntimeParts>;
};

/** Declares a space runtime — an identity, for the types: `export default defineRuntime({ start: … })`. */
export const defineRuntime = (runtime: SpaceRuntime): SpaceRuntime => runtime;

/** The paths the server answers itself, which no endpoint may take: its routes, its own endpoints and sign-in. */
const RESERVED = [FUNCTION_ROUTES_PREFIX, '/_', '/auth', '/.well-known'];

/** Why a path cannot be an endpoint — or nothing, for one that can. */
export const endpointProblem = (path: string): string | undefined => {
  if (!/^\/[A-Za-z0-9._~-]+(\/[A-Za-z0-9._~-]+)*$/.test(path)) {
    return `"${path}" is not an endpoint path: it starts with "/" and is made of plain segments`;
  }

  const taken = RESERVED.find(
    prefix => path === prefix || path.startsWith(prefix.endsWith('_') ? prefix : `${prefix}/`)
  );
  if (taken) {
    return `"${path}" is the server's own (${taken}): an endpoint takes a path of the space's`;
  }

  return undefined;
};

/** The endpoint a request's path belongs to: exactly it, or beneath it — the longest that does. */
export const endpointFor = (paths: readonly string[], path: string): string | undefined =>
  paths
    .filter(candidate => path === candidate || path.startsWith(`${candidate}/`))
    .sort((a, b) => b.length - a.length)[0];
