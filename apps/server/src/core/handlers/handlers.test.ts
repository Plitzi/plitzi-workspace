import { describe, expect, it, vi } from 'vitest';

import { createAuthMiddleware } from './authMiddleware';
import { createAuthRouteHandlers, mountAuthRoutes } from './authRouteHandlers';
import { createAuth } from '../auth/createAuth';

import type { AuthedRequest, JsonResponse, RouteHandler } from './types';
import type { AccountAdapters, AccountRecord } from '../auth/api';
import type { IdentityAdapters } from '../auth/identity';
import type { SSRSession } from '@plitzi/sdk-shared';

/**
 * These exist to keep one promise: that nothing here needs a framework. Every request and response below is an
 * object literal — if a handler ever reached for something only Express provides, it would fail on these first.
 */

const account: AccountRecord = {
  id: 3,
  username: 'ada',
  email: 'ada@example.test',
  active: true,
  verified: true,
  passwordHash: 'stored'
};

const build = () => {
  const sessions = new Map<string, SSRSession>();
  const adapters: IdentityAdapters & AccountAdapters = {
    findAccountByToken: token => {
      const session = sessions.get(token);

      return Promise.resolve(
        session
          ? { ...account, roles: ['editor'], permissions: ['spaceUpdate'], token, expiresAt: session.expiresAt }
          : undefined
      );
    },
    findByUsername: username => Promise.resolve(username === account.username ? account : undefined),
    saveSession: (_userId, session) => {
      sessions.set(session.token, session);

      return Promise.resolve();
    },
    clearSession: () => Promise.resolve(),
    loadAccess: () => Promise.resolve({ roles: ['editor'], permissions: ['spaceUpdate'] })
  };

  return createAuth({
    tokens: { secret: 'test-secret', issuer: 'https://acme.test', audience: [] },
    adapters,
    api: { verifyPassword: plain => Promise.resolve(plain === 'password') }
  });
};

/** A response as any host would hand one over: a status, a JSON body, and a header sink for the cookies. */
const response = () => {
  const sent: { status: number; body: unknown; headers: Record<string, string | string[]> } = {
    status: 0,
    body: undefined,
    headers: {}
  };

  const res: JsonResponse = {
    status: code => {
      sent.status = code;

      return res;
    },
    json: body => (sent.body = body),
    setHeader: (name, value) => {
      sent.headers[name] = value;
    },
    getHeader: name => sent.headers[name]
  };

  return { res, sent };
};

const request = (over: Partial<AuthedRequest> = {}): AuthedRequest => ({
  path: '/login',
  headers: {},
  hostname: 'acme.test',
  ...over
});

