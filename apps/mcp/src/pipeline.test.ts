import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { createServer } from '@plitzi/sdk-server';
import { healthStage } from '@plitzi/sdk-server/kernel';

import { buildMCPPipeline, mcpExtensions } from './pipeline';
import { previewStage } from './stages/preview';
import { httpRequest, jsonRpc, RPC_HEADERS } from './tests/httpRequest';

import type { OfflineDataRaw, Schema, SSRPageAdapters, SSRServer, Style } from '@plitzi/sdk-shared';

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
  getGrant: () => Promise.resolve({ spaceId: 1, scope: 'agent' as const, canWrite: true }),
  getSchema: () => Promise.resolve(schema),
  getStyle: () => Promise.resolve(style)
} as unknown as SSRPageAdapters;

// The stages are built per call now (each closes over the options it was given), so what these assert is the
// SHAPE of each pipeline — how many stages, in which slot, and which ones are absent. That the assembled thing
// actually serves is the seam test below, which runs a real page server.
describe('mcpExtensions (what this package hands a page server)', () => {
  // Every stage here gates itself, so all of them belong ahead of the auth middleware chain. Landing one in
  // `data` instead would put it behind that chain and break a caller that legitimately carries no credential.
  it('offers every stage in the preAuth slot and claims no other', () => {
    const extensions = mcpExtensions();

    expect(extensions.preAuth).toHaveLength(3);
    expect(extensions.preAuth?.at(-1)).toBe(previewStage);
    expect(extensions.data).toBeUndefined();
  });
});

describe('buildMCPPipeline (the dedicated MCP server)', () => {
  // The MCP catch-all answers every request that reaches it, so anything that must stay reachable — health probes,
  // static mounts, the widget resource endpoint, the OAuth grant endpoints — has to precede it. Draft-preview is
  // not among them: it renders, which a dedicated MCP server cannot do.
  it('is the six self-gating stages, and carries no draft-preview', () => {
    const stages = buildMCPPipeline();

    expect(stages[0]).toBe(healthStage);
    expect(stages).toHaveLength(6);
    expect(stages).not.toContain(previewStage);
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
    const res = await httpRequest(
      PORT,
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
    const res = await httpRequest(PORT, 'GET', '/');

    expect(res.status).toBe(200);
    expect(res.body).toContain('<html');
    expect(res.body).not.toContain('jsonrpc');
  });

  it('still answers the page server health endpoint', async () => {
    const res = await httpRequest(PORT, 'GET', '/health');

    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ role: 'ssr+mcp', ok: true });
  });

  it('guards the draft-preview endpoint with the shared secret', async () => {
    const withoutSecret = await httpRequest(
      PORT,
      'POST',
      '/__preview',
      { 'Content-Type': 'application/json' },
      '{"spaceId":1}'
    );

    expect(withoutSecret.status).toBe(403);
  });

  it('renders a draft preview once the secret matches, minting a one-shot token', async () => {
    const res = await httpRequest(
      PORT,
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
    const minted = await httpRequest(
      PORT,
      'POST',
      '/__preview',
      { 'Content-Type': 'application/json', 'x-preview-secret': 'shh' },
      JSON.stringify({
        spaceId: 1,
        operations: [{ type: 'patchSettings', settings: { title: 'Drafted title' } }]
      })
    );
    const { token, pagePath } = JSON.parse(minted.body) as { token: string; pagePath: string };

    const first = await httpRequest(PORT, 'GET', `${pagePath}?__pt=${token}`);
    const second = await httpRequest(PORT, 'GET', `${pagePath}?__pt=${token}`);

    expect(first.status).toBe(200);
    expect(first.body).toContain('Drafted title');
    expect(second.body).not.toContain('Drafted title');
  });

  /**
   * The loop the one-shot token cannot support: look, change something, look again.
   *
   * Asserted end to end rather than on the store alone, because the halves live in different packages — this one
   * mints and ends the session, `@plitzi/sdk-server` decides what a render does with the token — and a session that
   * resolves in a unit test but not through a real request is worth nothing to whoever is iterating.
   */
  it('keeps a session draft resolvable until it is ended', async () => {
    const minted = await httpRequest(
      PORT,
      'POST',
      '/__preview',
      { 'Content-Type': 'application/json', 'x-preview-secret': 'shh' },
      JSON.stringify({
        spaceId: 1,
        mode: 'session',
        operations: [{ type: 'patchSettings', settings: { title: 'Session title' } }]
      })
    );
    const { token, pagePath, expiresInMs } = JSON.parse(minted.body) as {
      token: string;
      pagePath: string;
      expiresInMs: number;
    };

    expect(expiresInMs).toBeGreaterThan(60_000);

    const first = await httpRequest(PORT, 'GET', `${pagePath}?__pt=${token}`);
    const reload = await httpRequest(PORT, 'GET', `${pagePath}?__pt=${token}`);

    expect(first.body).toContain('Session title');
    expect(reload.body).toContain('Session title');
    // Unsaved work does not get to be cached by anything between here and the browser, nor indexed by anything else.
    expect(reload.headers['cache-control']).toContain('no-store');
    expect(reload.headers['x-robots-tag']).toContain('noindex');
    expect(String(reload.headers['set-cookie'])).toContain('plitzi_draft=');

    const ended = await httpRequest(
      PORT,
      'POST',
      '/__preview/end',
      { 'Content-Type': 'application/json', 'x-preview-secret': 'shh' },
      JSON.stringify({ token })
    );

    expect(ended.status).toBe(200);
    const after = await httpRequest(PORT, 'GET', `${pagePath}?__pt=${token}`);
    expect(after.body).not.toContain('Session title');
  });
});
