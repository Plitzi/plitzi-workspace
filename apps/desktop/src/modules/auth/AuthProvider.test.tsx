import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../../App';
import { serializeSession } from './session/session';

import type { StoredSession } from './session/session';
import type { ApiClient } from '@pmodules/network';

/**
 * What happens to this window when the server stops accepting its session.
 *
 * The case that sent it here: a stored token still inside its own lifetime, and an API answering 401 to everything.
 * The window believed its clock, showed "could not load your spaces", and stayed signed in to a server that
 * disagreed — no retry, no sign-out, nothing to click. This asserts the whole recovery from the outside, through
 * the real providers, because every piece of it was individually fine while the app was unusable.
 *
 * `useDesktop` falls back to `sessionStorage` outside Electron and its `renewSession` refuses, which is exactly the
 * shape of a session that cannot be renewed.
 */

const SESSION_KEY = 'plitzi-desktop.session';

const stored = (overrides: Partial<StoredSession> = {}): StoredSession => ({
  user: { id: 1, username: 'carlos', email: 'carlos@plitzi.com' },
  accessToken: 'stale-but-unexpired',
  // Hours of life left by this window's own reckoning, which is the point: nothing local can tell it is dead.
  expiresAt: Math.floor(Date.now() / 1000) + 7200,
  refreshToken: 'refresh',
  clientId: 'client-1',
  ...overrides
});

const clientAnswering = (status: number): ApiClient =>
  ({
    baseUrl: 'https://api.test',
    request: vi.fn(() =>
      Promise.resolve(
        status === 200
          ? { ok: true as const, status, data: [] }
          : { ok: false as const, status, reason: 'revoked', error: 'Token Invalid' }
      )
    )
  }) as unknown as ApiClient;

beforeEach(() => {
  sessionStorage.clear();
});

describe('a window whose session the server refuses', () => {
  it('signs itself out and says so, instead of retrying an error forever', async () => {
    sessionStorage.setItem(SESSION_KEY, serializeSession(stored()));

    render(<App api={clientAnswering(401)} />);

    // Back at the way in, with the reason on screen: arriving here mid-task otherwise reads as the app losing its
    // place, and "sign in again" is only an instruction if somebody is told they were signed out.
    expect(await screen.findByText(/session ended/iu)).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: /sign in/iu })).toBeTruthy());
    // And the credential is gone from storage, so a relaunch does not repeat the whole thing.
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('leaves a working session alone, and says nothing about it', async () => {
    sessionStorage.setItem(SESSION_KEY, serializeSession(stored()));

    render(<App api={clientAnswering(200)} />);

    await waitFor(() => expect(sessionStorage.getItem(SESSION_KEY)).not.toBeNull());
    expect(screen.queryByText(/session ended/iu)).toBeNull();
  });

  /**
   * A session that was never there is not a session that ended, and the difference is what the screen says: somebody
   * opening the app for the first time is not told they were signed out of something.
   */
  it('says nothing to somebody who was never signed in', async () => {
    render(<App api={clientAnswering(401)} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /sign in/iu })).toBeTruthy());
    expect(screen.queryByText(/session ended/iu)).toBeNull();
  });
});
