import { Readable } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import {
  clearSessionCookies,
  isLocalHost,
  readSessionToken,
  sessionCookieParams,
  writeSessionCookies
} from './session';

import type { SSRRequest, SSRResponseHelpers, SSRSession } from '@plitzi/sdk-shared';

// The mechanics of carrying a session live here rather than in the deployment, because a server that brings its own
// user database must not also have to reinvent cookies. These tests are the contract that makes that safe to rely on.

const requestFrom = (hostname: string, cookie?: string): SSRRequest =>
  ({ hostname, headers: cookie ? { cookie } : {}, query: {} }) as unknown as SSRRequest;

const responseSpy = () => {
  const headers: Record<string, string | string[]> = {};

  return {
    res: {
      setHeader: (name: string, value: string | string[]) => {
        headers[name] = value;
      }
    } as unknown as SSRResponseHelpers,
    cookies: () => (headers['Set-Cookie'] as string[] | undefined) ?? []
  };
};

const inSeconds = (offset: number) => Math.floor(Date.now() / 1000) + offset;

const session: SSRSession = {
  token: 'access',
  expiresAt: inSeconds(3600),
  refreshToken: 'renew',
  refreshExpiresAt: inSeconds(86400)
};

describe('session cookie defaults', () => {
  // An app and the API it talks to are rarely the same host, so the default has to survive that: shared across
  // sub-domains, and SameSite=None so it is sent at all.
  it('shares the cookie across sub-domains of a real host', () => {
    const params = sessionCookieParams('app.example.com');

    expect(params).toMatchObject({ domain: '.example.com', secure: true, sameSite: 'none' });
  });

  // Secure + SameSite=None over plain http is dropped by every browser, so localhost gets the opposite — and no
  // Domain at all, which browsers refuse on a single-label host.
  it('gives a local server cookies a browser will actually keep', () => {
    const params = sessionCookieParams('localhost');

    expect(params).toMatchObject({ domain: undefined, secure: false, sameSite: 'lax' });
  });

  it('lets a deployment name its cookie per host, which is the part only it knows', () => {
    const params = sessionCookieParams('api-dev.plitzi.com', {
      name: hostname => (hostname.includes('-dev.') ? 'plitzi_auth_dev' : 'plitzi_auth')
    });

    expect(params.name).toBe('plitzi_auth_dev');
  });

  // An address has no registrable domain to share cookies across, so a Domain written for one would never be sent
  // back to it and the browser would silently drop the cookie.
  it('gives an IP host no domain at all', () => {
    const params = sessionCookieParams('192.168.1.5');

    expect(params).toMatchObject({ domain: undefined });
  });
});

describe('writing a granted session', () => {
  it('writes the credential, the refresh half on its own path, and the readable hint', () => {
    const { res, cookies } = responseSpy();

    writeSessionCookies(requestFrom('app.example.com'), res, session);

    const written = cookies();
    expect(written).toHaveLength(3);
    expect(written[0]).toContain('plitzi_session=access');
    expect(written[0]).toContain('HttpOnly');
    // Confined to /auth so it never rides along on ordinary traffic — the credential that can mint new ones is
    // the one worth stealing.
    expect(written[1]).toContain('plitzi_session_refresh=renew');
    expect(written[1]).toContain('Path=/auth');
    expect(written[2]).toContain(`plitzi_session_hint=${session.expiresAt}.${session.refreshExpiresAt}`);
    expect(written[2]).not.toContain('HttpOnly');
  });

  // The hint is what a page reads to tell "somebody is signed in here" from "nobody is", and getting its lifetime
  // wrong breaks that in both directions: too short reports a renewable session as gone, too long sends clients to
  // renew a credential that no longer exists.
  it('keeps the hint alive as long as the session can still be renewed', () => {
    const { res, cookies } = responseSpy();

    writeSessionCookies(requestFrom('app.example.com'), res, session);

    const maxAge = (cookie: string) => Number(/Max-Age=(\d+)/.exec(cookie)?.[1]);
    expect(maxAge(cookies()[2])).toBeGreaterThan(maxAge(cookies()[0]));
  });

  it('carries no hint beyond the expiries — it grants nothing', () => {
    const { res, cookies } = responseSpy();

    writeSessionCookies(requestFrom('app.example.com'), res, session);

    expect(cookies()[2]).not.toContain('access');
    expect(cookies()[2]).not.toContain('renew');
  });

  it('writes no refresh cookie for a session that cannot be renewed', () => {
    const { res, cookies } = responseSpy();

    writeSessionCookies(requestFrom('app.example.com'), res, { token: 'access', expiresAt: inSeconds(3600) });

    expect(cookies()).toHaveLength(2);
  });
});

