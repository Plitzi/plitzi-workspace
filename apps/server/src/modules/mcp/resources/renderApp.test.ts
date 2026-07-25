import { describe, expect, it } from 'vitest';

import { registerRenderApp, RENDER_APP_URI } from './renderApp';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

type ResourceMeta = { _meta: { ui: { csp: { resourceDomains: string[]; connectDomains: string[] } } } };
type ResourceContent = ResourceMeta & { uri: string; mimeType: string; text: string };
type ResourceRead = () => Promise<{ contents: ResourceContent[] }>;

// A stub exposing only the method the registration touches — the real McpServer needs a transport to build.
const renderApp = async (): Promise<ResourceContent> => {
  let read: ResourceRead | undefined;
  const server = {
    registerResource: (_name: string, _uri: string, _meta: unknown, cb: ResourceRead) => {
      read = cb;
    }
  } as unknown as McpServer;

  registerRenderApp(server);
  if (!read) {
    throw new Error('registerRenderApp registered no resource');
  }

  return (await read()).contents[0];
};

const scriptOf = (html: string): string => {
  const match = /<script>([\s\S]*?)<\/script>/u.exec(html);
  if (!match) {
    throw new Error('no app script in the render view');
  }

  return match[1];
};

describe('MCP Apps render view (self-contained: the page fetches nothing)', () => {
  it('serves the app as an MCP Apps resource, with the CSP a widget needs', async () => {
    const resource = await renderApp();

    expect(resource.uri).toBe(RENDER_APP_URI);
    expect(resource.mimeType).toBe('text/html;profile=mcp-app');
    // Images, fonts and an apiContainer's fetches are the widget's own business; nothing else is loaded.
    expect(resource._meta.ui.csp.resourceDomains).toEqual(['*', 'data:', 'blob:']);
    expect(resource._meta.ui.csp.connectDomains).toEqual(['*']);
  });

  it('carries the whole app in one classic script: no module, no import map, nothing to fetch', async () => {
    const { text } = await renderApp();
    const script = scriptOf(text);

    // A classic-script IIFE: the bundler resolved every import, so a leftover one would have failed the build.
    expect(script.trimStart().startsWith('"use strict";(()')).toBe(true);
    expect(text).not.toContain('importmap');
    expect(text).not.toContain('<script type="module"');
    // The one assertion that matters for a deny-by-default sandbox: nothing in the page points anywhere.
    expect(text).not.toMatch(/<(?:script|link)[^>]+(?:src|href)=/u);

    // Both runtimes that must travel with the page, each identified by a string only it defines.
    expect(script).toContain('ui/initialize');
    expect(script).toContain('offlineData');
    expect(script.length).toBeGreaterThan(500_000);
  });

  it('inlines the SDK stylesheet, so the widget is styled with nothing to fetch', async () => {
    const { text } = await renderApp();

    expect(text).toContain('tailwindcss');
    expect(text).toContain('Rendering…');
  });
});
