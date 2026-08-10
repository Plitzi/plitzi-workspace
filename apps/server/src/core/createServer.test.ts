import { request } from 'node:http';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createAuth } from './auth/createAuth';
import { createServer } from './createServer';
import { createJsonAdapters } from '../adapters/jsonAdapters';

import type { AccountAdapters, AccountRecord } from './auth/api';
import type { IdentityAdapters } from './auth/identity';
import type { OfflineDataRaw, SSRServer, SSRSession } from '@plitzi/sdk-shared';

/**
 * The auth flows over real HTTP, through the pipeline a deployment actually gets.
 *
 * Every other auth test calls a unit and reads what it returned, which is why the whole of `/auth/login` answering
 * `200` with no body at all went unnoticed: the flow computed the right grant, and a stage in front of it — the
 * adapter-only login route, which knows how to establish a session and nothing about the account behind it — had
 * already answered and ended the response. Both halves passed their own tests. The assembly was broken.
 *
 * So these drive a listening server and assert on what a client receives. `expectJson` is the part that matters:
 * a status is not an answer, and a 2xx that carries nothing is the failure this suite exists to catch.
 */

const PORT = 39311;
const BASE = `http://127.0.0.1:${PORT}`;

const store = () => {
  const account: AccountRecord = {
    id: 7,
    username: 'ada',
    email: 'ada@example.test',
    active: true,
    verified: true,
    passwordHash: 'stored-hash'
  };

  const sessions = new Map<string, { userId: number; session: SSRSession }>();
  let current: SSRSession | undefined;

  const adapters: IdentityAdapters & AccountAdapters = {
    findAccountByToken: token => {
      const held = sessions.get(token);

      return Promise.resolve(
        held
          ? {
              id: account.id,
              username: account.username,
              email: account.email,
              verified: account.verified,
              roles: ['editor'],
              permissions: ['spaceUpdate'],
              token,
              expiresAt: held.session.expiresAt
            }
          : undefined
      );
    },
    findByUsername: username => Promise.resolve(username === account.username ? account : undefined),
    findByRefreshToken: token =>
      Promise.resolve(
        current?.refreshToken === token ? { ...account, refreshExpiresAt: current.refreshExpiresAt } : undefined
      ),
    saveSession: (userId, session) => {
      sessions.set(session.token, { userId, session });
      current = session;

      return Promise.resolve();
    },
    clearSession: target => {
      if (target.accessToken) {
        sessions.delete(target.accessToken);
      }

      current = undefined;

      return Promise.resolve();
    },
    loadAccess: () => Promise.resolve({ roles: ['editor'], permissions: ['spaceUpdate'] })
  };

  return adapters;
};

const auth = createAuth({
  tokens: { secret: 'test-secret', issuer: BASE, audience: [BASE] },
  cookie: { name: 'test_session' },
  adapters: store(),
  api: { verifyPassword: (plain, hash) => Promise.resolve(plain === 'password' && hash === 'stored-hash') }
});

const offlineData = { schema: { elements: {} }, style: {} } as unknown as OfflineDataRaw;

let server: SSRServer;

/** A response as a client sees it: the status, the cookies, and the parsed body — asserting that there was one. */
const expectJson = async (res: Response): Promise<Record<string, unknown>> => {
  const text = await res.text();

  expect(text, `${res.status} answered with an empty body`).not.toBe('');

  return JSON.parse(text) as Record<string, unknown>;
};

const post = (path: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> =>
  fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    redirect: 'manual'
  });

/**
 * A posted `<form>`, as a browser sends one. Not `fetch`: it rewrites `Sec-Fetch-Mode` to `cors` — the header is
 * the browser's to set — so a test built on it would assert the redirect behaviour while never once triggering it.
 */
