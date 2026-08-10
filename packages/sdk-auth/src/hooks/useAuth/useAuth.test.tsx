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
 * The point of rendering on a server that knows who is asking: the browser owes nobody a request.
 *
 * The provider half is pinned in BasicAuthProvider ("trusts a server-rendered identity over everything"). This pins
 * the half between it and the renderer — reading `authenticated`, `user.details`, the token and its expiry off the
 * payload and handing them to `init()`. Break that mapping and nothing looks wrong: the page still renders, still
 * shows the right person, and quietly asks `userUrl` on every load of every server-rendered page. Which is the cost
 * this whole path exists to avoid, so it is asserted as a count of requests, not as a state.
 */
describe('a page the server already resolved the visitor for', () => {
  const rendered = {
    authenticated: true,
    user: {
      details: { id: 1, username: 'ada' },
      accessToken: 'from-ssr',
      expiresAt: inSeconds(3600)
    }
  } as unknown as Server;

  it('asks nobody who the visitor is', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useAuth({ server: rendered, isHydrating: true, provider: 'basic', settings: basicSettings })
    );

    // The decision runs in an effect, so let it settle before concluding that no request was made.
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.authenticated).toBe(true);
  });

  it('carries the credential over, so the page can authenticate its own requests', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>());

    const { result } = renderHook(() =>
      useAuth({ server: rendered, isHydrating: true, provider: 'basic', settings: basicSettings })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.manager.getProvider()?.token?.accessToken).toBe('from-ssr');
  });

  /**
   * The flicker this pins, in the order a person saw it: the page arrives signed in, blinks to its signed-out
   * version, and comes back.
   *
   * `userProvider` is read off the schema, and the schema is not there on the first render of any page that fetches
   * it — so `provider` is `''` for a moment. The manager had no provider to hand the bootstrap to and reported
   * `guest`, which outranked the identity the server had already resolved; the router then picked the `public` page
   * over the `authenticated` one for those commits. Recorded as a sequence, because the end state was always right
   * and only the middle was wrong.
   */
  it('does not blink to signed-out while the schema is still loading', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>());
    const signedIn = {
      authenticated: true,
      user: { details: { id: 1, username: 'ada' }, accessToken: 'from-ssr', expiresAt: inSeconds(3600) }
    } as unknown as Server;

    const seen: boolean[] = [];
    const { rerender } = renderHook(
      ({ provider }: { provider: string }) => {
        const auth = useAuth({ server: signedIn, isHydrating: true, provider, settings: basicSettings });
        seen.push(auth.authenticated);

        return auth;
      },
      // No `userProvider` yet — the schema has not arrived.
      { initialProps: { provider: '' } }
    );

    await act(async () => {
      await Promise.resolve();
    });

    rerender({ provider: 'basic' });
    await act(async () => {
      await Promise.resolve();
    });

    expect(seen).not.toContain(false);
  });

  // A guest is an answer too, but only about credentials the server can see — a token in storage is not one of
  // them, so the browser still gets to decide. What it must not do is treat "guest" as "ask again anyway".
  it('leaves a guest page to the browser rather than inventing a session for it', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useAuth({ server: guestRender, isHydrating: true, provider: 'basic', settings: basicSettings })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.authenticated).toBe(false);
    // Nothing in storage and no hint cookie: no evidence, so no request either.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/**
 * The browser half of signing in: the request succeeds and the page has to notice. Navigation recomputes which page
 * to show from `authenticated`, so if that never flips, a successful login leaves the visitor staring at the form.
 */
describe('signing in from the page', () => {
  it('reports the visitor as authenticated once the request succeeds', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
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
