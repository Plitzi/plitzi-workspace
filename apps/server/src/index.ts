export { createSSRServer } from './core/createServer';
export { createJsonAdapters } from './adapters/jsonAdapters';
export {
  tools,
  toolResponseOk,
  toolResponseErr,
  readMcpBody,
  handleMcp,
  createMcpServer,
  zodToJsonSchema,
  getAllowedModes,
  bindTools,
  isToolActive,
  resolveToolHandler
} from './modules/mcp';
export { AIEngine } from './modules/ai';

export type { JsonAdaptersConfig } from './adapters/jsonAdapters';
