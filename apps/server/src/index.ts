export { createSSRServer } from './core/createServer';
export { createJsonAdapters } from './adapters/jsonAdapters';
export {
  tools,
  toolResponseOk,
  toolResponseErr,
  zodToJsonSchema,
  getAllowedModes,
  bindTools,
  isToolActive,
  resolveToolHandler
} from './modules/mcp-legacy';
export { AIEngine } from './modules/ai';

export { createMcpServer, handleMcp, serveMcp, readMcpBody } from './modules/mcp';

export type { JsonAdaptersConfig } from './adapters/jsonAdapters';
export type { McpState } from './modules/mcp';