describe('ending a session', () => {
  it('clears every cookie the grant wrote, the readable one included', () => {
    const { res, cookies } = responseSpy();

    clearSessionCookies(requestFrom('app.example.com'), res);

    expect(cookies()).toHaveLength(3);
    expect(cookies().every(cookie => cookie.includes('Max-Age=0'))).toBe(true);
    // A hint left behind would keep telling the next page load that somebody is signed in.
    expect(cookies()[2]).toContain('plitzi_session_hint=');
  });
});

describe('reading a session back', () => {
  it('finds the credential under the name this deployment writes it with', () => {
    const config = { name: 'plitzi_auth_dev' };
    const { res, cookies } = responseSpy();
    writeSessionCookies(requestFrom('api-dev.plitzi.com'), res, session, config);

    const jar = cookies()
      .map(cookie => cookie.split(';')[0])
      .join('; ');

    expect(readSessionToken(requestFrom('api-dev.plitzi.com', jar), config)).toBe('access');
  });

  it('reports nothing when the browser carries nothing', () => {
    expect(readSessionToken(requestFrom('app.example.com'))).toBeUndefined();
    expect(readSessionToken(requestFrom('app.example.com', 'other=1'))).toBeUndefined();
  });
});

describe('the login route', () => {
  const runLogin = async (adapters: Record<string, unknown>, body: string, contentType = 'application/json') => {
    const { loginStage } = await import('../http/stages/authRoutes');
    const { res, cookies } = responseSpy();
    const status = { code: 0 };
    // Captured, because a status alone proved nothing about what a caller receives — this route once answered a
    // bodyless 200 and every assertion here still passed.
    const sent: string[] = [];
    const req = {
      hostname: 'app.example.com',
      method: 'POST',
      path: '/auth/login',
      headers: { 'content-type': contentType },
      query: {}
    } as unknown as SSRRequest;

    await loginStage({
      config: { adapters },
      raw: Readable.from([Buffer.from(body)]),
      req,
      res: {
        ...res,
        setStatus: (code: number) => (status.code = code),
        send: (payload: string) => sent.push(payload),
        end: vi.fn()
      }
    } as never);

    return { status, cookies, req, body: sent.length ? (JSON.parse(sent[0]) as Record<string, unknown>) : undefined };
  };

  it('hands every posted field to the adapter, because only it knows what it signs people in with', async () => {
    const authenticate = vi.fn().mockResolvedValue(session);
    const { status, cookies, body } = await runLogin(
      { authenticate },
      JSON.stringify({ email: 'ada@example.com', otp: '123456' })
    );

    expect(authenticate).toHaveBeenCalledWith({ email: 'ada@example.com', otp: '123456' }, expect.anything());
    expect(status.code).toBe(200);
    expect(cookies()).toHaveLength(3);
    // The token, not just the cookies: a caller that is not a browser has nowhere to read those from.
    expect(body).toEqual({ success: true, access_token: 'access', expire_at: session.expiresAt });
  });

  it('writes nothing when the adapter refuses', async () => {
    const { status, cookies, body } = await runLogin(
      { authenticate: vi.fn().mockResolvedValue(undefined) },
      JSON.stringify({ username: 'ada', password: 'wrong' })
    );

    expect(status.code).toBe(401);
    expect(cookies()).toHaveLength(0);
    expect(body).toEqual({ error: 'Invalid credentials', reason: 'invalid' });
  });
});

