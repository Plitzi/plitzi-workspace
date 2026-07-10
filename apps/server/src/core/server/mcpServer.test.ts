import http from 'node:http';

import { afterAll, describe, expect, it } from 'vitest';

import { createMCPServer } from './mcpServer';

import type { SSRAdapters, SSRServer } from '@plitzi/sdk-shared';

const PORT = 39217;

const adapters = {
  getOfflineData: () => Promise.resolve(undefined),
  getSpaceDeployment: () => Promise.resolve({ spaceId: 1, environment: 'main', revision: 0 }),
  getSpaceId: () => Promise.resolve(1)
} as unknown as SSRAdapters;

const server: SSRServer = createMCPServer({
  httpVersion: 1,
  adapters,
  health: { payload: { role: 'mcp', ok: true } }
});
server.listen(PORT, '127.0.0.1');

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

describe('createMCPServer (dedicated MCP server end-to-end)', () => {
  afterAll(() => server.close());

  it('answers the health endpoint with the configured payload', async () => {
    const res = await request('GET', '/health');
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ role: 'mcp', ok: true });
  });

  it('serves the MCP handshake at the root (no /mcp path)', async () => {
    const initialize = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } }
    });
    const res = await request(
      'POST',
      '/',
      { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      initialize
    );

    expect(res.status).toBe(200);
    expect(res.body).toContain('plitzi-mcp');
    expect(res.body).toContain('"result"');
  });
});
