import { describe, expect, it } from 'vitest';

import { createCsrf } from './csrf';
import { applySessionOutcome, authPolicyRules, authRoutes } from './routes';
import { createSessionCookies } from './session';

import type { AuthApi, AuthOutcome } from './api';
import type { AuthRequest } from './routes';
import type { CookieSink } from './session';

// The `/auth` surface as data, exercised with no framework anywhere in sight — which is the property being pinned.
// A host on bare `node:http` binds these the same way an Express one does.

const cookies = createSessionCookies({ name: 'sess', domain: 'example.test' });

const carrier = (over: Partial<AuthRequest> = {}): AuthRequest => ({
  headers: {},
  hostname: 'example.test',
  ...over
});

const recordingApi = () => {
  const calls: { name: string; args: unknown[] }[] = [];
  const record =
    (name: string) =>
    (...args: unknown[]): AuthOutcome => {
      calls.push({ name, args });

      return { ok: true, body: {} };
    };

  const api = {
    describe: record('describe'),
    session: record('session'),
    login: record('login'),
    refresh: record('refresh'),
    logout: record('logout'),
    revokeSessions: record('revokeSessions'),
    exchange: record('exchange'),
    signup: record('signup'),
    forgotPassword: record('forgotPassword'),
    resetPassword: record('resetPassword'),
    validateAccount: record('validateAccount'),
    resendVerification: record('resendVerification'),
    updateProfile: record('updateProfile'),
    confirmEmailChange: record('confirmEmailChange'),
    passwordless: { request: record('passwordless.request'), complete: record('passwordless.complete') }
  } as unknown as AuthApi;

  return { api, calls };
};

const routeFor = (path: string) => {
  const { api, calls } = recordingApi();
  const route = authRoutes({ api, cookies }).find(candidate => candidate.path === path);
  if (!route) {
    throw new Error(`no route for ${path}`);
  }

  return { route, calls };
};

describe('the route table', () => {
  it('describes every flow the api offers, with its method', () => {
    const { api } = recordingApi();

    expect(authRoutes({ api, cookies }).map(route => `${route.method} ${route.path}`)).toEqual([
      'GET /capabilities',
      'GET /csrf',
      'GET /session',
      'POST /login',
      'POST /refresh',
      'POST /logout',
      'POST /sessions/revoke',
      'POST /exchange',
      'POST /signup',
      'POST /forgot-password',
      'POST /reset-password',
      'POST /validate-account',
      'POST /confirm-email',
      'POST /resend-verification-email',
      'POST /profile',
      'POST /password',
      'POST /delete-account',
      'GET /sessions',
      'POST /sessions/revoke-one',
      'POST /sessions/revoke-others',
      'POST /passwordless/request',
      'POST /passwordless/complete',
      'POST /mfa/complete',
      'GET /mfa',
      'POST /mfa/begin',
      'POST /mfa/confirm',
      'POST /mfa/disable',
      'GET /admin/accounts',
      'GET /admin/account',
      'POST /admin/account/status',
      'POST /admin/account/roles',
      'POST /admin/account/delete',
      'POST /admin/impersonate'
    ]);
  });

  it('answers the session question from the actor the guard resolved, with no lookup of its own', async () => {
    const { route, calls } = routeFor('/session');
    const actor = { id: 7, permissions: [] } as unknown as NonNullable<AuthRequest['actor']>;

    await route.handler(carrier({ actor }));

    expect(calls[0]).toEqual({ name: 'session', args: [actor] });
  });

  // The precedence that makes one endpoint serve an API client and a browser. Getting it backwards is a renewal that
  // silently uses the wrong credential.
  it('renews from the body when it carries one, and from the cookie otherwise', async () => {
    const fromBody = routeFor('/refresh');
    await fromBody.route.handler(carrier({ body: { refresh_token: 'body-token' } }));

    expect(fromBody.calls[0]?.args[0]).toBe('body-token');

    const fromCookie = routeFor('/refresh');
    await fromCookie.route.handler(carrier({ headers: { cookie: 'sess_refresh=cookie-token' } }));

    expect(fromCookie.calls[0]?.args[0]).toBe('cookie-token');
  });

  it('reads the session credential from the header first, then the cookie', async () => {
    const { route, calls } = routeFor('/logout');

    await route.handler(carrier({ headers: { authorization: 'Bearer header-token', cookie: 'sess=cookie-token' } }));

    expect(calls[0]?.args).toEqual([{ accessToken: 'header-token', refreshToken: undefined }]);
  });

  it('passes string fields through as strings, whatever arrived', async () => {
    const { route, calls } = routeFor('/reset-password');

    await route.handler(carrier({ body: { token: 'tok', password: { not: 'a string' } } }));

    expect(calls[0]?.args).toEqual(['tok', '']);
  });
});

