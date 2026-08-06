/** The HTTP kernel: everything needed to stand up a Plitzi server that is NOT a page server, and nothing else.
 *
 *  Import it as `@plitzi/sdk-server/kernel`. The package root is a barrel over the render path (SSR, RSC,
 *  plugins, React), and ESM re-exports load eagerly — so a sibling server package that pulled `createHttpServer`
 *  from there would load that whole graph. This entry's closure is the dispatcher, the transports and the base
 *  stages: no React, no template, no plugin manager.
 *
 *  A server built on it supplies its own pipeline; `@plitzi/sdk-mcp` is the in-tree example. */

export { createHttpServer } from './core/server/baseServer';
export { makeHandler } from './core/http/dispatcher';
export { healthStage } from './core/http/stages/health';
export { builtinPublicStage, configStaticStage, publicDirStage, wellKnownStage } from './core/http/stages/static';
export { buildHealthPayload, registerHealthCheck } from './core/health';
export { clientIp, parseRequest, readRawBody, requestOrigin } from './core/requestParser';
export { consoleLogger, renderLogEvent } from './helpers/serverLog';
export { PREVIEW_TOKEN_PARAM } from './core/previewToken';

export type { HttpServerParts } from './core/server/baseServer';
export type { BuildContext } from './core/http/dispatcher';
export type { HealthCheckApp, HealthIdentity } from './core/health';
export type { BaseContext, PipelineExtensions, SSRContext, Stage } from './core/http/types';
