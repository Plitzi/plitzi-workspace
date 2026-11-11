import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CSRF_HINT_META } from './csrf';

import type * as Csrf from './csrf';

/**
 * The token a page echoes on a write it sends with the visitor's session to an API that asks for one: told by the
 * page server which APIs, read from the cookie, renewed once when a refusal says it ran out.
 */

const API = 'https://api.example.test';
const HINT = { apis: [{ origin: API, cookie: 'site_auth_csrf' }], path: '/auth/csrf' };

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** A fetch that writes down what it was asked, and answers from a script. */
const scripted = (...answers: Response[]) => {
  const asked: { url: string; init: RequestInit }[] = [];
  const impl = vi.fn((input: string | URL, init: RequestInit = {}) => {
    asked.push({ url: input.toString(), init });

    return Promise.resolve(answers.shift() ?? json(200, {}));
  });

  return { impl: impl as unknown as typeof fetch, asked };
};

const tokenOf = (init: RequestInit): string | null => new Headers(init.headers).get('x-csrf-token');

const setHint = (hint: unknown) => {
  const meta = document.createElement('meta');
  meta.name = CSRF_HINT_META;
  meta.content = JSON.stringify(hint);
  document.head.append(meta);
};

const clearCookie = () => {
  document.cookie = 'site_auth_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
};

// A module of its own per test: the tokens an API handed out are kept by the module, for the page's life.
let csrfFetch: typeof Csrf.csrfFetch;

beforeEach(async () => {
  vi.resetModules();
  ({ csrfFetch } = await import('./csrf'));
  setHint(HINT);
  document.cookie = 'site_auth_csrf=from-cookie; path=/';
});

afterEach(() => {
  document.head.querySelector(`meta[name="${CSRF_HINT_META}"]`)?.remove();
  clearCookie();
});

describe('csrfFetch', () => {
  it('echoes the cookie’s token on a write sent with the session to an API that asks for one', async () => {
    const { impl, asked } = scripted();
    await csrfFetch(`${API}/profile`, { method: 'PATCH', credentials: 'include', body: '{}' }, impl);

    expect(asked).toHaveLength(1);
    expect(tokenOf(asked[0].init)).toBe('from-cookie');
  });

  // The token is bound to the session: anywhere else it would be a leak, and nothing there asks for it.
  it('sends nothing to an origin the page was not told of, nor on a read, nor without the session', async () => {
    const { impl, asked } = scripted();
    await csrfFetch('https://elsewhere.test/hook', { method: 'POST', credentials: 'include' }, impl);
    await csrfFetch(`${API}/profile`, { credentials: 'include' }, impl);
    await csrfFetch(`${API}/profile`, { method: 'POST', credentials: 'omit' }, impl);

    expect(asked.map(({ init }) => tokenOf(init))).toEqual([null, null, null]);
  });

  it('sends a page that carries no hint as it is', async () => {
    document.head.querySelector(`meta[name="${CSRF_HINT_META}"]`)?.remove();
    const { impl, asked } = scripted();
    await csrfFetch(`${API}/profile`, { method: 'POST', credentials: 'include' }, impl);

    expect(tokenOf(asked[0].init)).toBeNull();
  });

  // A console left open overnight: the token ran out at twelve hours, the session did not.
  it('asks for a new token when the write is refused for it, and sends the write once more', async () => {
    const { impl, asked } = scripted(
      json(403, { message: 'CSRF token expired', reason: 'expired' }),
      json(200, { token: 'renewed' }),
      json(200, { ok: true })
    );
    const response = await csrfFetch(`${API}/profile`, { method: 'PATCH', credentials: 'include', body: '{}' }, impl);

    expect(response.status).toBe(200);
    expect(asked.map(({ url }) => url)).toEqual([`${API}/profile`, `${API}/auth/csrf`, `${API}/profile`]);
    expect(tokenOf(asked[2].init)).toBe('renewed');
    expect(asked[2].init.body).toBe('{}');
  });

  it('asks for one first when the page cannot read its cookie (kept on the API’s own host)', async () => {
    clearCookie();
    const { impl, asked } = scripted(json(200, { token: 'handed-out' }), json(200, {}));
    await csrfFetch(`${API}/profile`, { method: 'POST', credentials: 'include' }, impl);

    expect(asked.map(({ url }) => url)).toEqual([`${API}/auth/csrf`, `${API}/profile`]);
    expect(tokenOf(asked[1].init)).toBe('handed-out');
  });

  // Refused for something else — the person may not do this — it is the answer, and asking again would change nothing.
  it('answers any other refusal as it came, without sending the write again', async () => {
    const { impl, asked } = scripted(json(403, { message: 'Forbidden', reason: 'foreign' }));
    const response = await csrfFetch(`${API}/profile`, { method: 'POST', credentials: 'include' }, impl);

    expect(response.status).toBe(403);
    expect(asked).toHaveLength(1);
  });

  it('ignores a hint it cannot read', async () => {
    document.head.querySelector(`meta[name="${CSRF_HINT_META}"]`)?.remove();
    setHint({ apis: 'not-a-list' });
    const { impl, asked } = scripted();
    await csrfFetch(`${API}/profile`, { method: 'POST', credentials: 'include' }, impl);

    expect(tokenOf(asked[0].init)).toBeNull();
  });
});
