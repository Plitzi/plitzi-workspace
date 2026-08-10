import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import useAuth from './useAuth';

import type { AuthProviderSettings } from '../../types';
import type { Server } from '@plitzi/sdk-shared';

/**
 * `loading` is what holds a space's pages back, so the server and the browser have to agree about it on the very
 * first render — the server emits HTML from one answer and the browser hydrates against the other.
 *
 * The regression these pin: a guest has no `bootstrapUser`, and `loading` keyed off that alone. The server (where
 * `isHydrating` is false) therefore rendered nothing while the browser (where it is true) rendered the whole tree,
 * and React reported a hydration mismatch on every signed-out page of every server-rendered space.
 */

const settings = {} as AuthProviderSettings;

const inSeconds = (offset: number) => Math.floor(Date.now() / 1000) + offset;

const basicSettings = {
  loginUrl: 'https://api.test/auth/login',
  userUrl: 'https://api.test/auth/session',
  tokenStorage: ''
} as AuthProviderSettings;

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const guestRender = { authenticated: false } as unknown as Server;
const signedInRender = { authenticated: true, user: { details: { id: 1, username: 'ada' } } } as unknown as Server;

const authOn = (server: Server | undefined, isHydrating: boolean) =>
  renderHook(() => useAuth({ server, isHydrating, provider: 'basic', settings })).result.current;

const loadingOn = (server: Server | undefined, isHydrating: boolean): boolean => authOn(server, isHydrating).loading;

describe('what the server renders and what the browser hydrates', () => {
  it('agree for a signed-out visitor', () => {
    expect(loadingOn(guestRender, false)).toBe(false); // server
    expect(loadingOn(guestRender, true)).toBe(false); // browser
  });

  it('agree for a signed-in visitor', () => {
    expect(loadingOn(signedInRender, false)).toBe(false);
    expect(loadingOn(signedInRender, true)).toBe(false);
  });
});

// Without a server render nobody has answered yet, so the page does wait — that is the case `loading` exists for.
describe('a page rendered in the browser alone', () => {
  it('waits until auth has decided', () => {
    expect(loadingOn(undefined, false)).toBe(true);
  });
});

/**
 * `authenticated` is what page-level access rules are evaluated against. It used to read only `state`, which is set
 * from `init()` — an effect, and effects do not run on the server. So a server render resolved the visitor, put them
 * in the payload, and then rendered as if nobody were signed in: an `accessLevel: 'authenticated'` page never won,
 * and the browser then chose a different page than the HTML it was hydrating.
 */
describe('who the page thinks is looking at it', () => {
  it('takes the server’s answer before the browser has decided', () => {
    expect(authOn(signedInRender, false).authenticated).toBe(true); // server
    expect(authOn(signedInRender, true).authenticated).toBe(true); // browser, first render
  });

  it('does not invent one for a guest', () => {
    expect(authOn(guestRender, false).authenticated).toBe(false);
    expect(authOn(guestRender, true).authenticated).toBe(false);
  });

  it('says nobody when no server rendered the page', () => {
    expect(authOn(undefined, false).authenticated).toBe(false);
  });
});

/**
 * The browser half of signing in: the request succeeds and the page has to notice. Navigation recomputes which page
 * to show from `authenticated`, so if that never flips, a successful login leaves the visitor staring at the form.
 */
describe('signing in from the page', () => {
  it('reports the visitor as authenticated once the request succeeds', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ details: { id: 1, username: 'ada' }, access_token: 'tok', expire_at: inSeconds(3600) }),
        { status: 200 }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useAuth({ server: guestRender, isHydrating: true, provider: 'basic', settings: basicSettings })
    );

    expect(result.current.authenticated).toBe(false);

    await act(async () => {
      await result.current.manager.login({ username: 'ada', password: 'pw' });
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(result.current.authenticated).toBe(true);
  });
});
