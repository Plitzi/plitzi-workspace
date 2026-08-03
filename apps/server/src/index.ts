export { createServer, createSSRServer, createMCPServer, resolveServices } from './core/createServer';
export { registerHealthCheck, buildHealthPayload } from './core/health';
export { consoleLogger, renderLogEvent } from './helpers/serverLog';
export type { HealthCheckApp, HealthIdentity } from './core/health';
export { createJsonAdapters } from './adapters/jsonAdapters';
export {
  AIEngine,
  toolResponseOk,
  toolResponseErr,
  zodToJsonSchema,
  getAllowedModes,
  bindTools,
  isToolActive,
  resolveToolHandler,
  isCallToolResult,
  toolResponseFromResult
} from './modules/ai';

// mcp-ai server + its tool functions (also runnable in-process, e.g. wrapped as agent tools by a consumer).
export {
  createMcpServer,
  handleMcp,
  serveMcp,
  readMcpBody,
  buildAgentGuide,
  createHttpPreviewClient,
  createHttpScreenshotClient
} from './modules/mcp';
// Draft-preview primitives: the in-process render + the default token store (consumers inject a shared store).
export { createPreview, createMemoryDraftStore, PREVIEW_TOKEN_PARAM } from './modules/ssr/preview';
export { resolveRscData } from './modules/rsc/resolveRscData';
export {
  fetchConnectorRecords,
  rebaseMedia,
  writeConnectorRecord,
  createConnectorResolver
} from './modules/connectors';
export {
  apply,
  search,
  read,
  validate,
  applyShape,
  searchShape,
  readShape,
  validateShape,
  operation,
  tools
} from './modules/mcp/tools';

export type { JsonAdaptersConfig } from './adapters/jsonAdapters';
export type { RscElementResolver, RscResolveContext, ResolveRscDataOptions } from './modules/rsc/resolveRscData';
export type {
  ConnectorAuth,
  ConnectorCredential,
  ConnectorFilter,
  ConnectorList,
  ConnectorLookups,
  ConnectorManifest,
  ConnectorPageInfo,
  ConnectorPagination,
  ConnectorQuery,
  ConnectorRecord,
  ConnectorResult,
  ProviderPagination
} from './modules/connectors';
export type { ResolvedServices } from './core/createServer';
export type {
  McpServerContext,
  McpRequestOptions,
  PreviewClient,
  PreviewRequestBody,
  PreviewResult,
  HttpPreviewClientConfig,
  ScreenshotClient,
  ScreenshotImage,
  ScreenshotResult,
  Viewport,
  HttpScreenshotClientConfig
} from './modules/mcp';
export type {
  ApplyInput,
  SearchInput,
  SearchResponse,
  SearchHit,
  ReadInput,
  ReadResponse,
  ReadHit,
  ValidateInput,
  WriteResponse,
  WriteElement,
  Persisters,
  Operation,
  ToolDef,
  ToolContext
} from './modules/mcp/tools';
export type { Space } from './modules/mcp/helpers';
export type { Env } from './modules/mcp/types';
