import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import useAuth from './useAuth';

import type { AuthProviderSettings } from '../../types';
import type { Server } from '@plitzi/sdk-shared';

const inSeconds = (offset: number) => Math.floor(Date.now() / 1000) + offset;
const settings = { userUrl: '/auth/session', tokenStorage: 'localStorage' } as AuthProviderSettings;
const csrServer = {} as unknown as Server;

const storeSession = () =>
  localStorage.setItem(
    'plitzi_auth_session',
    JSON.stringify({
      version: 1,
      token: { accessToken: 'stored', expiresAt: inSeconds(3600), refreshToken: 'r' },
      user: { id: 1, username: 'ada' },
      validatedAt: inSeconds(-10)
    })
  );

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

/**
 * A client-rendered page, reloaded by somebody who is already signed in.
 *
 * There is no server answer here — the credential is in `localStorage` — and `init()` runs in an effect, so the
 * first paint used to happen before anything had looked at it. The visitor watched the signed-out page flash past
 * on every single reload. The evidence was synchronous the whole time; only the reading of it was late.
 *
 * Asserted as a sequence of commits: the end state was always right, and every one of these bugs lived in the
 * middle of it.
 */
describe('CSR boot', () => {
  it('signed in: never paints as a guest', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>());
    storeSession();
    const seen: boolean[] = [];
    renderHook(() => {
      const a = useAuth({ server: csrServer, provider: 'basic', settings });
      seen.push(a.authenticated);
      return a;
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    console.log('signed in:', seen);
    expect(seen).not.toContain(false);
  });

  // The other direction matters just as much: standing on evidence must not become inventing it.
  it('signed out: never claims a session', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>());
    const seen: boolean[] = [];
    renderHook(() => {
      const a = useAuth({ server: csrServer, provider: 'basic', settings });
      seen.push(a.authenticated);
      return a;
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    console.log('signed out:', seen);
    expect(seen).not.toContain(true);
  });

  /**
   * `userProvider` comes off the schema, so for the first renders of a page that fetches its schema there is no
   * provider at all. Neither "which provider" nor "is anyone signed in" is known then — but only the first of those
   * is actually unknowable: where the credential lives is a matter of settings, not of the provider that will use
   * it. Reporting `guest` in that window is what made this flicker survive the first fix.
   */
  it('schema late, signed in', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>());
    storeSession();
    const seen: boolean[] = [];
    const { rerender } = renderHook(
      ({ provider }: { provider: string }) => {
        const a = useAuth({ server: csrServer, provider, settings });
        seen.push(a.authenticated);
        return a;
      },
      { initialProps: { provider: '' } }
    );
    await act(async () => {
      await Promise.resolve();
    });
    rerender({ provider: 'basic' });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    console.log('schema late:', seen);
    expect(seen).not.toContain(false);
  });
});
