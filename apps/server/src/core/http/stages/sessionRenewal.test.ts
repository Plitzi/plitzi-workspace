import { request } from 'node:http';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createJsonAdapters } from '../../../adapters/jsonAdapters';
import { createAuth } from '../../auth/createAuth';
import { createServer } from '../../createServer';

import type { AccountAdapters, AccountRecord } from '../../auth/api';
import type { IdentityAdapters } from '../../auth/identity';
import type { OfflineDataRaw, SSRServer, SSRSession } from '@plitzi/sdk-shared';

/**
 * A page asked for by a browser whose access cookie has died while its refresh cookie lives on.
 *
 * The server used to render that visitor as a guest and leave the browser to renew — so the HTML was the guest page
 * and the screen, a moment later, the signed-in one; and a guest-only page was shown and then redirected away from
 * rather than answered with a redirect. These drive a listening server, because what is under test is the round
 * trip a browser makes: page → renewal → page.
 *
 * `node:http` rather than `fetch`: the `Sec-Fetch-*` headers are the browser's to set, and `fetch` rewrites them.
 */

const PORT = 39331;
/** A page server that does not serve `/auth` — the api beside it does — and names where to renew. */
const REMOTE_PORT = 39332;
/** One that serves `/auth` and has renewal turned off. */
const OFF_PORT = 39333;
const origin = (port: number) => `http://127.0.0.1:${String(port)}`;
const BASE = origin(PORT);

const inSeconds = (offset: number) => Math.floor(Date.now() / 1000) + offset;

const account: AccountRecord = {
  id: 7,
  username: 'ada',
  email: 'ada@example.test',
  active: true,
  verified: true,
  passwordHash: 'stored-hash'
};

let current: SSRSession | undefined;
const live = new Map<string, SSRSession>();

const adapters: IdentityAdapters & AccountAdapters = {
  findAccountByToken: token => {
    const held = live.get(token);

    return Promise.resolve(
      held
        ? {
            id: account.id,
            username: account.username,
            email: account.email,
            verified: account.verified,
            roles: [],
            permissions: [],
            token,
            expiresAt: held.expiresAt
          }
        : undefined
    );
  },
  findByRefreshToken: token =>
    Promise.resolve(
      current?.refreshToken === token ? { ...account, refreshExpiresAt: current.refreshExpiresAt } : undefined
    ),
  saveSession: (_userId, session) => {
    live.set(session.token, session);
    current = session;

    return Promise.resolve();
  },
  clearSession: () => {
    current = undefined;

    return Promise.resolve();
  },
  loadAccess: () => Promise.resolve({ roles: [], permissions: [] })
};

const auth = createAuth({
  tokens: { secret: 'test-secret', issuer: BASE, audience: [BASE] },
  cookie: { name: 'test_session' },
  adapters
});

const offlineData = { schema: { elements: {} }, style: {} } as unknown as OfflineDataRaw;

let server: SSRServer;
let remote: SSRServer;
let off: SSRServer;

type Answer = { status: number; location: string | undefined; cookies: string[]; cacheControl: string | undefined };

