/** The MCP role's entry point: everything a dedicated MCP deployment wires, and nothing else.
 *
 *  Import it as `@plitzi/sdk-mcp/server`. The package root also carries the draft-preview endpoint, and that one
 *  reaches into the SSR render primitives — a dedicated MCP process constructs none of those, so pulling
 *  `createServer` from the barrel would load the page renderer and React with it. This entry loads the MCP
 *  server alone. */

export { createServer } from './createServer';
export { buildMCPPipeline } from './pipeline';
export { createMcpServer, handleMcp, serveMcp, readMcpBody } from './modules/mcp/handler';
export { createHttpPreviewClient } from './modules/mcp/previewClient';
export { createHttpScreenshotClient } from './modules/mcp/screenshotClient';

export type { McpRequestOptions } from './modules/mcp/handler';
export type { McpServerContext } from './modules/mcp/server';
export type { PreviewClient, ScreenshotClient } from './modules/mcp/types';
export type { McpOptions, McpProxyOptions } from './options';
