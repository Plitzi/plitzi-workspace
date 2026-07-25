import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { require } from '../shared';

import type { McpApp } from '../shared';

// The ui:// resource plitzi_render links to via _meta.ui.resourceUri. An MCP Apps host (Claude, Claude Desktop,
// ChatGPT, Goose…) fetches it and renders it in a sandboxed iframe, then pushes the tool result in.
export const RENDER_APP_URI = 'ui://plitzi/render.html';

// The view ships as source next to this module in dist too (see the copy-assets step in vite.config.ts).
const HERE = path.dirname(fileURLToPath(import.meta.url));

export const renderApp: McpApp = {
  uri: RENDER_APP_URI,
  name: 'plitzi-render-app',
  title: 'Plitzi widget',
  description: 'Interactive view that renders a plitzi_render widget with the Plitzi SDK.',
  entry: path.join(HERE, 'view.tsx'),
  // The widget paints with the SDK's own stylesheet, so it travels inline with the page.
  styles: () => [path.join(path.dirname(require.resolve('@plitzi/plitzi-sdk')), 'plitzi-sdk.css')]
};
