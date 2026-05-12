export { createSSRServer } from './core/createServer';
export { createJsonAdapters } from './adapters/jsonAdapters';
export { readMcpBody, handleMcp } from './modules/mcp/handler';
export * from './modules/mcp/server';

export type { JsonAdaptersConfig } from './adapters/jsonAdapters';
