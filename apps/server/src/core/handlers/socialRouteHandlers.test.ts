import { describe, expect, it, vi } from 'vitest';

import { createSocialAuthRouteHandlers, mountSocialAuthRoutes } from './socialRouteHandlers';
import { createSessionCookies } from '../auth/session';

import type { AuthedRequest, RedirectResponse, SocialRouteHandler } from './types';
import type { SocialAuth } from '../auth/oauth';
import type { SSRSession } from '@plitzi/sdk-shared';

/**
 * Like the rest of this folder: every request and response below is an object literal. If a handler ever reached for
 * something only Express provides, it would fail here first.
 */

const cookies = createSessionCookies({ name: 'test_session' });

const session: SSRSession = { token: 'minted', expiresAt: Math.floor(Date.now() / 1000) + 3600 };

const socialStub = (overrides: Partial<SocialAuth> = {}): SocialAuth =>
  ({
    list: () => [{ id: 'google', label: 'Google', url: '/auth/google/login' }],
    get: () => undefined,
    start: () => ({ redirectTo: 'https://accounts.google.test/o/oauth2?x=1', stateCookie: 'nonce.v', ttl: 600 }),
    complete: () => Promise.resolve({ ok: true as const, redirectTo: 'https://app.test/home', account: { id: 7 } }),
    ...overrides
  }) as unknown as SocialAuth;

const request = (path: string, query: Record<string, unknown> = {}): AuthedRequest => ({
  path,
  hostname: 'app.test',
  headers: {},
  query
});

const response = () => {
  const state = {
    status: 200,
    body: undefined as unknown,
    redirected: undefined as string | undefined,
    headers: [] as string[]
  };

  const res: RedirectResponse = {
    status: (code: number) => {
      state.status = code;

      return res;
    },
    json: (body: unknown) => {
      state.body = body;

      return body;
    },
    redirect: (url: string) => {
      state.redirected = url;

      return url;
    },
    setHeader: (_name: string, value: string | string[]) => {
      state.headers.push(...(Array.isArray(value) ? value : [value]));
    },
    getHeader: () => undefined
  };

  return { res, state };
};

const handlersFor = (social: SocialAuth, issueSession = () => Promise.resolve(session)) =>
  createSocialAuthRouteHandlers({ social, cookies, issueSession });

const run = (
  routes: { path: string; handle: SocialRouteHandler }[],
  path: string,
  req: AuthedRequest,
  res: RedirectResponse
) => {
  const route = routes.find(entry => entry.path === path);
  if (!route) {
    throw new Error(`no route registered at ${path}`);
  }

  return route.handle(req, res);
};

describe('social auth route handlers', () => {
  it('lists exactly the providers that are configured', async () => {
    const routes = handlersFor(socialStub());
    const { res, state } = response();

    await run(routes, '/providers', request('/providers'), res);

    expect(state.status).toBe(200);
    expect(state.body).toEqual({ providers: [{ id: 'google', label: 'Google', url: '/auth/google/login' }] });
  });

  it('starts a flow: holds the state in a cookie and sends the browser to the provider', async () => {
    const routes = handlersFor(socialStub());
    const { res, state } = response();

    await run(routes, '/:provider/login', request('/google/login', { redirect: 'https://app.test/back' }), res);

    expect(state.redirected).toBe('https://accounts.google.test/o/oauth2?x=1');
    expect(state.headers.join(';')).toContain('nonce.v');
  });

  it('reads the provider from the path when the host router fills in no params', async () => {
    const start = vi.fn(() => ({ redirectTo: 'https://p.test/go', stateCookie: 'n', ttl: 60 }));
    const routes = handlersFor(socialStub({ start }));
    const { res } = response();

    await run(routes, '/:provider/login', request('/github/login'), res);

    expect(start).toHaveBeenCalledWith('github', undefined);
  });

  it('answers 404 for a provider that is not registered, rather than redirecting nowhere', async () => {
    const routes = handlersFor(socialStub({ start: () => undefined }));
    const { res, state } = response();

    await run(routes, '/:provider/login', request('/nope/login'), res);

    expect(state.status).toBe(404);
    expect(state.redirected).toBeUndefined();
  });

  it('completes a flow: mints the session, writes its cookies, then redirects', async () => {
    const issueSession = vi.fn(() => Promise.resolve(session));
    const routes = handlersFor(socialStub(), issueSession);
    const { res, state } = response();

    await run(routes, '/:provider/callback', request('/google/callback', { code: 'c', state: 's' }), res);

    expect(issueSession).toHaveBeenCalledWith(7);
    expect(state.headers.join(';')).toContain('minted');
    expect(state.redirected).toBe('https://app.test/home');
  });

  /**
   * The nonce is single-use. Clearing it only on success leaves the one a failed attempt wrote sitting in the
   * browser, where a later attempt can be made to accept it.
   */
  it('clears the flow cookie even when the callback fails', async () => {
    const routes = handlersFor(
      socialStub({
        complete: () => Promise.resolve({ ok: false as const, error: 'bad state', reason: 'invalid_state' })
      })
    );
    const { res, state } = response();

    await run(routes, '/:provider/callback', request('/google/callback', { error: 'access_denied' }), res);

    expect(state.headers.join(';')).toContain('Max-Age=0');
  });

  /** An unvetted target is an open redirect, so a failure with nowhere safe to report ends at the endpoint. */
  it('answers 400 rather than bouncing a failure to an unvetted target', async () => {
    const routes = handlersFor(
      socialStub({
        complete: () => Promise.resolve({ ok: false as const, error: 'bad state', reason: 'invalid_state' })
      })
    );
    const { res, state } = response();

    await run(routes, '/:provider/callback', request('/google/callback'), res);

    expect(state.status).toBe(400);
    expect(state.redirected).toBeUndefined();
  });

  it('redirects a failure that does have a vetted target', async () => {
    const routes = handlersFor(
      socialStub({
        complete: () =>
          Promise.resolve({
            ok: false as const,
            error: 'denied',
            reason: 'access_denied',
            redirectTo: 'https://app.test/login?error=denied'
          })
      })
    );
    const { res, state } = response();

    await run(routes, '/:provider/callback', request('/google/callback'), res);

    expect(state.redirected).toBe('https://app.test/login?error=denied');
  });

  it('answers 500 and reports, rather than throwing, when minting the session fails', async () => {
    const onError = vi.fn();
    const routes = createSocialAuthRouteHandlers({
      social: socialStub(),
      cookies,
      issueSession: () => Promise.reject(new Error('database gone')),
      onError
    });
    const { res, state } = response();

    await run(routes, '/:provider/callback', request('/google/callback'), res);

    expect(state.status).toBe(500);
    expect(onError).toHaveBeenCalled();
  });

  it('hangs every route on a router as a GET', () => {
    const get = vi.fn();
    mountSocialAuthRoutes(
      { get, post: vi.fn() },
      { social: socialStub(), cookies, issueSession: () => Promise.resolve(session) }
    );

    const paths = get.mock.calls.map(call => String(call[0]));

    expect(paths).toEqual(['/providers', '/:provider/login', '/:provider/callback']);
  });
});
