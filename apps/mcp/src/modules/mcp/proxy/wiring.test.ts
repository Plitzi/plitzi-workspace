import http from 'node:http';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { proxyForTool } from './config';
import { DEFAULT_PROXY_TOOLS } from './types';
import { createServer } from '../../../createServer';
import { emptySpace } from '../helpers';

import type { ResourceProxy } from './types';
import type { Schema, SSRAdapters, SSRServer, Style } from '@plitzi/sdk-shared';

/** The blast radius of this feature, pinned. A render is a throwaway widget, so rewriting its URLs is invisible
 *  and temporary; plitzi_apply writes the user's REAL space, where a rewritten URL would be persisted into
 *  content they own — their space would then need this server alive to show its own images, and the URLs would
 *  expire under them. So the gate is the tool list, and these tests exercise it through a live server rather than
 *  trusting that no caller ever passes the proxy along. */

const PAGE_REF = 'home';
const ORIGINAL = 'https://cdn.example.com/photo.png';

const seedSpace = (): { schema: Schema; style: Style } => {
  const space = emptySpace();
  space.schema.flat[PAGE_REF] = {
    id: PAGE_REF,
    idRef: PAGE_REF,
    attributes: { slug: '', name: 'Home', default: true },
    definition: { rootId: PAGE_REF, label: 'Page', type: 'page', items: [], styleSelectors: { base: '' } }
  };
  space.schema.pages = [PAGE_REF];

  return { schema: space.schema, style: space.style };
};

type Deployment = { server: SSRServer; port: number; saved: () => Schema | undefined };

// An ephemeral port, claimed by probing one with a throwaway listener: a fixed one makes the suite fail on
// whatever else is already holding it — including the other servers this file starts.
const freePort = (): Promise<number> =>
  new Promise(resolve => {
    const probe = http.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });

const startServer = (port: number, tools?: string[]): Deployment => {
  const stored = seedSpace();
  let saved: Schema | undefined;

  const adapters = {
    getOfflineData: () => Promise.resolve(undefined),
    getSpaceDeployment: () => Promise.resolve({ spaceId: 1, environment: 'main', revision: 0 }),
    getSpaceId: () => Promise.resolve(1),
    getSchema: () => Promise.resolve(structuredClone(stored.schema)),
    getStyle: () => Promise.resolve(structuredClone(stored.style)),
    saveSchema: (_id: number, _env: string, schema: Schema) => {
      saved = schema;

      return Promise.resolve();
    },
    saveStyle: () => Promise.resolve()
  } as unknown as SSRAdapters;

  const server = createServer({
    httpVersion: 1,
    adapters,
    mcpAi: { proxy: { secret: 'deployment-secret', ...(tools ? { tools } : {}) } }
  });
  server.listen(port, '127.0.0.1');

  return { server, port, saved: () => saved };
};

const rpc = (port: number, method: string, path: string, body?: string): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const headers = body ? { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' } : {};
    const req = http.request({ host: '127.0.0.1', port, method, path, headers }, res => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    req.on('error', reject);
    if (body) {
      req.write(body);
    }

    req.end();
  });

const callTool = (port: number, name: string, args: unknown): Promise<{ status: number; body: string }> =>
  rpc(
    port,
    'POST',
    '/',
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })
  );

const imageOperations = (pageRef: string) => [
  {
    type: 'upsertElement',
    pageRef,
    element: { ref: 'pic', type: 'image', props: { src: ORIGINAL, alt: 'a' } }
  }
];

const srcOf = (schema: Schema): unknown =>
  Object.values(schema.flat).find(element => element.idRef === 'pic')?.attributes.src;

let defaults: Deployment;
let widened: Deployment;

beforeAll(async () => {
  defaults = startServer(await freePort());
  widened = startServer(await freePort(), ['plitzi_render', 'plitzi_apply']);
});

afterAll(async () => {
  await defaults.server.close();
  await widened.server.close();
});

