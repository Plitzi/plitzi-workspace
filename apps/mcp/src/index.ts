/** Everything this package offers: the MCP server, the tool engine that backs it, the AI engine a consumer wraps
 *  its own agent around, and the stages that mount all of it inside somebody else's page server.
 *
 *  A dedicated MCP deployment wants `@plitzi/sdk-mcp/server` instead — this barrel also pulls the draft-preview
 *  endpoint, which reaches into the SSR renderer. */

export { createServer } from './createServer';
export { buildMCPPipeline, mcpExtensions } from './pipeline';
export { createMcpOnlyStage, createMcpStage } from './stages/mcp';
export { createOAuthGuardStage, createOAuthStage } from './stages/oauth';
export { previewStage } from './stages/preview';
export { createWidgetProxyStage } from './stages/proxy';
export { createPreview } from './preview/createPreview';

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
  createHttpScreenshotClient,
  createLocalScreenshotClient,
  resolveLocalBrowser
} from './modules/mcp';
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
export type { McpOptions, McpProxyOptions } from './options';
