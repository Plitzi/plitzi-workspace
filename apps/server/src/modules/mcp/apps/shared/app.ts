import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import ejs from 'ejs';
import { build } from 'esbuild';

import type { McpUiResourceCsp, McpUiResourceMeta } from '@modelcontextprotocol/ext-apps';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/** An MCP App: a `ui://` page the host renders in a sandboxed iframe, linked from a tool through
 *  `_meta.ui.resourceUri`. Each one is a folder next to this file — its definition and its view. */
export interface McpApp {
  /** The `ui://` URI its tool advertises. */
  uri: string;
  /** Resource name in resources/list. */
  name: string;
  description: string;
  /** Page <title>. */
  title: string;
  /** Absolute path to the view: the app's browser entry, bundled from its own folder. */
  entry: string;
  /** Stylesheets inlined in the page, by absolute path — resolved lazily so a missing one only fails on read. */
  styles?: () => string[];
  /** Overrides the default CSP below. */
  csp?: McpUiResourceCsp;
}

// The page loads nothing, so the default CSP only has to cover what a VIEW may reference at runtime: external
// images and fonts, and its own fetches. Kept open so an app stays zero-config; the sandbox's origin isolation is
// the boundary that contains it.
const DEFAULT_CSP: McpUiResourceCsp = { resourceDomains: ['*', 'data:', 'blob:'], connectDomains: ['*'] };

const SHELL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'shell.ejs');

// @plitzi/plitzi-sdk is a direct dependency, so a view's SDK and stylesheet resolve themselves with nothing to
// configure. (createRequire because this is ESM.)
export const require = createRequire(import.meta.url);

// Views are real .tsx modules in this package — typechecked and linted with the rest — bundled for the browser
// here, dependencies included. The alias collapses the SDK's own self-imports (`from '@plitzi/plitzi-sdk'` inside
// its dist) onto the one bundled copy; without it they would survive as bare imports the iframe cannot resolve.
const bundle = async (entry: string): Promise<string> => {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    minify: true,
    alias: { '@plitzi/plitzi-sdk': require.resolve('@plitzi/plitzi-sdk') },
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent'
  });

  return result.outputFiles[0].text;
};

const template = (): ejs.TemplateFunction => ejs.compile(readFileSync(SHELL, 'utf-8'), { filename: SHELL });

// Built once per process and shared by every request: the MCP service is stateless (a server per request), so a
// page rebuilt per registration would bundle on every call.
const pages = new Map<string, Promise<string>>();

const page = (app: McpApp): Promise<string> => {
  let html = pages.get(app.uri);
  if (!html) {
    html = bundle(app.entry).then(script =>
      template()({
        title: app.title,
        app: script,
        css: (app.styles?.() ?? []).map(file => readFileSync(file, 'utf-8')).join('\n')
      })
    );
    pages.set(app.uri, html);
  }

  return html;
};

/** Register an app's `ui://` resource: an HTML page that carries its own script and styles — no import map, no
 *  asset mounts and no cross-origin fetches, so the strictest host sandbox can run it and no deployment has to
 *  serve anything extra. The cost is its size, paid to keep the app working everywhere with zero configuration. */
export const registerApp = (server: McpServer, app: McpApp): void => {
  const meta: { ui: McpUiResourceMeta } = { ui: { csp: app.csp ?? DEFAULT_CSP } };

  registerAppResource(server, app.name, app.uri, { description: app.description, _meta: meta }, async () => ({
    contents: [{ uri: app.uri, mimeType: RESOURCE_MIME_TYPE, text: await page(app), _meta: meta }]
  }));
};
