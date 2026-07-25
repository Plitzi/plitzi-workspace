/** The MCP role's entry point: everything an MCP deployment wires, and nothing else.
 *
 *  Import it as `@plitzi/sdk-server/mcp`. The package root is a barrel over every service (SSR, RSC, plugins, the
 *  AI engine…), so pulling `createMCPServer` from there makes the process load that whole graph — including the
 *  React element packages its types come from — where this entry loads only the MCP server. */

export { createMCPServer } from './core/server/mcpServer';
export { createMcpServer, handleMcp, serveMcp, readMcpBody } from './modules/mcp/handler';
export { createHttpPreviewClient } from './modules/mcp/previewClient';
export { createHttpScreenshotClient } from './modules/mcp/screenshotClient';

export type { McpRequestOptions } from './modules/mcp/handler';
export type { McpServerContext } from './modules/mcp/server';
export type { PreviewClient, ScreenshotClient } from './modules/mcp/types';
export type { HealthIdentity } from './core/health';
