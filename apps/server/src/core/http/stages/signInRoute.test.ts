import { createHash } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createJsonAdapters } from '../../../adapters/jsonAdapters';
import { createServer } from '../../createServer';
import { unusedPort } from '../../unusedPort';

import type { OfflineDataRaw, SSRServer } from '@plitzi/sdk-shared';
import type { IncomingMessage, Server } from 'node:http';

/**
 * `GET /auth/sign-in` and its callback: a visitor sent to an authorization server and brought back signed in on this
 * host. Over real HTTP, against a stand-in authorization server that registers clients and redeems codes — what is
 * under test is this server's half: PKCE, the state that ties the callback to the browser that started it, and never
 * sending anybody off-site on the way back.
 */

const PORT = await unusedPort();
const ISSUER_PORT = await unusedPort();
const base = `http://127.0.0.1:${String(PORT)}`;
const issuer = `http://127.0.0.1:${String(ISSUER_PORT)}`;

const offlineData = { schema: { elements: {} }, style: {} } as unknown as OfflineDataRaw;

const EXPIRES_AT = Math.floor(Date.now() / 1000) + 3600;

/** The code the stand-in hands out, and the challenge it was asked with — so a redemption can be checked by PKCE. */
let challenge = '';

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise(resolve => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString()));
    req.on('end', () => resolve(body));
  });

let authorizationServer: Server;

const exchangeCredential = vi.fn((provider: string, token: string) =>
  Promise.resolve(
    provider === 'plitzi' && token === 'granted'
      ? { ok: true as const, session: { token: 'session-token', expiresAt: EXPIRES_AT } }
      : { ok: false as const, error: 'Token Invalid', status: 401 }
  )
);

let server: SSRServer;

const get = (path: string, cookie?: string) =>
  fetch(`${base}${path}`, { redirect: 'manual', headers: cookie ? { cookie } : {} });

/** The flow's state cookie, as the browser would send it back. */
const stateCookieOf = (response: Response): string =>
  response.headers
    .getSetCookie()
    .find(cookie => cookie.startsWith('__Host-sign-in='))
    ?.split(';')[0] ?? '';

beforeAll(async () => {
  authorizationServer = createHttpServer((req, res) => {
    void (async () => {
      const body = await readBody(req);
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/register') {
        res.end(JSON.stringify({ client_id: 'client-1' }));

        return;
      }

      const params = new URLSearchParams(body);
      const verified =
        params.get('code') === 'code-1' &&
        params.get('client_id') === 'client-1' &&
        createHash('sha256')
          .update(params.get('code_verifier') ?? '')
          .digest('base64url') === challenge;
      res.statusCode = verified ? 200 : 400;
      res.end(JSON.stringify(verified ? { access_token: 'granted' } : { error: 'invalid_grant' }));
    })();
  }).listen(ISSUER_PORT, '127.0.0.1');

  server = createServer({
    port: PORT,
    devMode: true,
    authCookie: { name: 'test_session' },
    signIn: {
      provider: 'plitzi',
      authorizeUrl: `${issuer}/authorize`,
      registerUrl: `${issuer}/register`,
      tokenUrl: `${issuer}/token`,
      scope: spaceId => `visitor:${String(spaceId)}`
    },
    adapters: { ...createJsonAdapters({ offlineData, deployment: { spaceId: 5 } }), exchangeCredential }
  });
  await server.listen(PORT, '127.0.0.1');

  await vi.waitFor(async () => {
    expect((await get('/auth/sign-in')).status).toBe(303);
  });
});

afterAll(async () => {
  await server.close();
  authorizationServer.close();
});

/** Starts a sign-in, as a browser would, and answers where it was sent and the state it carries. */
const start = async (returnTo = '/write') => {
  const response = await get(`/auth/sign-in?return=${encodeURIComponent(returnTo)}`);
  const authorize = new URL(response.headers.get('location') ?? '');
  challenge = authorize.searchParams.get('code_challenge') ?? '';

  return { response, authorize, cookie: stateCookieOf(response) };
};

describe('GET /auth/sign-in', () => {
  it('sends the visitor to the authorization server, for this space, with PKCE', async () => {
    const { authorize } = await start();

    expect(authorize.origin + authorize.pathname).toBe(`${issuer}/authorize`);
    expect(Object.fromEntries(authorize.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: 'client-1',
      redirect_uri: `${base}/auth/sign-in/callback`,
      scope: 'visitor:5',
      code_challenge_method: 'S256'
    });
  });

  it('keeps its state where no sibling host can put one', async () => {
    const { response } = await start();
    const cookie = response.headers.getSetCookie().find(value => value.startsWith('__Host-sign-in='));

    expect(cookie).toMatch(/HttpOnly/u);
    expect(cookie).toMatch(/Secure/u);
    expect(cookie).not.toMatch(/Domain=/u);
  });
});

describe('GET /auth/sign-in/callback', () => {
  it('redeems the code and signs the visitor in here, back where they started', async () => {
    const { authorize, cookie } = await start();
    const back = await get(
      `/auth/sign-in/callback?code=code-1&state=${authorize.searchParams.get('state') ?? ''}`,
      cookie
    );

    expect(back.status).toBe(303);
    expect(back.headers.get('location')).toBe('/write');
    expect(back.headers.getSetCookie().some(value => value.startsWith('test_session=session-token'))).toBe(true);
    expect(exchangeCredential).toHaveBeenLastCalledWith('plitzi', 'granted', expect.anything());
  });

  it('signs nobody in for a state this browser did not start', async () => {
    const { cookie } = await start();
    const back = await get('/auth/sign-in/callback?code=code-1&state=somebody-else', cookie);

    expect(back.headers.getSetCookie().some(value => value.startsWith('test_session='))).toBe(false);
  });

  it('signs nobody in without the state cookie at all', async () => {
    const { authorize } = await start();
    const back = await get(`/auth/sign-in/callback?code=code-1&state=${authorize.searchParams.get('state') ?? ''}`);

    expect(back.headers.get('location')).toBe('/');
    expect(back.headers.getSetCookie().some(value => value.startsWith('test_session='))).toBe(false);
  });

  it('never sends anybody off-site on the way back', async () => {
    for (const returnTo of ['https://evil.test/', '//evil.test/', '/\\evil.test/']) {
      const { authorize, cookie } = await start(returnTo);
      const back = await get(
        `/auth/sign-in/callback?code=code-1&state=${authorize.searchParams.get('state') ?? ''}`,
        cookie
      );

      expect(back.headers.get('location'), returnTo).toBe('/');
    }
  });
});
