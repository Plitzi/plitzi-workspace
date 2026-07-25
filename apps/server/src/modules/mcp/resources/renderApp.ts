import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import ejs from 'ejs';
import { build } from 'esbuild';

import type { McpUiResourceMeta } from '@modelcontextprotocol/ext-apps';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// The ui:// resource plitzi_render links to via _meta.ui.resourceUri. An MCP Apps host (Claude, Claude Desktop,
// ChatGPT, Goose…) fetches it and renders it in a sandboxed iframe, then pushes the tool result in.
export const RENDER_APP_URI = 'ui://plitzi/render.html';

// The page and its app, both next to this module in dist as well (see the copy-assets step in vite.config.ts).
const VIEWS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../views');

// @plitzi/plitzi-sdk is a direct dependency, so the widget's SDK resolves itself with nothing to configure.
const require = createRequire(import.meta.url);
const sdkEntry = (): string => require.resolve('@plitzi/plitzi-sdk');

// The page loads nothing, so the CSP only has to cover what a WIDGET may reference at runtime: external images and
// fonts (recipe photos, product shots) and an apiContainer's fetches. Kept open so the tool stays zero-config; the
// sandbox's origin isolation is the boundary that contains it.
const META: { ui: McpUiResourceMeta } = {
  ui: { csp: { resourceDomains: ['*', 'data:', 'blob:'], connectDomains: ['*'] } }
};

// The view is a real .tsx module — typechecked and linted with the rest of the package — bundled for the browser
// here. The alias collapses the SDK's own self-imports (`from '@plitzi/plitzi-sdk'` inside its dist) onto the one
// bundled copy; without it they would survive as bare imports the iframe could not resolve.
const bundleApp = async (): Promise<string> => {
  const result = await build({
    entryPoints: [path.join(VIEWS, 'renderView.tsx')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    minify: true,
    alias: { '@plitzi/plitzi-sdk': sdkEntry() },
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent'
  });

  return result.outputFiles[0].text;
};

// Built once per process: the MCP service is stateless (a server per request), so the page is memoized here and
// every read serves the same string.
let pagePromise: Promise<string> | undefined;

const page = (): Promise<string> =>
  (pagePromise ??= bundleApp().then(app => {
    const templatePath = path.join(VIEWS, 'renderApp.ejs');
    const template = ejs.compile(readFileSync(templatePath, 'utf-8'), { filename: templatePath });

    return template({ app, css: readFileSync(path.join(path.dirname(sdkEntry()), 'plitzi-sdk.css'), 'utf-8') });
  }));

// An HTML page that carries its own app and styles: no import map, no asset mounts, no cross-origin fetches, so
// the strictest host sandbox can run it and no deployment has to serve anything extra. The cost is its size — the
// SDK travels with every read — paid to keep the widget working everywhere with zero configuration.
export const registerRenderApp = (server: McpServer): void => {
  registerAppResource(
    server,
    'plitzi-render-app',
    RENDER_APP_URI,
    { description: 'Interactive view that renders a plitzi_render widget with the Plitzi SDK.', _meta: META },
    async () => ({
      contents: [{ uri: RENDER_APP_URI, mimeType: RESOURCE_MIME_TYPE, text: await page(), _meta: META }]
    })
  );
};
