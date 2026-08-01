import { renderApp } from './render';
import { registerApp } from './shared';

import type { McpApp, McpViewSettings } from '../types';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/** What a view gets when the deployment says nothing: streaming on, because a host that streams no arguments
 *  paints exactly what it painted before. */
export const DEFAULT_VIEW_SETTINGS: McpViewSettings = { streaming: true };

/** Every MCP App this server serves. A new one is a folder beside `render/` (its definition + its view) and one
 *  line here — the tool that opens it points at its `uri` through `ui: { resourceUri }`. Start from `example/`,
 *  which is that same shape stripped to the minimum. */
export const apps: McpApp[] = [renderApp];

export const registerApps = (server: McpServer, settings: McpViewSettings = DEFAULT_VIEW_SETTINGS): void => {
  for (const app of apps) {
    registerApp(server, app, settings);
  }
};

export { iconFontCss, RENDER_APP_URI } from './render';
