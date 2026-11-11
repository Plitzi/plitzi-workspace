/**
 * `@plitzi/sdk-kernel`: what every Plitzi server process is built on, and nothing else (docs/en/server-packages.md).
 *
 * Its entries are its folders, each imported on its own so a process loads only what it uses:
 *
 * - `./http`: the server, the pipeline and its stages, health, drain, the fleet of workers, security headers
 * - `./identity`: who a request is — session cookies, CSRF, origins; who may reach what
 * - `./tokens`: minting and verifying tokens (it loads `jsonwebtoken`, which the rest does not)
 * - `./deployment`: which deployment a request's host is
 * - `./cache`: the bounded caches a server keeps
 * - `./log`, `./outbound`, `./build`: the server's log, where a request somebody else wrote may go, esbuild
 * - `./testing`: what the packages built on this test with
 *
 * The root carries the types a server is written against, and no code.
 */
export type { BaseContext, BuildContext, HttpServer, HttpServerParts, Stage } from './http';
export type { DeployedContext, DeploymentAdapters } from './deployment';
