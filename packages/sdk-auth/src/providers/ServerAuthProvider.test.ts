import { afterEach, describe, expect, it, vi } from 'vitest';

import ServerAuthProvider from './ServerAuthProvider';

/**
 * A space whose people sign in through the page server: who is signed in is what the server rendered the page for,
 * and the browser's part is to go and sign in, or to ask to sign out.
 */

const ada = { id: 7, username: 'ada', permissions: ['postPublish'], roles: ['author'] };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ServerAuthProvider', () => {
  it('is whoever the server rendered the page for, with the permissions the space gave them', async () => {
    const provider = new ServerAuthProvider();
    await provider.init({ user: ada });

    expect(provider.getState()).toBe('authenticated');
    expect(provider.user).toEqual(ada);
    expect(provider.can('postPublish')).toBe(true);
    expect(provider.can('spaceManage')).toBe(false);
  });

  it('is nobody when the server rendered the page for nobody', async () => {
    const provider = new ServerAuthProvider();
    await provider.init({});

    expect(provider.getState()).toBe('guest');
  });

  // The page cannot see its own session; asking it to confirm one must not sign the visitor out.
  it('keeps the session the server rendered when asked to confirm it', async () => {
    const provider = new ServerAuthProvider();
    await provider.init({ user: ada });

    expect(await provider.revalidate()).toBe(true);
    expect(provider.getState()).toBe('authenticated');
  });

  it('asks the page server to end the session, and then is nobody', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new ServerAuthProvider({ logoutUrl: '/signout' });
    await provider.init({ user: ada });

    await provider.logout();

    expect(fetchMock).toHaveBeenCalledWith('/signout', { method: 'POST', credentials: 'same-origin' });
    expect(provider.getState()).toBe('guest');
  });

  it('goes to sign in, and comes back to this page', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { pathname: '/write', search: '?draft=1', assign });

    void new ServerAuthProvider().login({});

    expect(assign).toHaveBeenCalledWith(`/auth/sign-in?return=${encodeURIComponent('/write?draft=1')}`);
  });
});
