import { readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { createServer } from '@plitzi/sdk-server';

import { buildMCPPipeline, mcpExtensions } from './pipeline';
import { mcpOnlyStage, mcpStage } from './stages/mcp';
import { previewStage } from './stages/preview';
import { widgetProxyStage } from './stages/proxy';

import type { OfflineDataRaw, Schema, SSRAdapters, SSRServer, Style } from '@plitzi/sdk-shared';

const PORT = 39231;

// The sample space `yarn start` serves. A real one, not a stub: the preview endpoint RENDERS, so an empty
// schema would only ever prove that the stage was reached, never that it works.
const SAMPLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dev/sample');
const schema = (JSON.parse(readFileSync(path.join(SAMPLE, 'space.json'), 'utf-8')) as { schema: Schema }).schema;
const style = JSON.parse(readFileSync(path.join(SAMPLE, 'style.json'), 'utf-8')) as Style;
const offline = { schema, style } as unknown as OfflineDataRaw;

const adapters = {
  getOfflineData: () => Promise.resolve(offline),
  getSpaceDeployment: () => Promise.resolve({ spaceId: 1, environment: 'main', revision: 0, pluginNames: [] }),
  getSpaceId: () => Promise.resolve(1),
  getSchema: () => Promise.resolve(schema),
  getStyle: () => Promise.resolve(style)
} as unknown as SSRAdapters;

const request = (
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: string
): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, method, path, headers }, res => {
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

const jsonRpc = (method: string, params?: unknown) => JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });

const RPC_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };

describe('mcpExtensions (what this package hands a page server)', () => {
  // Every stage here gates itself, so all of them belong ahead of the auth middleware chain. Landing one in
  // `data` instead would put it behind that chain and break a caller that legitimately carries no credential.
  it('offers every stage in the preAuth slot and claims no other', () => {
    const extensions = mcpExtensions();

    expect(extensions.preAuth).toEqual([widgetProxyStage, mcpStage, previewStage]);
    expect(extensions.data).toBeUndefined();
  });
});

describe('buildMCPPipeline (the dedicated MCP server)', () => {
  // mcpOnlyStage answers every request that reaches it, so anything that must stay reachable — health probes,
  // static mounts, the widget resource endpoint, the OAuth grant endpoints — has to precede it.
  it('ends with the MCP catch-all, with the self-gating stages ahead of it', () => {
    const stages = buildMCPPipeline();

    expect(stages.at(-1)).toBe(mcpOnlyStage);
    expect(stages.indexOf(widgetProxyStage)).toBeLessThan(stages.length - 1);
    expect(stages).not.toContain(mcpStage);
  });
});

// The seam the split created: sdk-mcp's stages running inside a page server built by sdk-server, across the
// package boundary. Unit-testing the slot contract cannot catch a pipeline that assembles but does not serve.
describe('mcpExtensions mounted in a real sdk-server page server', () => {
  const server: SSRServer = createServer(
    {
      httpVersion: 1,
      adapters,
      health: { payload: { role: 'ssr+mcp', ok: true } },
      preview: { enabled: true, secret: 'shh' }
    },
    mcpExtensions()
  );
  server.listen(PORT, '127.0.0.1');

  afterAll(() => server.close());

  it('answers the MCP handshake under /mcp', async () => {
    const res = await request(
      'POST',
      '/mcp',
      RPC_HEADERS,
      jsonRpc('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'embedded', version: '0' }
      })
    );

    expect(res.status).toBe(200);
    expect(res.body).toContain('plitzi-mcp');
  });

  it('keeps serving pages: a route MCP does not claim falls through to the renderer', async () => {
    const res = await request('GET', '/');

    expect(res.status).toBe(200);
    expect(res.body).toContain('<html');
    expect(res.body).not.toContain('jsonrpc');
  });

  it('still answers the page server health endpoint', async () => {
    const res = await request('GET', '/health');

    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ role: 'ssr+mcp', ok: true });
  });

  it('guards the draft-preview endpoint with the shared secret', async () => {
    const withoutSecret = await request('POST', '/__preview', { 'Content-Type': 'application/json' }, '{"spaceId":1}');

    expect(withoutSecret.status).toBe(403);
  });

  it('renders a draft preview once the secret matches, minting a one-shot token', async () => {
    const res = await request(
      'POST',
      '/__preview',
      { 'Content-Type': 'application/json', 'x-preview-secret': 'shh' },
      JSON.stringify({ spaceId: 1 })
    );

    expect(res.status).toBe(200);
    const result = JSON.parse(res.body) as { ok: boolean; html: string; token?: string; stateVersion: string };
    expect(result.ok).toBe(true);
    expect(result.html).toContain('<html');
    expect(result.token).toBeTruthy();
    expect(result.stateVersion).toBeTruthy();
  });

  // The write side mints the draft; the read side is sdk-server's, and the token is what joins them across the
  // package boundary. A render carrying it must serve the draft rather than the persisted state.
  it('serves the minted draft back to a render carrying the token, exactly once', async () => {
    const minted = await request(
      'POST',
      '/__preview',
      { 'Content-Type': 'application/json', 'x-preview-secret': 'shh' },
      JSON.stringify({
        spaceId: 1,
        operations: [{ type: 'patchSettings', settings: { title: 'Drafted title' } }]
      })
    );
    const { token, pagePath } = JSON.parse(minted.body) as { token: string; pagePath: string };

    const first = await request('GET', `${pagePath}?__pt=${token}`);
    const second = await request('GET', `${pagePath}?__pt=${token}`);

    expect(first.status).toBe(200);
    expect(first.body).toContain('Drafted title');
    expect(second.body).not.toContain('Drafted title');
  });
});