describe('which tools rewrite through the endpoint', () => {
  it('defaults to plitzi_render alone', () => {
    expect(DEFAULT_PROXY_TOOLS).toEqual(['plitzi_render']);
  });

  it('hands the proxy only to a listed tool', () => {
    const proxy = {
      endpoint: 'https://mcp.example.com/__proxy',
      secret: 's',
      identity: 'conn1',
      ttl: 60,
      tools: DEFAULT_PROXY_TOOLS
    } satisfies ResourceProxy;

    expect(proxyForTool(proxy, 'plitzi_render')).toBe(proxy);
    expect(proxyForTool(proxy, 'plitzi_apply')).toBeUndefined();
    expect(proxyForTool(proxy, 'plitzi_search')).toBeUndefined();
    expect(proxyForTool(undefined, 'plitzi_render')).toBeUndefined();
  });

  // The one that matters: what a write leaves behind in the user's space.
  it('never writes a proxied URL into a real space through plitzi_apply', async () => {
    const res = await callTool(defaults.port, 'plitzi_apply', { operations: imageOperations(PAGE_REF) });
    expect(res.status).toBe(200);

    const saved = defaults.saved();
    expect(saved).toBeDefined();
    expect(srcOf(saved as Schema)).toBe(ORIGINAL);
    // Not just that prop: nothing anywhere in the persisted document may point at this server.
    expect(JSON.stringify(saved)).not.toContain('__proxy');
  });

  it('still rewrites a render on that same server', async () => {
    const res = await callTool(defaults.port, 'plitzi_render', {
      operations: imageOperations('render')
    });
    const payload = JSON.parse(res.body) as {
      result: { structuredContent?: { offlineData?: { schema: Schema } } };
    };
    const offline = payload.result.structuredContent?.offlineData;

    expect(offline).toBeDefined();
    expect(srcOf((offline as { schema: Schema }).schema)).toContain('/__proxy?i=');
  });

  // The list only says who MAY be handed the endpoint; rewriting is something a tool has to do with it, and
  // plitzi_render is the only one that does. So even a deployment that lists a writing tool persists the URLs its
  // agent authored — the list cannot turn into a way to rewrite someone's space by configuration alone.
  it('does not make a writing tool rewrite by listing it', async () => {
    const res = await callTool(widened.port, 'plitzi_apply', { operations: imageOperations(PAGE_REF) });
    expect(res.status).toBe(200);

    expect(srcOf(widened.saved() as Schema)).toBe(ORIGINAL);
  });
});

describe('the resource endpoint inside a real MCP server', () => {
  // It has to answer BEFORE the JSON-RPC catch-all (which 405s a GET) and before the OAuth guard: the host's
  // iframe fetches these with no credential.
  it('answers on its own path, and refuses a request carrying no grant', async () => {
    const res = await rpc(defaults.port, 'GET', '/__proxy?i=nope');

    expect(res.status).toBe(403);
  });

  // The origin a widget's URLs point at is the one the App's CSP declares — that pairing is the whole mechanism,
  // so it is pinned end to end. Declared ALONE, in the shape the spec documents: a host may validate this list,
  // and a wildcard spelling next to the origin risks taking it down with it.
  it('declares its own origin in the CSP of the render App, and nothing else', async () => {
    const read = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'resources/read',
      params: { uri: 'ui://plitzi/render.html' }
    });

    const res = await rpc(defaults.port, 'POST', '/', read);
    const payload = JSON.parse(res.body) as {
      result: { contents: { _meta: { ui: { csp: { resourceDomains: string[]; connectDomains: string[] } } } }[] };
    };
    const csp = payload.result.contents[0]._meta.ui.csp;

    expect(csp.resourceDomains).toEqual([`http://127.0.0.1:${defaults.port}`]);
    expect(csp.connectDomains).toEqual([`http://127.0.0.1:${defaults.port}`]);
  });
});
