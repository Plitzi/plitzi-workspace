import { renderApp } from './render';
import { registerApp } from './shared/app';

import type { McpApp } from './shared/app';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/** Every MCP App this server serves. A new one is a folder beside `render/` (its definition + its view) and one
 *  line here — the tool that opens it points at its `uri` through `ui: { resourceUri }`. Start from `example/`,
 *  which is that same shape stripped to the minimum. */
export const apps: McpApp[] = [renderApp];

export const registerApps = (server: McpServer): void => {
  for (const app of apps) {
    registerApp(server, app);
  }
};

export { RENDER_APP_URI } from './render';
export type { McpApp } from './shared/app';