describe('auth handlers on a plain object request', () => {
  it('answers a sign-in with the grant and the cookies, through no framework at all', async () => {
    const auth = build();
    const routes = createAuthRouteHandlers({ api: auth.api, cookies: auth.cookies });
    const login = routes.find(route => route.path === '/login' && route.method === 'POST');
    const { res, sent } = response();

    await login?.handle(request({ body: { username: 'ada', password: 'password' } }), res);

    expect(sent.status).toBe(200);
    expect(sent.body).toMatchObject({ success: true, details: { username: 'ada' } });
    expect(sent.headers['Set-Cookie']).toEqual(expect.arrayContaining([expect.stringContaining('plitzi_session=')]));
  });

  it('reports a refusal with a reason rather than only a status', async () => {
    const auth = build();
    const routes = createAuthRouteHandlers({ api: auth.api, cookies: auth.cookies });
    const login = routes.find(route => route.path === '/login');
    const { res, sent } = response();

    await login?.handle(request({ body: { username: 'ada', password: 'wrong' } }), res);

    expect(sent.status).toBe(401);
    expect(sent.body).toMatchObject({ error: 'Invalid credentials' });
  });

  /** The trap this binding exists to absorb: `hostname` is a prototype getter on several frameworks, so a spread
   *  drops it — and every cookie is then named for nowhere. Reading it through a getter proves it is read, not copied. */
  it('reads hostname off the request rather than spreading it', async () => {
    const auth = build();
    const routes = createAuthRouteHandlers({ api: auth.api, cookies: auth.cookies });
    const login = routes.find(route => route.path === '/login');
    const { res, sent } = response();

    const req = Object.create(
      {
        get hostname() {
          return 'acme.test';
        }
      },
      Object.getOwnPropertyDescriptors(request({ body: { username: 'ada', password: 'password' } }))
    ) as AuthedRequest;
    delete (req as { hostname?: string }).hostname;

    await login?.handle(req, res);

    expect(sent.status).toBe(200);
    expect(sent.headers['Set-Cookie']).toEqual(expect.arrayContaining([expect.stringContaining('Domain=.acme.test')]));
  });

  it('answers 500 and reports the failure when a flow throws', async () => {
    const auth = build();
    const onError = vi.fn();
    vi.spyOn(auth.api, 'login').mockRejectedValueOnce(new Error('store is down'));
    const routes = createAuthRouteHandlers({ api: auth.api, cookies: auth.cookies, onError });
    const { res, sent } = response();

    await routes.find(route => route.path === '/login')?.handle(request({ body: {} }), res);

    expect(sent.status).toBe(500);
    expect(sent.body).toEqual({ error: 'Internal server error' });
    expect(onError).toHaveBeenCalledWith(expect.any(Error), { method: 'POST', path: '/login' });
  });

  it('hangs every flow on anything with get and post', () => {
    const auth = build();
    const get: [string, RouteHandler][] = [];
    const post: [string, RouteHandler][] = [];

    mountAuthRoutes(
      {
        get: (path, handler) => get.push([path, handler]),
        post: (path, handler) => post.push([path, handler])
      },
      { api: auth.api, cookies: auth.cookies }
    );

    expect(get.map(([path]) => path)).toContain('/capabilities');
    expect(get.map(([path]) => path)).toContain('/sessions');
    expect(post.map(([path]) => path)).toContain('/login');
    expect(post.map(([path]) => path)).toContain('/admin/account/delete');
    expect(get.length + post.length).toBe(30);
  });
});

describe('the auth guard as middleware', () => {
  it('puts what it resolved on the request and calls on', async () => {
    const auth = build();
    const routes = createAuthRouteHandlers({ api: auth.api, cookies: auth.cookies });
    const login = response();
    await routes
      .find(route => route.path === '/login')
      ?.handle(request({ body: { username: 'ada', password: 'password' } }), login.res);
    const token = (login.sent.body as { access_token: string }).access_token;

    const guard = createAuthMiddleware(auth.identity, { rules: [], fallback: 'actor' });
    const req = request({ path: '/private', headers: { authorization: `Bearer ${token}` } });
    const next = vi.fn();

    await guard(req, response().res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toMatchObject({ id: 3, username: 'ada', roles: ['editor'] });
  });

  it('refuses with the reason a client acts on, and does not call on', async () => {
    const auth = build();
    const guard = createAuthMiddleware(auth.identity, { rules: [], fallback: 'actor' });
    const { res, sent } = response();
    const next = vi.fn();

    await guard(request({ path: '/private' }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(sent.status).toBe(401);
    expect(sent.body).toMatchObject({ error: 'Authentication required', reason: 'missing' });
  });

  // Some APIs answer `message`, some `error`. Only the wording moves: `reason` is beside it either way.
  it('answers the refusal under the key the deployment already uses', async () => {
    const auth = build();
    const guard = createAuthMiddleware(auth.identity, { rules: [], fallback: 'actor' }, { errorKey: 'message' });
    const { res, sent } = response();

    await guard(request({ path: '/private' }), res, vi.fn());

    expect(sent.body).toMatchObject({ message: 'Authentication required', reason: 'missing' });
  });

  it('lets a public path through without reading a credential', async () => {
    const auth = build();
    const guard = createAuthMiddleware(auth.identity, {
      rules: [{ match: ['/health'], requirement: 'public' }],
      fallback: 'actor'
    });
    const next = vi.fn();

    await guard(request({ path: '/health' }), response().res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
