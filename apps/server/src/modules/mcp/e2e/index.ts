/** An MCP Apps host in two halves, so the App can be exercised without Claude Desktop or ChatGPT: the CONNECTOR
 *  (a real MCP client over Streamable HTTP) and the RENDERER (the ui:// page in a DOM, driven by AppBridge). */

export { readAppPage, startMcpEndpoint } from './mcpEndpoint';
export { startRenderingHost } from './renderingHost';

export type { AppPage, McpEndpoint } from './mcpEndpoint';
export type { RenderingHost } from './renderingHost';