const navigate = (
  path: string,
  body: string
): Promise<{ status: number; location: string | undefined; cookies: string[] }> =>
  new Promise((resolve, reject) => {
    const req = request(
      `${BASE}${path}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'content-length': Buffer.byteLength(body),
          'sec-fetch-mode': 'navigate'
        }
      },
      res => {
        res.resume();
        resolve({
          status: res.statusCode ?? 0,
          location: res.headers.location,
          cookies: res.headers['set-cookie'] ?? []
        });
      }
    );

    req.on('error', reject);
    req.end(body);
  });

const sessionCookie = (res: Response): string =>
  res.headers
    .getSetCookie()
    .map(cookie => cookie.split(';')[0])
    .join('; ');

beforeAll(async () => {
  server = createServer({
    port: PORT,
    devMode: true,
    adapters: createJsonAdapters({ offlineData }),
    auth
  });

  server.listen(PORT, '127.0.0.1');

  // listen() is fire-and-forget: wait until the port actually answers rather than racing the first request.
  await vi.waitFor(async () => {
    expect((await fetch(`${BASE}/auth/capabilities`)).status).toBe(200);
  });
});

afterAll(async () => {
  await server.close();
});

describe('createServer with auth', () => {
  it('answers a sign-in with the grant, not just a status', async () => {
    const res = await post('/auth/login', { username: 'ada', password: 'password' });

    expect(res.status).toBe(200);

    const body = await expectJson(res);

    // The token is the point: a client that signed in must come away holding one, and the cookies alone do not
    // serve a caller that is not a browser.
    expect(body.success).toBe(true);
    expect(body.details).toMatchObject({ id: 7, username: 'ada', email: 'ada@example.test' });
    expect(typeof body.access_token).toBe('string');
    expect(res.headers.getSetCookie().some(cookie => cookie.startsWith('test_session='))).toBe(true);
  });

  it('refuses a wrong password with a reason a client can read', async () => {
    const res = await post('/auth/login', { username: 'ada', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(await expectJson(res)).toMatchObject({ error: 'Invalid credentials' });
  });

  it('states what it offers, and does not offer what it was given no adapter for', async () => {
    const body = await expectJson(await fetch(`${BASE}/auth/capabilities`));

    expect(body.features).toMatchObject({ passwordLogin: true, refresh: true, signup: false });
  });

  /** The whole cycle, not the two ends of it: a session that cannot renew is one that quietly expires. */
  it('carries a session through session, refresh and logout', async () => {
    const login = await post('/auth/login', { username: 'ada', password: 'password' });
    const cookie = sessionCookie(login);
    const granted = await expectJson(login);

    const session = await expectJson(await fetch(`${BASE}/auth/session`, { headers: { cookie } }));
    expect(session.details).toMatchObject({ id: 7, roles: ['editor'], permissions: ['spaceUpdate'] });

    const refreshed = await expectJson(await post('/auth/refresh', {}, { cookie }));
    expect(typeof refreshed.access_token).toBe('string');
    expect(refreshed.access_token).not.toBe(granted.access_token);

    const loggedOut = await post('/auth/logout', {}, { cookie });
    expect(loggedOut.status).toBe(200);
    expect(await expectJson(loggedOut)).toMatchObject({ message: 'Logged out successfully' });

    // Cleared at the browser as well as at the source; a cookie left in place is a session that looks alive.
    expect(loggedOut.headers.getSetCookie().some(cookie => /^test_session=;/u.test(cookie))).toBe(true);
  });

  it('answers a request for a session it does not have with 401 and a reason', async () => {
    const res = await fetch(`${BASE}/auth/session`);

    expect(res.status).toBe(401);
    expect(await expectJson(res)).toMatchObject({ reason: 'missing' });
  });

  /**
   * A posted `<form>` has navigated away from the page it was on, and cannot render a JSON body — it needs a view.
   * This is what the adapter-only login stage was there for, and why removing it had to bring the behaviour along.
   */
  it('redirects a form submission instead of answering it with a body', async () => {
    const res = await navigate('/auth/login?redirect=/dashboard', 'username=ada&password=password');

    expect(res.status).toBe(303);
    expect(res.location).toBe('/dashboard');
    expect(res.cookies.some(cookie => cookie.startsWith('test_session='))).toBe(true);
  });

  it('sends a failed form submission back to the form rather than to the page it asked for', async () => {
    const res = await navigate('/auth/login?redirect=/dashboard', 'username=ada&password=wrong');

    expect(res.status).toBe(303);
    expect(res.location).toBe('/auth/login');
  });

  // An open redirect: the target has to be one of this server's own paths, whatever the query string asks for.
  it('refuses to redirect a form submission off-site', async () => {
    const res = await navigate('/auth/login?redirect=//evil.test/', 'username=ada&password=password');

    expect(res.location).toBe('/');
  });
});