const DOCUMENT = { 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' };

const get = (path: string, headers: Record<string, string> = {}, method = 'GET', port = PORT): Promise<Answer> =>
  new Promise((resolve, reject) => {
    const req = request(`${origin(port)}${path}`, { method, headers }, res => {
      res.resume();
      resolve({
        status: res.statusCode ?? 0,
        location: res.headers.location,
        cookies: res.headers['set-cookie'] ?? [],
        cacheControl: res.headers['cache-control']
      });
    });

    req.on('error', reject);
    req.end();
  });

/** The hint as the server writes it beside a session: `<access expiry>.<refresh expiry>`. */
const hint = (expiresAt: number, refreshExpiresAt?: number) =>
  `test_session_hint=${String(expiresAt)}.${refreshExpiresAt === undefined ? '' : String(refreshExpiresAt)}`;

/** What a browser holds a day after signing in: the hint, and nothing a page is sent. */
const halfLapsed = hint(inSeconds(-60), inSeconds(30 * 86_400));

const cookieNamed = (answer: Answer, name: string): string | undefined =>
  answer.cookies.find(cookie => cookie.startsWith(`${name}=`));

const bouncesToRenewal = (answer: Answer) => answer.status === 303 && answer.location?.startsWith('/auth/refresh');

beforeAll(async () => {
  server = createServer({ port: PORT, devMode: true, adapters: createJsonAdapters({ offlineData }), auth });
  remote = createServer({
    port: REMOTE_PORT,
    devMode: true,
    authCookie: { name: 'test_session' },
    adapters: createJsonAdapters({ offlineData }),
    sessionRenewal: { url: 'https://api.example.test/auth/refresh' }
  });
  off = createServer({
    port: OFF_PORT,
    devMode: true,
    adapters: createJsonAdapters({ offlineData }),
    auth,
    sessionRenewal: false
  });
  server.listen(PORT, '127.0.0.1');
  remote.listen(REMOTE_PORT, '127.0.0.1');
  off.listen(OFF_PORT, '127.0.0.1');

  await vi.waitFor(async () => {
    expect((await fetch(`${BASE}/auth/capabilities`)).status).toBe(200);
    expect((await fetch(`${origin(REMOTE_PORT)}/health`)).status).toBeLessThan(500);
    expect((await fetch(`${origin(OFF_PORT)}/auth/capabilities`)).status).toBe(200);
  });
});

afterAll(async () => {
  await server.close();
  await remote.close();
  await off.close();
});

beforeEach(() => {
  live.clear();
  current = {
    token: 'old-access',
    expiresAt: inSeconds(-60),
    refreshToken: 'refresh-1',
    refreshExpiresAt: inSeconds(86_400)
  };
});

describe('a page asked for with a half-lapsed session', () => {
  it('is sent to renew first, keeping the page it asked for', async () => {
    const answer = await get('/pricing?plan=pro', { ...DOCUMENT, cookie: halfLapsed });

    expect(answer.status).toBe(303);
    expect(answer.location).toBe(`/auth/refresh?redirect=${encodeURIComponent('/pricing?plan=pro')}`);
    expect(answer.cacheControl).toBe('no-store');
    expect(cookieNamed(answer, 'test_session_renewing')).toMatch(/Max-Age=30/u);
  });

  it('is rendered as it is when the access cookie is still there', async () => {
    expect(bouncesToRenewal(await get('/', { ...DOCUMENT, cookie: `test_session=live; ${halfLapsed}` }))).toBe(false);
  });

  it('is rendered as a guest page when there is no session at all', async () => {
    expect(bouncesToRenewal(await get('/', DOCUMENT))).toBe(false);
  });

  it('is not sent when renewal is over, or about to be', async () => {
    expect(bouncesToRenewal(await get('/', { ...DOCUMENT, cookie: hint(inSeconds(-60)) }))).toBe(false);
    expect(bouncesToRenewal(await get('/', { ...DOCUMENT, cookie: hint(inSeconds(-60), inSeconds(10)) }))).toBe(false);
  });

  // What stops a loop after a renewal that worked: the hint then says the access credential is alive, and if the
  // page still arrives without it, renewing again would not bring it either.
  it('is not sent when the hint says the access credential is still alive', async () => {
    const fresh = hint(inSeconds(3600), inSeconds(86_400));

    expect(bouncesToRenewal(await get('/', { ...DOCUMENT, cookie: fresh }))).toBe(false);
  });

  // And after one that failed without ending the session — the refresh cookie never reached the endpoint.
  it('is not sent again while it has just been', async () => {
    const cookie = `${halfLapsed}; test_session_renewing=1`;

    expect(bouncesToRenewal(await get('/', { ...DOCUMENT, cookie }))).toBe(false);
  });

  it('leaves everything that is not a whole-tab navigation alone', async () => {
    const cookie = halfLapsed;

    expect(bouncesToRenewal(await get('/', { cookie }))).toBe(false);
    expect(bouncesToRenewal(await get('/', { 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'iframe', cookie }))).toBe(
      false
    );
    expect(bouncesToRenewal(await get('/', { 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty', cookie }))).toBe(
      false
    );
    expect(bouncesToRenewal(await get('/', { ...DOCUMENT, cookie }, 'POST'))).toBe(false);
  });
});

describe('a page server whose `/auth` lives on another host', () => {
  it('sends a half-lapsed session there to renew, with the page’s whole address to come back to', async () => {
    const answer = await get('/pricing?plan=pro', { ...DOCUMENT, cookie: halfLapsed }, 'GET', REMOTE_PORT);
    const location = new URL(answer.location ?? '');

    expect(answer.status).toBe(303);
    expect(`${location.origin}${location.pathname}`).toBe('https://api.example.test/auth/refresh');
    expect(location.searchParams.get('redirect')).toBe(`${origin(REMOTE_PORT)}/pricing?plan=pro`);
    expect(cookieNamed(answer, 'test_session_renewing')).toBeDefined();
  });

  it('serves no renewal endpoint of its own', async () => {
    const answer = await get(
      '/auth/refresh',
      { ...DOCUMENT, cookie: 'test_session_refresh=refresh-1' },
      'GET',
      REMOTE_PORT
    );

    expect(answer.status).not.toBe(303);
    expect(current?.refreshToken).toBe('refresh-1');
  });
});

describe('renewal turned off', () => {
  it('renders the page as the server sees it', async () => {
    expect(bouncesToRenewal(await get('/', { ...DOCUMENT, cookie: halfLapsed }, 'GET', OFF_PORT))).toBe(false);
  });

  it('still serves the endpoint, for pages rendered elsewhere', async () => {
    const answer = await get(
      '/auth/refresh?redirect=%2F',
      { ...DOCUMENT, cookie: 'test_session_refresh=refresh-1' },
      'GET',
      OFF_PORT
    );

    expect(answer.status).toBe(303);
    expect(current?.refreshToken).not.toBe('refresh-1');
  });
});

describe('GET /auth/refresh', () => {
  it('renews with the refresh cookie and sends the visitor back, signed in', async () => {
    const answer = await get('/auth/refresh?redirect=%2Fpricing%3Fplan%3Dpro', {
      ...DOCUMENT,
      cookie: 'test_session_refresh=refresh-1'
    });

    expect(answer.status).toBe(303);
    expect(answer.location).toBe('/pricing?plan=pro');
    expect(answer.cacheControl).toBe('no-store');

    const access = cookieNamed(answer, 'test_session')?.split(';')[0];
    expect(access).toBeDefined();
    expect(current?.refreshToken).not.toBe('refresh-1');

    const session = await fetch(`${BASE}/auth/session`, { headers: { cookie: access ?? '' } });
    expect(session.status).toBe(200);

    // The hint now says the access credential is alive, so the page it lands on renders instead of bouncing again.
    const landed = await get('/pricing?plan=pro', { ...DOCUMENT, cookie: access ?? '' });
    expect(bouncesToRenewal(landed)).toBe(false);
  });

  it('ends a session that can no longer be renewed, and still sends the visitor back', async () => {
    const answer = await get('/auth/refresh?redirect=%2Fpricing', {
      ...DOCUMENT,
      cookie: 'test_session_refresh=revoked'
    });

    expect(answer.status).toBe(303);
    expect(answer.location).toBe('/pricing');
    // The hint goes with it, which is what keeps the page it lands on from sending the visitor straight back.
    expect(cookieNamed(answer, 'test_session_hint')).toMatch(/Max-Age=0/u);
  });

  it('sends the visitor back untouched when no refresh cookie arrived', async () => {
    const answer = await get('/auth/refresh?redirect=%2Fpricing', DOCUMENT);

    expect(answer.status).toBe(303);
    expect(answer.location).toBe('/pricing');
    expect(cookieNamed(answer, 'test_session')).toBeUndefined();
  });

  it('never sends anybody off this origin', async () => {
    const landsOn = async (target: string) => {
      const path = `/auth/refresh?redirect=${encodeURIComponent(target)}`;

      return (await get(path, { ...DOCUMENT, cookie: 'test_session_refresh=refresh-1' })).location;
    };

    expect(await landsOn('https://evil.test/')).toBe('/');
    expect(await landsOn('//evil.test/')).toBe('/');
  });

  // Rotating a session is not something another site may do from an `<img>`: the refresh cookie rides along on a
  // cross-site request wherever the session cookies are `SameSite=None`.
  it('does not renew for anything but a whole-tab navigation', async () => {
    await get('/auth/refresh?redirect=%2F', {
      'sec-fetch-mode': 'no-cors',
      'sec-fetch-dest': 'image',
      cookie: 'test_session_refresh=refresh-1'
    });

    expect(current?.refreshToken).toBe('refresh-1');
  });
});