describe('applying an outcome to the cookies', () => {
  const sink = (): CookieSink & { written: string[] } => {
    const written: string[] = [];

    return {
      written,
      getHeader: () => written,
      setHeader: (_name, value) => {
        written.length = 0;
        written.push(...(Array.isArray(value) ? value : [value]));
      }
    };
  };

  it('writes the session and its readable hint together', () => {
    const res = sink();

    applySessionOutcome(
      carrier(),
      res,
      { ok: true, body: {}, session: { token: 'tok', expiresAt: Math.floor(Date.now() / 1000) + 60 } },
      cookies
    );

    expect(res.written.some(cookie => cookie.startsWith('sess='))).toBe(true);
    expect(res.written.some(cookie => cookie.startsWith('sess_hint='))).toBe(true);
  });

  it('clears all three halves on sign-out', () => {
    const res = sink();

    applySessionOutcome(carrier(), res, { ok: true, body: {}, endSession: true }, cookies);

    expect(res.written).toHaveLength(3);
    expect(res.written.every(cookie => cookie.includes('Max-Age=0'))).toBe(true);
  });

  it('touches nothing when the flow failed', () => {
    const res = sink();

    applySessionOutcome(carrier(), res, { ok: false, status: 401, body: {} }, cookies);

    expect(res.written).toHaveLength(0);
  });
});

describe('the policy derived from the same table', () => {
  it('classifies every route, and only routes that exist', () => {
    const { api } = recordingApi();
    const routes = authRoutes({ api, cookies });
    const classified = authPolicyRules().flatMap(rule => rule.match as string[]);

    expect([...classified].sort()).toEqual(routes.map(route => `/auth${route.path}`).sort());
  });

  it('honours the prefix the host mounted them under', () => {
    expect(authPolicyRules('/api/auth').flatMap(rule => rule.match as string[])).toContain('/api/auth/login');
  });

  // The three that must not be public, and the reason each is not: identity and revocation are the session's own,
  // and an exchange acts for a space so it can never be anonymous.
  it('keeps session, revoke and exchange behind a credential', () => {
    const requirementOf = (path: string) =>
      authPolicyRules().find(rule => (rule.match as string[]).includes(path))?.requirement;

    expect(requirementOf('/auth/session')).toBe('actor');
    expect(requirementOf('/auth/sessions/revoke')).toBe('actor');
    expect(requirementOf('/auth/exchange')).toBe('grant');
  });

  // Renewing and ending a session must work with a lapsed access token, or a live refresh credential could never be
  // revoked — the reason these two are public despite being about an existing session.
  it('leaves refresh and logout reachable without a live session', () => {
    const publicPaths = authPolicyRules().find(rule => rule.requirement === 'public')?.match as string[];

    expect(publicPaths).toContain('/auth/refresh');
    expect(publicPaths).toContain('/auth/logout');
  });
});

/**
 * Which flows the CSRF check is applied to, and — the part that took a bug to get right — which it must not be.
 */
