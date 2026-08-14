import { describe, expect, it, vi } from 'vitest';

import { createCsrf } from './csrf';

import type { CsrfCarrier } from './csrf';

const csrf = createCsrf({ secret: 'test-secret', cookie: { name: 'sess' } });

const carrier = (extra: Partial<CsrfCarrier> = {}): CsrfCarrier => ({
  method: 'POST',
  headers: {},
  hostname: 'acme.test',
  ...extra
});

describe('when a token is asked for', () => {
  it('never asks a safe method', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS', 'get']) {
      expect(csrf.required(carrier({ method }))).toBe(false);
    }
  });

  it('asks every method that changes something, once a session is attached', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(csrf.required(carrier({ method, headers: { cookie: 'sess=abc' } }))).toBe(true);
    }
  });

  /**
   * The attack is that the browser attaches the victim's credentials. A request with no session cookie carries
   * none, so there is nothing to forge — and demanding a token there costs every client a round trip before it
   * can even sign in.
   */
  it('does not ask a request that carries no session', () => {
    expect(csrf.required(carrier())).toBe(false);
  });

  /** Login CSRF is real and lesser: another site signing a visitor into an account it controls. Opt-in. */
  it('asks even a sessionless request when the deployment opts into protecting sign-in', () => {
    const strict = createCsrf({ secret: 'test-secret', cookie: { name: 'sess' }, protectSignIn: true });

    expect(strict.required(carrier())).toBe(true);
    expect(strict.required(carrier({ method: 'GET' }))).toBe(false);
    expect(strict.required(carrier({ headers: { authorization: 'Bearer abc' } }))).toBe(false);
  });

  /**
   * A cross-origin page cannot set `Authorization` without a preflight the server would have to allow, so there is
   * nothing to forge. Asking a bearer client for a token would break every API client to protect nobody.
   */
  it('never asks a request carrying a bearer token', () => {
    expect(csrf.required(carrier({ headers: { authorization: 'Bearer abc', cookie: 'sess=abc' } }))).toBe(false);
  });
});

describe('verifying', () => {
  it('accepts a token it issued, echoed in the header', () => {
    const token = csrf.issue('session-a');

    expect(csrf.verify(carrier({ headers: { 'x-csrf-token': token } }), 'session-a')).toEqual({ ok: true });
  });

  /** A form without JavaScript cannot set a header, so the body field is the other half of the design. */
  it('accepts it in the body, for a form that posts without JavaScript', () => {
    const token = csrf.issue('session-a');

    expect(csrf.verify(carrier({ body: { _csrf: token } }), 'session-a')).toEqual({ ok: true });
  });

  it('refuses a request that brought none', () => {
    expect(csrf.verify(carrier(), 'session-a')).toEqual({ ok: false, reason: 'missing' });
  });

  it('refuses something that is not a token', () => {
    for (const bad of ['nonsense', 'v1.a.b', 'v2.a.1.b', 'v1.a.notanumber.b']) {
      expect(csrf.verify(carrier({ headers: { 'x-csrf-token': bad } }), 'session-a').ok).toBe(false);
    }
  });

  /**
   * The binding is the point. Without it an attacker mints a token from their own browser and replays it against a
   * victim, and the double-submit becomes decoration.
   */
  it('refuses a token minted for a different session', () => {
    const token = csrf.issue('session-a');

    expect(csrf.verify(carrier({ headers: { 'x-csrf-token': token } }), 'session-b')).toEqual({
      ok: false,
      reason: 'mismatch'
    });
  });

  it('refuses an unbound token once there is a session', () => {
    const token = csrf.issue();

    expect(csrf.verify(carrier({ headers: { 'x-csrf-token': token } }), 'session-a')).toEqual({
      ok: false,
      reason: 'mismatch'
    });
  });

  /** Signing in has no session yet, and that is exactly the request another site would like to make for you. */
  it('accepts an unbound token when there is no session', () => {
    expect(csrf.verify(carrier({ headers: { 'x-csrf-token': csrf.issue() } }))).toEqual({ ok: true });
  });

  /** Somebody who can WRITE a cookie — a sub-domain they took over — must still not be able to forge one. */
  it('refuses a token signed with another secret', () => {
    const attacker = createCsrf({ secret: 'not-the-secret', cookie: { name: 'sess' } });

    expect(csrf.verify(carrier({ headers: { 'x-csrf-token': attacker.issue('session-a') } }), 'session-a')).toEqual({
      ok: false,
      reason: 'mismatch'
    });
  });

  it('refuses one that has aged out', () => {
    const short = createCsrf({ secret: 'test-secret', ttlSeconds: 1, cookie: { name: 'sess' } });
    const token = short.issue('session-a');

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 5_000);

    expect(short.verify(carrier({ headers: { 'x-csrf-token': token } }), 'session-a')).toEqual({
      ok: false,
      reason: 'expired'
    });

    vi.useRealTimers();
  });

  /** Free defence in depth: it blocks a token that leaked somewhere the cookie did not. */
  it('refuses an echo that disagrees with the cookie it was given', () => {
    const mine = csrf.issue('session-a');
    const other = csrf.issue('session-a');

    expect(
      csrf.verify(
        carrier({ headers: { 'x-csrf-token': mine, cookie: `sess_csrf=${encodeURIComponent(other)}` } }),
        'session-a'
      )
    ).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('accepts when the cookie agrees', () => {
    const token = csrf.issue('session-a');

    expect(
      csrf.verify(
        carrier({ headers: { 'x-csrf-token': token, cookie: `sess_csrf=${encodeURIComponent(token)}` } }),
        'session-a'
      )
    ).toEqual({ ok: true });
  });
});

describe('the cookie it is handed over in', () => {
  const sink = () => {
    const headers: Record<string, string | string[]> = {};

    return {
      res: {
        setHeader: (name: string, value: string | string[]) => {
          headers[name] = value;
        },
        getHeader: (name: string) => headers[name === 'set-cookie' ? 'Set-Cookie' : name]
      },
      cookies: () => (headers['Set-Cookie'] as string[] | undefined) ?? []
    };
  };

  /** `httpOnly` would make it impossible for a page to echo the token back. It carries no authority. */
  it('is readable by the page, unlike the session cookie', () => {
    const { res, cookies } = sink();
    csrf.write({ hostname: 'acme.test' }, res, csrf.issue());

    expect(cookies()[0]).not.toContain('HttpOnly');
    expect(cookies()[0]).toContain('sess_csrf=');
  });

  it('lands beside the session cookie, with the same scope', () => {
    const { res, cookies } = sink();
    csrf.write({ hostname: 'acme.test' }, res, csrf.issue());

    expect(cookies()[0]).toContain('Domain=.acme.test');
    expect(cookies()[0]).toContain('SameSite=None');
    expect(cookies()[0]).toContain('Secure');
  });

  /** `Set-Cookie` legitimately repeats; replacing it is how the session it was written beside gets dropped. */
  it('is added to whatever was already there', () => {
    const { res, cookies } = sink();
    res.setHeader('Set-Cookie', ['sess=abc']);
    csrf.write({ hostname: 'acme.test' }, res, csrf.issue());

    expect(cookies()).toHaveLength(2);
    expect(cookies()[0]).toBe('sess=abc');
  });

  it('reads back what it wrote', () => {
    const token = csrf.issue();

    expect(csrf.read(carrier({ headers: { cookie: `sess_csrf=${encodeURIComponent(token)}` } }))).toBe(token);
  });
});
