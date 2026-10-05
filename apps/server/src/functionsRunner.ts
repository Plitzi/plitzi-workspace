/**
 * Running the spaces' functions: the runner service (its own process, holding nothing), the platform's client to it,
 * and the isolates both are made of. Its own entry, apart from the contract, so a space's code and a self-hosted
 * server's native functions never load a line of it — nor need `isolated-vm` or `core-js`, which only the process
 * that runs isolates installs.
 *
 * `buildFunctions` is the build every runner runs first, on its own: what `plitzi doctor` checks a project's
 * `src/functions/` with, by the rules of the sdk-server the project installed.
 */
export { startFunctionsRunnerService } from './modules/functions/runner/service';
export type { FunctionsRunnerService, FunctionsRunnerServiceOptions } from './modules/functions/runner/service';
export { createRemoteRunner } from './modules/functions/runner/remote';
export type { RemoteRunnerOptions } from './modules/functions/runner/remote';
export { createIsolateRunner } from './modules/functions/sandbox/isolate';
export type { IsolateRunnerOptions } from './modules/functions/sandbox/isolate';
export { FUNCTIONS_PROTOCOL, FunctionFailure } from './modules/functions/protocol';
export { createLocalFunctions } from './modules/functions/local';
export type { LocalFunctions, LocalFunctionsOptions } from './modules/functions/local';
export { buildFunctions, FunctionsBuildError } from './modules/functions/build';
export type { FunctionsBuild, FunctionsSource } from './modules/functions/build';
