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

  /**
   * A cross-origin page cannot set `Authorization` without a preflight the server would have to allow, so there is
   * nothing to forge. Asking a bearer client for a token would break every API client to protect nobody.
   */
  it('never asks a request carrying a bearer token', () => {
    expect(csrf.required(carrier({ headers: { authorization: 'Bearer abc', cookie: 'sess=abc' } }))).toBe(false);
  });
});

/**
 * Signing in cannot be judged by "is there a session cookie" — the flow replaces that cookie, and a browser still
 * holding a stale one was being refused the very request that fixes it. What separates login CSRF from an ordinary
 * sign-in is not the cookie; it is that another site caused the request. So that is what is asked.
 */
describe('what a sign-in has to present', () => {
  const signIn = (over: Partial<CsrfCarrier> = {}) => csrf.required(carrier(over), 'signIn');

  it('asks nothing of a page on this deployment, cookie or no cookie', () => {
    expect(signIn()).toBe(false);
    expect(signIn({ headers: { cookie: 'sess=stale' } })).toBe(false);
    expect(signIn({ headers: { origin: 'https://acme.test' } })).toBe(false);
    expect(signIn({ headers: { 'sec-fetch-site': 'same-origin' } })).toBe(false);
  });

  /** The registrable domain, which is the same rule that decides how far the session cookie itself travels. */
  it('counts a sibling sub-domain as this deployment', () => {
    expect(signIn({ headers: { origin: 'https://app.acme.test' } })).toBe(false);
    expect(
      csrf.required(carrier({ hostname: 'api.acme.test', headers: { origin: 'https://app.acme.test' } }), 'signIn')
    ).toBe(false);
  });

  /** The attack: a page on another site posting credentials it controls, so the visitor is signed into them. */
  it('demands a token from another site', () => {
    expect(signIn({ headers: { origin: 'https://evil.test' } })).toBe(true);
    expect(signIn({ headers: { 'sec-fetch-site': 'cross-site', origin: 'https://evil.test' } })).toBe(true);
  });

  /** `Sec-Fetch-Site` is the browser's own account and cannot be set by script, so it is believed over `Origin`. */
  it('believes the browser over a header a page could have chosen', () => {
    expect(signIn({ headers: { 'sec-fetch-site': 'cross-site', origin: 'https://acme.test' } })).toBe(true);
    expect(signIn({ headers: { 'sec-fetch-site': 'same-site', origin: 'https://evil.test' } })).toBe(false);
  });

  it('lets the deployment name origins that are also its own', () => {
    const withApp = createCsrf({
      secret: 'test-secret',
      cookie: { name: 'sess' },
      allowedOrigins: ['https://console.other.test']
    });

    expect(withApp.required(carrier({ headers: { origin: 'https://console.other.test' } }), 'signIn')).toBe(false);
    expect(withApp.required(carrier({ headers: { origin: 'https://evil.test' } }), 'signIn')).toBe(true);
  });

  /** A sandboxed iframe or a `data:` document. There is plainly a browser, and nothing can vouch for it. */
  it('demands one from an opaque origin', () => {
    expect(signIn({ headers: { origin: 'null', 'sec-fetch-site': 'cross-site' } })).toBe(true);
    expect(signIn({ headers: { 'sec-fetch-site': 'cross-site' } })).toBe(true);
  });

  /**
   * Neither header means this is not a browser — and a client that is not a browser has no victim's session in it
   * to forge with. This is what keeps every API client, mobile app and script signing in with nothing extra.
   */
  it('asks nothing of a client that is not a browser', () => {
    expect(signIn({ headers: { 'user-agent': 'curl/8.4.0' } })).toBe(false);
  });

  it('never asks a safe method or a bearer client, whatever the origin', () => {
    expect(signIn({ method: 'GET', headers: { origin: 'https://evil.test' } })).toBe(false);
    expect(signIn({ headers: { origin: 'https://evil.test', authorization: 'Bearer abc' } })).toBe(false);
  });

  /** The stricter form: no reliance on either header, at the cost of a round trip for every client. */
  it('asks everyone when the deployment says so', () => {
    const strict = createCsrf({ secret: 'test-secret', cookie: { name: 'sess' }, protectSignIn: true });

    expect(strict.required(carrier(), 'signIn')).toBe(true);
    expect(strict.required(carrier({ method: 'GET' }), 'signIn')).toBe(false);
    expect(strict.required(carrier({ headers: { authorization: 'Bearer abc' } }), 'signIn')).toBe(false);
  });

  /**
   * `/auth/exchange` acts for a space and is already refused unless the origin is one that space declared — which
   * is narrower than any list here. Asking again would refuse every legitimate embed, since a space is embedded on
   * somebody else's domain by design.
   */
  it('leaves a flow that checks the origin itself alone', () => {
    expect(csrf.required(carrier({ headers: { origin: 'https://a-customer.test' } }), 'delegated')).toBe(false);

    const strict = createCsrf({ secret: 'test-secret', cookie: { name: 'sess' }, protectSignIn: true });
    expect(strict.required(carrier(), 'delegated')).toBe(true);
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