describe('the CSRF guard in front of the flows', () => {
  const build = (protectSignIn = false) => {
    const { api, calls } = recordingApi();
    const csrf = createCsrf({ secret: 'csrf-secret', cookie: { name: 'sess' }, protectSignIn });
    const routes = authRoutes({ api, cookies, csrf });

    const call = (path: string, req: Partial<AuthRequest> = {}) => {
      const route = routes.find(candidate => candidate.path === path);
      if (!route) {
        throw new Error(`no route for ${path}`);
      }

      return route.handler(carrier(req));
    };

    return { call, calls, csrf };
  };

  const signedIn = { cookie: 'sess=live-token' };

  it('refuses a cookie-authenticated write that brought no token', async () => {
    const { call, calls } = build();

    expect(await call('/profile', { headers: signedIn })).toMatchObject({ status: 403, body: { reason: 'missing' } });
    expect(calls).toHaveLength(0);
  });

  it('lets one through with a token bound to that session', async () => {
    const { call, csrf } = build();
    const headers = { ...signedIn, 'x-csrf-token': csrf.issue('live-token') };

    expect(await call('/profile', { headers })).toMatchObject({ ok: true });
  });

  /**
   * The bug this exists for. A browser that still holds a lapsed session cookie — or somebody signing into a second
   * account — was refused a sign-in with a 403, because the default check only asks whether a session cookie is
   * there. The flow does not act on that session; it replaces it.
   */
  it('never demands a token to sign in, even from a browser holding a stale session', async () => {
    const { call } = build();

    for (const path of ['/login', '/signup', '/passwordless/request', '/reset-password', '/confirm-email']) {
      expect(await call(path, { headers: signedIn })).toMatchObject({ ok: true });
    }
  });

  /** Login CSRF: another site posting credentials it controls, so the visitor is signed into the attacker's account. */
  it('refuses a sign-in another site caused', async () => {
    const { call, calls } = build();
    const fromEvil = { origin: 'https://evil.test', 'sec-fetch-site': 'cross-site' };

    for (const path of ['/login', '/passwordless/complete', '/mfa/complete']) {
      expect(await call(path, { headers: fromEvil })).toMatchObject({ status: 403 });
    }

    expect(calls).toHaveLength(0);
  });

  /** The exchange is refused unless the origin is one the space declared, which is narrower than anything here. */
  it('leaves the exchange to the origin check its own grant does', async () => {
    const { call } = build();

    expect(await call('/exchange', { headers: { origin: 'https://a-customer.test' } })).toMatchObject({ ok: true });
  });

  it('does demand one from everybody where the deployment asked for that', async () => {
    const { call, csrf } = build(true);

    expect(await call('/login', {})).toMatchObject({ status: 403 });
    expect(await call('/login', { headers: { 'x-csrf-token': csrf.issue() } })).toMatchObject({ ok: true });
  });

  /** Both authenticate with the refresh credential and must work when the access token has already lapsed. */
  it('leaves refresh and logout alone whatever the deployment asked for', async () => {
    for (const protectSignIn of [false, true]) {
      const { call } = build(protectSignIn);

      expect(await call('/refresh', { headers: signedIn })).toMatchObject({ ok: true });
      expect(await call('/logout', { headers: signedIn })).toMatchObject({ ok: true });
    }
  });

  /** A cross-origin page cannot set `Authorization`, so asking an API client for a token protects nobody. */
  it('never asks a bearer client, not even under protectSignIn', async () => {
    const { call } = build(true);

    expect(await call('/login', { headers: { authorization: 'Bearer abc' } })).toMatchObject({ ok: true });
    expect(await call('/profile', { headers: { authorization: 'Bearer abc' } })).toMatchObject({ ok: true });
  });

  it('is absent entirely when the deployment turned it off', async () => {
    const { api } = recordingApi();
    const route = authRoutes({ api, cookies }).find(candidate => candidate.path === '/profile');

    expect(await route?.handler(carrier({ headers: signedIn }))).toMatchObject({ ok: true });
  });
});
