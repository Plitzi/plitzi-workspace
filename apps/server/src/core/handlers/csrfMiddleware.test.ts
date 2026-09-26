import { describe, expect, it, vi } from 'vitest';

import { createOriginGuardMiddleware } from './csrfMiddleware';
import { createCsrf } from '../auth/csrf';

import type { AuthedRequest, JsonResponse } from './types';

/**
 * A cookie-carried write refused by where it came from.
 *
 * The attack: a page on another site makes the victim's browser send a write, and the browser attaches the session
 * cookie. A form POST needs no preflight, so CORS never gets a say — this does.
 */

const csrf = createCsrf({
  secret: 'test-secret',
  cookie: { name: 'sess' },
  allowedOrigins: ['https://dashboard.acme.test']
});

const run = (
  headers: Record<string, string>,
  options: Parameters<typeof createOriginGuardMiddleware>[1] = {},
  method = 'POST'
) => {
  const next = vi.fn();
  const sent = { status: 0, body: undefined as unknown };
  const res = {
    status: (code: number) => {
      sent.status = code;

      return res;
    },
    json: (body: unknown) => {
      sent.body = body;
    }
  } as unknown as JsonResponse;
  const req = { method, path: '/devices', hostname: 'api.acme.test', headers } as unknown as AuthedRequest;

  createOriginGuardMiddleware(csrf, options)(req, res, next);

  return { passed: next.mock.calls.length === 1, sent };
};

const COOKIE = { cookie: 'sess=victim' };

describe('the origin guard', () => {
  it('refuses a cookie-carried write another site caused', () => {
    const { passed, sent } = run({ ...COOKIE, 'sec-fetch-site': 'cross-site', origin: 'https://evil.test' });

    expect(passed).toBe(false);
    expect(sent).toEqual({ status: 403, body: { message: expect.any(String) as string, reason: 'foreign' } });
  });

  /** Browsers too old for Fetch Metadata still send `Origin`, matched exactly. */
  it('refuses it by Origin alone when there is no Fetch Metadata', () => {
    expect(run({ ...COOKIE, origin: 'https://evil.test' }).passed).toBe(false);
  });

  it('lets the deployment’s own pages through, same-site or named', () => {
    expect(run({ ...COOKIE, 'sec-fetch-site': 'same-site', origin: 'https://auth.acme.test' }).passed).toBe(true);
    expect(run({ ...COOKIE, 'sec-fetch-site': 'cross-site', origin: 'https://dashboard.acme.test' }).passed).toBe(true);
  });

  /** A published site calling its own space is not forging anything: its origin is what the credential declares. */
  it('lets through an origin the request’s space credential declares', () => {
    const headers = { ...COOKIE, 'sec-fetch-site': 'cross-site', origin: 'https://shop.example' };

    expect(run(headers, { allowedFor: () => ['https://shop.example'] }).passed).toBe(true);
    expect(run(headers, { allowedFor: () => true }).passed).toBe(true);
    expect(run(headers, { allowedFor: () => ['https://other.example'] }).passed).toBe(false);
  });

  /** Nothing to borrow: no cookie, a bearer, a read, or a script (which sends neither header). */
  it('never stands in the way of what has no victim’s cookie to use', () => {
    const foreign = { 'sec-fetch-site': 'cross-site', origin: 'https://evil.test' };

    expect(run(foreign).passed).toBe(true);
    expect(run({ ...COOKIE, ...foreign, authorization: 'Bearer abc' }).passed).toBe(true);
    expect(run({ ...COOKIE, ...foreign }, {}, 'GET').passed).toBe(true);
    expect(run(COOKIE).passed).toBe(true);
  });

  it('leaves exempt paths alone', () => {
    const headers = { ...COOKIE, 'sec-fetch-site': 'cross-site', origin: 'https://evil.test' };

    expect(run(headers, { exempt: path => path === '/devices' }).passed).toBe(true);
  });

  /**
   * An Express request is an `IncomingMessage`, whose `headers` is a getter on the PROTOTYPE: a guard that spread the
   * request into a carrier read no headers at all and threw on every request — the sign-in included.
   */
  it('reads a real request, whose headers live on its prototype', () => {
    class IncomingLike {
      method = 'POST';
      path = '/devices';
      hostname = 'api.acme.test';
      get headers() {
        return { ...COOKIE, 'sec-fetch-site': 'cross-site', origin: 'https://evil.test' };
      }
    }
    const next = vi.fn();
    const res = { status: () => res, json: vi.fn() } as unknown as JsonResponse;

    expect(() =>
      createOriginGuardMiddleware(csrf)(new IncomingLike() as unknown as AuthedRequest, res, next)
    ).not.toThrow();
    expect(next).not.toHaveBeenCalled();
  });
});
