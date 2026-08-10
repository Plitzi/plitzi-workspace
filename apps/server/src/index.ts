export { createServer, resolveServices } from './core/createServer';
export { registerHealthCheck, buildHealthPayload } from './core/health';
export { consoleLogger, renderLogEvent } from './helpers/serverLog';
export type { HealthCheckApp, HealthIdentity } from './core/health';
export { createJsonAdapters } from './adapters/jsonAdapters';
export { createAuthAdapters } from './adapters/authAdapters';
// Draft-preview primitives: the token param and the default store. The endpoint that MINTS a draft lives in
// `@plitzi/sdk-mcp` — applying unsaved operations is the tool engine's job, not the renderer's.
export { createMemoryDraftStore, takeDraftOverride } from './modules/ssr/preview';
export { PREVIEW_TOKEN_PARAM } from './core/previewToken';
export { resolveRscData } from './modules/rsc/resolveRscData';
export {
  fetchConnectorRecords,
  rebaseMedia,
  writeConnectorRecord,
  createConnectorResolver
} from './modules/connectors';

export type { JsonAdaptersConfig } from './adapters/jsonAdapters';
export type { AuthAdapters, AuthAdaptersConfig } from './adapters/authAdapters';
export type { RscElementResolver, RscResolveContext, ResolveRscDataOptions } from './modules/rsc/resolveRscData';
export type {
  ConnectorAuth,
  ConnectorCredential,
  ConnectorEndpoints,
  ConnectorFilter,
  ConnectorLookups,
  ConnectorManifest,
  ConnectorManifestDraft,
  ConnectorPageInfo,
  ConnectorPagination,
  ConnectorQuery,
  ConnectorReadEndpoint,
  ConnectorRecord,
  ConnectorResponseMapping,
  ConnectorResult,
  ProviderPagination
} from './modules/connectors';
export type { ResolvedServices } from './core/createServer';
export type { BaseContext, PipelineExtensions, SSRContext, Stage } from './core/http/types';
