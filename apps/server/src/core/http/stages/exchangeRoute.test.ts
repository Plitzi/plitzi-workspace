import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createJsonAdapters } from '../../../adapters/jsonAdapters';
import { createServer } from '../../createServer';

import type { OfflineDataRaw, SSRServer, SSRUser } from '@plitzi/sdk-shared';

/**
 * `POST /auth/exchange` on a page server with no auth kernel of its own — the one a customer's domain calls when its
 * space signs people in with an identity provider that lives in the browser.
 *
 * Over real HTTP, through the pipeline a deployment gets: whether the credential is any good is the adapter's to say,
 * and what is under test is the part this server owns — reading the request, answering the adapter's refusal as it
 * was given, and writing the session cookie only for a credential that was accepted.
 */

const PORT = 39321;
const BARE_PORT = 39322;
const base = (port: number) => `http://127.0.0.1:${String(port)}`;

const offlineData = { schema: { elements: {} }, style: {} } as unknown as OfflineDataRaw;

const EXPIRES_AT = Math.floor(Date.now() / 1000) + 3600;

const VISITOR: SSRUser = {
  id: 7,
  username: 'ada',
  email: 'ada@example.test',
  verified: true,
  roles: [],
  permissions: [],
  token: 'session-token',
  expiresAt: EXPIRES_AT
};

const exchangeCredential = vi.fn((provider: string, token: string) =>
  Promise.resolve(
    provider === 'github' && token === 'good'
      ? {
          ok: true as const,
          session: { token: 'session-token', expiresAt: EXPIRES_AT, refreshToken: 'refresh-token' },
          user: VISITOR
        }
      : { ok: false as const, error: 'Token Invalid', status: 401 }
  )
);

let server: SSRServer;
let bare: SSRServer;

const exchange = (body: string, port = PORT) =>
  fetch(`${base(port)}/auth/exchange`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });

beforeAll(async () => {
  server = createServer({
    port: PORT,
    devMode: true,
    authCookie: { name: 'test_session' },
    adapters: { ...createJsonAdapters({ offlineData }), exchangeCredential }
  });
  bare = createServer({ port: BARE_PORT, devMode: true, adapters: createJsonAdapters({ offlineData }) });
  server.listen(PORT, '127.0.0.1');
  bare.listen(BARE_PORT, '127.0.0.1');

  await vi.waitFor(async () => {
    expect((await exchange('{}')).status).toBe(400);
    expect((await exchange('{}', BARE_PORT)).status).toBe(404);
  });
});

afterAll(async () => {
  await server.close();
  await bare.close();
});

describe('core/http/stages/exchangeRoute', () => {
  it('turns an accepted credential into a session: the cookie, and the grant a client reads', async () => {
    const res = await exchange(JSON.stringify({ provider: 'github', token: 'good' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, details: VISITOR, access_token: 'session-token' });
    expect(res.headers.getSetCookie().some(cookie => cookie.startsWith('test_session='))).toBe(true);
    expect(exchangeCredential).toHaveBeenLastCalledWith('github', 'good', expect.anything());
  });

  it('answers a refused credential as the adapter refused it, and writes no session', async () => {
    const res = await exchange(JSON.stringify({ provider: 'github', token: 'borrowed' }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Token Invalid', reason: 'revoked' });
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it('asks for both halves before asking the adapter anything', async () => {
    exchangeCredential.mockClear();

    expect((await exchange(JSON.stringify({ provider: 'github' }))).status).toBe(400);
    expect((await exchange(JSON.stringify({ token: 'good' }))).status).toBe(400);
    expect((await exchange('not json')).status).toBe(400);
    expect((await exchange(JSON.stringify({ provider: 1, token: ['good'] }))).status).toBe(400);
    expect(exchangeCredential).not.toHaveBeenCalled();
  });

  /** A server given no way to judge a credential says there is nothing here, rather than accepting or failing. */
  it('is not there on a server that was given no exchange adapter', async () => {
    const res = await exchange(JSON.stringify({ provider: 'github', token: 'good' }), BARE_PORT);

    expect(res.status).toBe(404);
    expect(res.headers.getSetCookie()).toEqual([]);
  });
});
