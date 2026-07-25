import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { registerRenderApp } from './renderApp';
import { sdkAssetUrls, sdkDistDir } from '../../../core/sdkAssets';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

const BASE = 'https://mcp.example.com/sdk-assets';

const assets = sdkAssetUrls({ baseUrl: BASE });

type ResourceMeta = { _meta: { ui: { csp: { resourceDomains: string[]; connectDomains: string[] } } } };
type ResourceRead = () => { contents: (ResourceMeta & { text: string })[] };

// A stub exposing only the method the registration touches — the real McpServer needs a transport to build.
const renderApp = (): ResourceMeta & { text: string } => {
  let read: ResourceRead | undefined;
  const server = {
    registerResource: (_name: string, _uri: string, _meta: unknown, cb: ResourceRead) => {
      read = cb;
    }
  } as unknown as McpServer;

  registerRenderApp(server, assets);
  if (!read) {
    throw new Error('registerRenderApp registered no resource');
  }

  return read().contents[0];
};

const importMapOf = (html: string): Record<string, string> => {
  const match = /<script type="importmap">\s*([\s\S]*?)\s*<\/script>/u.exec(html);
  if (!match) {
    throw new Error('no import map in the render view');
  }

  return (JSON.parse(match[1]) as { imports: Record<string, string> }).imports;
};

const distFile = (url: string): string => {
  const dir = sdkDistDir();
  if (!dir) {
    throw new Error('@plitzi/plitzi-sdk is not installed');
  }

  return path.join(dir, path.basename(new URL(url).pathname));
};

// A bare specifier: a package name, never a path. Excludes the many `from"…"` fragments inside minified strings.
const BARE = /^[@a-z][\w@./-]*$/u;

// Every static import of the SDK bundle, as [namedBindings, specifier].
const sdkImports = (source: string): [string[], string][] =>
  [...source.matchAll(/import\s*(?:\*\s*as\s*[\w$]+|[\w$]+)?\s*,?\s*(?:\{([^}]*)\})?\s*from"([^"]+)"/gu)]
    .filter(m => BARE.test(m[2]))
    .map(m => [m[1] ? m[1].split(',').map(part => part.trim().split(/\s+as\s+/u)[0]) : [], m[2]]);

describe('MCP Apps render view (no bundler: import map over the installed dist)', () => {
  const resource = renderApp();
  const html = resource.text;
  const imports = importMapOf(html);
  const sdkSource = readFileSync(distFile(assets.js), 'utf-8');

  it('maps every bare specifier the SDK bundle imports', () => {
    const specifiers = new Set(sdkImports(sdkSource).map(([, specifier]) => specifier));
    expect(specifiers.size).toBeGreaterThan(0);
    for (const specifier of specifiers) {
      expect(imports).toHaveProperty([specifier]);
    }

    expect(imports['@plitzi/plitzi-sdk']).toBe(assets.js);
  });

  it('serves every mapped URL from the installed dist', () => {
    for (const url of new Set(Object.values(imports))) {
      expect(existsSync(distFile(url))).toBe(true);
    }

    expect(existsSync(distFile(assets.css))).toBe(true);
  });

  it('resolves every React binding the SDK imports from the vendor bundle', () => {
    const vendorSource = readFileSync(distFile(assets.vendor), 'utf-8');
    const exported = new Set(
      [...vendorSource.matchAll(/export\{([^}]*)\}/gu)].flatMap(m =>
        m[1].split(',').map(
          part =>
            part
              .trim()
              .split(/\s+as\s+/u)
              .pop() ?? ''
        )
      )
    );

    // The SDK also default-imports React (`import React, { … } from 'react'`).
    expect(exported).toContain('default');

    for (const [bindings, specifier] of sdkImports(sdkSource)) {
      if (imports[specifier] !== assets.vendor) {
        continue;
      }

      for (const binding of bindings) {
        expect(exported).toContain(binding);
      }
    }
  });

  it('declares the origin it loads the SDK from first, ahead of the permissive entries', () => {
    const { resourceDomains, connectDomains } = resource._meta.ui.csp;
    expect(resourceDomains[0]).toBe('https://mcp.example.com');
    expect(connectDomains[0]).toBe('https://mcp.example.com');
    expect(resourceDomains).toContain('*');
    expect(connectDomains).toContain('*');
  });

  it('runs the handshake before the SDK loads, so the host never waits on the module graph', () => {
    const handshake = html.indexOf('ui/initialize');
    const moduleScript = html.indexOf('<script type="module">');
    expect(handshake).toBeGreaterThan(-1);
    expect(handshake).toBeLessThan(moduleScript);
  });
});
