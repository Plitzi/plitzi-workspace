export { createServer, createSSRServer, createMCPServer, resolveServices } from './core/createServer';
export { registerHealthCheck, buildHealthPayload } from './core/health';
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
  resolveToolHandler
} from './modules/ai';

// mcp-ai server + its tool functions (also runnable in-process, e.g. wrapped as agent tools by a consumer).
export { createMcpServer, handleMcp, serveMcp, readMcpBody } from './modules/mcp';
export {
  apply,
  search,
  read,
  validate,
  applyShape,
  searchShape,
  readShape,
  validateShape,
  operation
} from './modules/mcp/tools';

export type { JsonAdaptersConfig } from './adapters/jsonAdapters';
export type { ResolvedServices } from './core/createServer';
export type { McpServerContext } from './modules/mcp';
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
  Operation
} from './modules/mcp/tools';
export type { Space } from './modules/mcp/helpers';
export type { Env } from './modules/mcp/types';