// A plitzi deployment names its cookies per environment (one name per browser open, so a dev session is never sent
// to staging) and hosts its apps on `.plitzi.local` in dev — a host the kernel's isLocalHost does not know, as it
// recognizes only loopback and `.localhost`. So the deployment picks the local cookie name itself, while the
// domain, Secure and SameSite policy still come from here: a real registrable host gets the strict profile even
// when its name says local.
describe('a plitzi deployment', () => {
  const plitziCookieName = (hostname: string): string => {
    if (isLocalHost(hostname) || hostname.endsWith('.plitzi.local')) {
      return 'plitzi_auth_local';
    }

    if (hostname.includes('-stg.')) {
      return 'plitzi_auth_stg';
    }

    if (hostname.includes('-dev.')) {
      return 'plitzi_auth_dev';
    }

    return 'plitzi_auth';
  };

  const config = { name: plitziCookieName };

  // host, expected name, expected domain, secure, sameSite
  const deployments: Array<[string, string, string | undefined, boolean, 'lax' | 'none']> = [
    ['localhost', 'plitzi_auth_local', undefined, false, 'lax'],
    ['127.0.0.1', 'plitzi_auth_local', undefined, false, 'lax'],
    ['::1', 'plitzi_auth_local', undefined, false, 'lax'],
    ['app.plitzi.local', 'plitzi_auth_local', '.plitzi.local', true, 'none'],
    ['server.plitzi.local', 'plitzi_auth_local', '.plitzi.local', true, 'none'],
    ['ssr.plitzi.local', 'plitzi_auth_local', '.plitzi.local', true, 'none'],
    ['mcp.plitzi.local', 'plitzi_auth_local', '.plitzi.local', true, 'none'],
    ['plitzi.com', 'plitzi_auth', '.plitzi.com', true, 'none'],
    // The -stg. / -dev. naming matches hosts like app.plitzi-stg.com, not a bare stg.plitzi.com label.
    ['stg.plitzi.com', 'plitzi_auth', '.plitzi.com', true, 'none'],
    ['dev.plitzi.com', 'plitzi_auth', '.plitzi.com', true, 'none'],
    ['api.plitzi.com', 'plitzi_auth', '.plitzi.com', true, 'none'],
    ['app.plitzi-stg.com', 'plitzi_auth_stg', '.plitzi-stg.com', true, 'none'],
    ['app.plitzi-dev.com', 'plitzi_auth_dev', '.plitzi-dev.com', true, 'none'],
    ['website.plitzi.app', 'plitzi_auth', '.plitzi.app', true, 'none'],
    ['192.168.1.5', 'plitzi_auth', undefined, true, 'none']
  ];

  it.each(deployments)('derives cookies for %s', (host, name, domain, secure, sameSite) => {
    expect(sessionCookieParams(host, config)).toEqual({
      name,
      domain,
      secure,
      sameSite,
      refreshPath: '/auth',
      hintSuffix: '_hint'
    });
  });

  it('writes and reads back a session on the dev app host', () => {
    const { res, cookies } = responseSpy();

    writeSessionCookies(requestFrom('app.plitzi.local'), res, session, config);

    expect(cookies()[0]).toContain('plitzi_auth_local=access');
    expect(cookies()[0]).toContain('Domain=.plitzi.local');
    expect(cookies()[0]).toContain('SameSite=None');
    expect(cookies()[0]).toContain('Secure');

    const jar = cookies()
      .map(cookie => cookie.split(';')[0])
      .join('; ');
    expect(readSessionToken(requestFrom('app.plitzi.local', jar), config)).toBe('access');
  });

  it('keeps a production session apart from a staging one in one browser', () => {
    const { res: prod, cookies: prodCookies } = responseSpy();
    const { res: staging, cookies: stagingCookies } = responseSpy();
    const { res: dev, cookies: devCookies } = responseSpy();

    writeSessionCookies(requestFrom('plitzi.com'), prod, session, config);
    writeSessionCookies(requestFrom('app.plitzi-stg.com'), staging, session, config);
    writeSessionCookies(requestFrom('app.plitzi-dev.com'), dev, session, config);

    expect(prodCookies()[0]).toContain('plitzi_auth=');
    expect(stagingCookies()[0]).toContain('plitzi_auth_stg=');
    expect(devCookies()[0]).toContain('plitzi_auth_dev=');
  });
});
