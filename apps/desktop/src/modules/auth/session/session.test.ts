import { describe, expect, it } from 'vitest';

import { isRenewable, isUsable, parseSession, RENEW_WINDOW_SECONDS, serializeSession, toSession } from './session';

import type { StoredSession } from './session';

const NOW = 1_800_000_000;

const session = (overrides: Partial<StoredSession> = {}): StoredSession => ({
  user: { id: 7, username: 'carlos', email: 'carlos@plitzi.com' },
  accessToken: 'access',
  expiresAt: NOW + 3600,
  refreshToken: 'refresh',
  clientId: 'client-1',
  ...overrides
});

describe('a desktop session', () => {
  /**
   * The grant answers with a lifetime, not a moment: `expires_in` is seconds, and the store keeps an absolute
   * time because a session read back from disk hours later has to know whether it is still alive.
   */
  it('is built from what the browser flow granted, plus who it belongs to', () => {
    const granted = { clientId: 'client-1', accessToken: 'access', refreshToken: 'refresh', expiresIn: 3600 };
    const user = { id: 7, username: 'carlos', email: 'carlos@plitzi.com' };

    const built = toSession(granted, user);

    expect(built.user).toEqual(user);
    expect(built.accessToken).toBe('access');
    expect(built.refreshToken).toBe('refresh');
    expect(built.clientId).toBe('client-1');
    expect(built.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000) + 3500);
  });

  it('is usable while there is real time left on it', () => {
    expect(isUsable(session(), NOW)).toBe(true);
  });

  /**
   * The margin is the point: a token with seconds left is not a token, because the request carrying it arrives
   * after it died and the failure lands on whatever the person was doing rather than on the renewal.
   */
  it('is not usable inside the renewal window, though it has not expired yet', () => {
    expect(isUsable(session({ expiresAt: NOW + RENEW_WINDOW_SECONDS - 1 }), NOW)).toBe(false);
  });

  it('is not usable when there is none', () => {
    expect(isUsable(undefined, NOW)).toBe(false);
  });

  it('can be renewed while it holds a refresh token and the registration it was granted to', () => {
    expect(isRenewable(session({ expiresAt: NOW - 10 }))).toBe(true);
  });

  it('cannot be renewed when the flow issued no refresh token', () => {
    expect(isRenewable(session({ refreshToken: undefined }))).toBe(false);
  });

  /**
   * A native client registers per flow — the redirect declares a loopback port the OS picked at the time — so a
   * refresh token with no registration beside it has nothing to present, and the only way back is the browser.
   */
  it('cannot be renewed without the registration, however good the refresh token is', () => {
    expect(isRenewable(session({ clientId: undefined }))).toBe(false);
  });

  it('round-trips through the store', () => {
    expect(parseSession(serializeSession(session()))).toEqual(session());
  });

  it.each([
    ['nothing at all', undefined],
    ['an empty string', ''],
    ['something that is not JSON', 'not json'],
    ['JSON that is not an object', 'null'],
    ['a session with no token', JSON.stringify({ expiresAt: NOW, user: { id: 1 } })],
    ['a session with no user', JSON.stringify({ accessToken: 'a', expiresAt: NOW })],
    ['a shape from another version', JSON.stringify({ access_token: 'a', expire_at: NOW })]
  ])('reads %s as no session', (_label, raw) => {
    expect(parseSession(raw)).toBeUndefined();
  });
});
