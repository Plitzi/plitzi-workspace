export { createSSRServer } from './core/createServer';
export { createJsonAdapters } from './adapters/jsonAdapters';
export {
  tools,
  toolDefinitions,
  readMcpBody,
  handleMcp,
  createMcpServer,
  getToolDefinitions,
  getToolDefinition
} from './modules/mcp';

export type { JsonAdaptersConfig } from './adapters/jsonAdapters';
