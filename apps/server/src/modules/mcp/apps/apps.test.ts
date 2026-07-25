import { describe, expect, it } from 'vitest';

import { exampleApp } from './example';
import { apps, registerApps, RENDER_APP_URI } from './index';
import { registerApp } from './shared';

import type { McpApp } from './shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

type ResourceMeta = { _meta: { ui: { csp: { resourceDomains: string[]; connectDomains: string[] } } } };
type ResourceContent = ResourceMeta & { uri: string; mimeType: string; text: string };
type ResourceRead = () => Promise<{ contents: ResourceContent[] }>;

// A stub exposing only the method the registration touches — the real McpServer needs a transport to build.
const collect = (register: (server: McpServer) => void): Map<string, ResourceRead> => {
  const reads = new Map<string, ResourceRead>();
  register({
    registerResource: (_name: string, uri: string, _meta: unknown, cb: ResourceRead) => reads.set(uri, cb)
  } as unknown as McpServer);

  return reads;
};

const pageOf = async (app: McpApp): Promise<ResourceContent> => {
  const read = collect(server => registerApp(server, app)).get(app.uri);
  if (!read) {
    throw new Error(`registerApp registered nothing for ${app.uri}`);
  }

  return (await read()).contents[0];
};

const scriptOf = (html: string): string => {
  const match = /<script>([\s\S]*?)<\/script>/u.exec(html);
  if (!match) {
    throw new Error('no app script in the page');
  }

  return match[1];
};

describe('MCP Apps (self-contained pages: they fetch nothing)', () => {
  it('registers every app under its own ui:// URI', () => {
    const reads = collect(registerApps);

    expect([...reads.keys()]).toEqual(apps.map(app => app.uri));
    expect(reads.has(RENDER_APP_URI)).toBe(true);
  });

  it('serves each app as an MCP Apps resource, with the CSP a view needs', async () => {
    for (const app of apps) {
      const resource = await pageOf(app);

      expect(resource.uri).toBe(app.uri);
      expect(resource.mimeType).toBe('text/html;profile=mcp-app');
      // Images, fonts and the view's own fetches are its business; nothing else is ever loaded.
      expect(resource._meta.ui.csp.resourceDomains).toEqual(['*', 'data:', 'blob:']);
      expect(resource._meta.ui.csp.connectDomains).toEqual(['*']);
    }
  });

  it('carries each view in one classic script, with its styles inlined and nothing to fetch', async () => {
    for (const app of apps) {
      const { text } = await pageOf(app);
      const script = scriptOf(text);

      // A classic-script IIFE: the bundler resolved every import, so a leftover one would have failed the build.
      expect(script.trimStart().startsWith('"use strict";(()')).toBe(true);
      expect(text).toContain(`<title>${app.title}</title>`);
      expect(text).not.toContain('importmap');
      // The one assertion that matters for a deny-by-default sandbox: nothing in the page points anywhere.
      expect(text).not.toMatch(/<(?:script|link)[^>]+(?:src|href)=/u);
    }
  });

  // The template a new app is copied from: built here so it cannot rot, though no tool opens it.
  it('builds the reference app, which pays only for what its view imports', async () => {
    const { text } = await pageOf(exampleApp);

    expect(text).toContain(`<title>${exampleApp.title}</title>`);
    expect(text).not.toMatch(/<(?:script|link)[^>]+(?:src|href)=/u);
    expect(scriptOf(text)).toContain('ui/initialize');

    // A view pays only for what it imports: no SDK and no stylesheet here, so the page is a fraction of the
    // render app's (the MCP Apps runtime and React are the floor every app stands on).
    const render = await pageOf(apps.find(app => app.uri === RENDER_APP_URI) as McpApp);
    expect(text.length).toBeLessThan(render.text.length / 2);
  });

  it('ships zod with English messages only, not its 40 translations', async () => {
    const script = scriptOf((await pageOf(apps[0])).text);

    // The other ~40 survive tree-shaking and cost 194 KB, so the bundler drops them.
    expect(script).toContain('Invalid input');
    expect(script).not.toContain('Число');
    expect(script).not.toContain('demasiado grande');
  });

  it('bundles the MCP Apps runtime and the SDK into the render app, stylesheet included', async () => {
    const { text } = await pageOf(apps.find(app => app.uri === RENDER_APP_URI) as McpApp);

    expect(scriptOf(text)).toContain('ui/initialize');
    expect(scriptOf(text)).toContain('offlineData');
    expect(scriptOf(text).length).toBeGreaterThan(500_000);
    expect(text).toContain('tailwindcss');
  });
});
