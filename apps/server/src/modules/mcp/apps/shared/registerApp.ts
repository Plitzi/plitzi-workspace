import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';

import { page } from './page';

import type { McpApp } from './types';
import type { McpUiResourceCsp, McpUiResourceMeta } from '@modelcontextprotocol/ext-apps';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// The page fetches nothing, so this only covers what a VIEW may reference at runtime. Kept open to stay
// zero-config; the sandbox's origin isolation is the real boundary.
const DEFAULT_CSP: McpUiResourceCsp = { resourceDomains: ['*', 'data:', 'blob:'], connectDomains: ['*'] };

/** Serves the app as a self-contained page: no import map, no asset mounts, no cross-origin fetches, so the
 *  strictest host sandbox runs it and no deployment has to serve anything extra. */
export const registerApp = (server: McpServer, app: McpApp): void => {
  const meta: { ui: McpUiResourceMeta } = { ui: { csp: app.csp ?? DEFAULT_CSP } };

  registerAppResource(server, app.name, app.uri, { description: app.description, _meta: meta }, async () => ({
    contents: [{ uri: app.uri, mimeType: RESOURCE_MIME_TYPE, text: await page(app), _meta: meta }]
  }));
};
