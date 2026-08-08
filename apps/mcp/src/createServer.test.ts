import { afterAll, describe, expect, it } from 'vitest';

import { createServer } from './createServer';
import { httpRequest, jsonRpc, RPC_HEADERS } from './tests/httpRequest';

import type { SSRAdapters, SSRServer } from '@plitzi/sdk-shared';

const PORT = 39217;

const adapters = {
  getOfflineData: () => Promise.resolve(undefined),
  getSpaceDeployment: () => Promise.resolve({ spaceId: 1, environment: 'main', revision: 0 }),
  getGrant: () => Promise.resolve({ spaceId: 1, scope: 'agent' as const, canWrite: true })
} as unknown as SSRAdapters;

const server: SSRServer = createServer({
  httpVersion: 1,
  adapters,
  health: { payload: { role: 'mcp', ok: true } }
});
server.listen(PORT, '127.0.0.1');

describe('createServer (dedicated MCP server end-to-end)', () => {
  afterAll(() => server.close());

  it('answers the health endpoint with the configured payload', async () => {
    const res = await httpRequest(PORT, 'GET', '/health');
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ role: 'mcp', ok: true });
  });

  it('serves the render view as one self-contained page', async () => {
    const read = jsonRpc('resources/read', { uri: 'ui://plitzi/render.html' }, 2);
    const res = await httpRequest(PORT, 'POST', '/', RPC_HEADERS, read);

    expect(res.status).toBe(200);
    const html = (JSON.parse(res.body) as { result: { contents: { text: string }[] } }).result.contents[0].text;
    // The page carries its app and its styles: it points at nothing, so no asset mount has to exist.
    expect(html).not.toMatch(/<(?:script|link)[^>]+(?:src|href)=/u);
    expect(html).toContain('ui/initialize');
  });

  it('serves the MCP handshake at the root (no /mcp path)', async () => {
    const initialize = jsonRpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'smoke', version: '0' }
    });
    const res = await httpRequest(PORT, 'POST', '/', RPC_HEADERS, initialize);

    expect(res.status).toBe(200);
    expect(res.body).toContain('plitzi-mcp');
    expect(res.body).toContain('"result"');
  });

  // OAuth is opt-in. Without `oauth` configured this server must stay exactly what it was: no discovery document,
  // no grant endpoints, and a public surface that answers without a token.
  it('mounts no OAuth endpoint when the deployment configured none', async () => {
    const discovery = await httpRequest(PORT, 'GET', '/.well-known/oauth-protected-resource');
    const register = await httpRequest(PORT, 'POST', '/register', { 'Content-Type': 'application/json' }, '{}');

    expect(discovery.status).toBe(404);
    expect(register.status).not.toBe(201);
  });
});
