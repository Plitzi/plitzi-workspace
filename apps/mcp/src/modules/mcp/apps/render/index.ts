import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { widgetCss } from './styles';
import { VIEW_DIR } from '../shared';

import type { McpApp } from '../../types';

// The ui:// resource plitzi_render links to via _meta.ui.resourceUri. An MCP Apps host (Claude, Claude Desktop,
// ChatGPT, Goose…) fetches it and renders it in a sandboxed iframe, then pushes the tool result in.
export const RENDER_APP_URI = 'ui://plitzi/render.html';

// The view/ folder ships as source next to this module in dist too (see the copy-assets step in vite.config.ts):
// this definition is compiled, everything the browser entry bundles travels verbatim.
const HERE = path.dirname(fileURLToPath(import.meta.url));

export const renderApp: McpApp = {
  uri: RENDER_APP_URI,
  name: 'plitzi-render-app',
  title: 'Plitzi widget',
  description: 'Interactive view that renders a plitzi_render widget with the Plitzi SDK.',
  entry: path.join(HERE, VIEW_DIR, 'index.tsx'),
  // The widget paints with the SDK's own stylesheet, so it travels inline with the page — minus the icon fonts,
  // which only the renders that draw an icon pay for (see ./styles).
  styles: () => [widgetCss()]
};

export { iconFontCss } from './styles';
