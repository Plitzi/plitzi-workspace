import { describe, expect, it, vi } from 'vitest';

import { authFailureFromResponse, onAuthFailure, reportAuthFailure, sameRegistrableDomain } from './failureChannel';

describe('authFailureFromResponse', () => {
  it('believes the reason a 401 names', () => {
    expect(authFailureFromResponse(401, { error: 'Token Invalid', reason: 'revoked' })).toBe('revoked');
    expect(authFailureFromResponse(401, { reason: 'inactive' })).toBe('inactive');
  });

  it('treats an unexplained 401 as renewable', () => {
    expect(authFailureFromResponse(401)).toBe('expired');
    expect(authFailureFromResponse(401, { error: 'Unauthorized' })).toBe('expired');
    expect(authFailureFromResponse(401, { reason: 'something-else' })).toBe('expired');
  });

  /**
   * "You may not do this" is not "you are not signed in". Reading it as `inactive` signed a visitor out the moment a
   * screen asked for something their role does not allow — the first-sign-in page lost its whole content that way.
   */
  it('does not read a permission refusal as the end of the session', () => {
    expect(authFailureFromResponse(403, { error: 'Insufficient permissions' })).toBeUndefined();
    expect(authFailureFromResponse(403)).toBeUndefined();
  });

  /** The kernel's CSRF refusal names reasons spelled like session ones; it is still not about the session. */
  it('does not read a CSRF refusal as the end of the session', () => {
    expect(authFailureFromResponse(403, { error: 'CSRF token missing', reason: 'missing' })).toBeUndefined();
    expect(authFailureFromResponse(403, { reason: 'expired' })).toBeUndefined();
  });

  it('says nothing about the session for anything that is not a 401', () => {
    for (const status of [200, 204, 400, 404, 409, 422, 429, 500, 503]) {
      expect(authFailureFromResponse(status, { reason: 'revoked' }), String(status)).toBeUndefined();
    }
  });
});

describe('the failure channel', () => {
  it('hands every report to every listener until it unsubscribes', async () => {
    const listener = vi.fn(() => undefined);
    const unsubscribe = onAuthFailure(listener);

    await reportAuthFailure({ reason: 'revoked', url: 'https://api.example.com/profile' });
    unsubscribe();
    await reportAuthFailure({ reason: 'revoked' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ reason: 'revoked', url: 'https://api.example.com/profile' });
  });

  /** What lets the refused request be asked again: whether anything renewed the session because of it. */
  it('answers whether the session was renewed because of the report', async () => {
    const stopQuiet = onAuthFailure(() => undefined);
    const stopRenewing = onAuthFailure(({ reason }) => Promise.resolve(reason === 'expired'));

    expect(await reportAuthFailure({ reason: 'expired' })).toBe(true);
    expect(await reportAuthFailure({ reason: 'revoked' })).toBe(false);
    stopQuiet();
    stopRenewing();
  });

  /**
   * The builder carries its own `sdk-shared` beside the SDK's: a refusal it reported reached no listener, nothing
   * renewed, and each refused request was an "Authentication required" toast.
   */
  it('is one channel for every copy of it on the page', async () => {
    vi.resetModules();
    const otherCopy = await import('./failureChannel');
    const renew = vi.fn(() => true);
    const stop = onAuthFailure(renew);

    expect(otherCopy.reportAuthFailure).not.toBe(reportAuthFailure);
    expect(await otherCopy.reportAuthFailure({ reason: 'expired', url: 'https://server.plitzi.local/graphql' })).toBe(
      true
    );
    expect(renew).toHaveBeenCalledWith({ reason: 'expired', url: 'https://server.plitzi.local/graphql' });
    stop();
  });

  /** What hid the builder's own copy: refusals reported to no one, and nothing said about it. */
  it('says once on the page that a refusal reached no listener', async () => {
    vi.resetModules();
    const fresh = await import('./failureChannel');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      expect(await fresh.reportAuthFailure({ reason: 'expired', url: 'https://server.plitzi.local/' })).toBe(false);
      expect(await fresh.reportAuthFailure({ reason: 'expired' })).toBe(false);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('nothing on this page listens'));
    } finally {
      warn.mockRestore();
    }
  });

  /** Often reported with `void`: a rejection there would be an unhandled one, and the other listeners' answers lost. */
  it('says a listener that fails and still hears the others', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const stopFailing = onAuthFailure(() => {
      throw new Error('broken listener');
    });
    const stopRenewing = onAuthFailure(() => true);
    try {
      expect(await reportAuthFailure({ reason: 'expired' })).toBe(true);
      expect(error).toHaveBeenCalledWith(expect.stringContaining('A listener failed'), expect.any(Error));
    } finally {
      stopFailing();
      stopRenewing();
      error.mockRestore();
    }
  });

  it('says what another copy left under its key when it is not the set of listeners, and keeps its own', async () => {
    const key = Symbol.for('plitzi.authFailureListeners.v1');
    const scope: Record<symbol, unknown> = globalThis;
    const shared = scope[key];
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      scope[key] = { listeners: [] };
      vi.resetModules();
      const odd = await import('./failureChannel');
      const stop = odd.onAuthFailure(() => true);

      expect(error).toHaveBeenCalledWith(expect.stringContaining('holds object, not the set of listeners'));
      expect(await odd.reportAuthFailure({ reason: 'expired' })).toBe(true);
      stop();
    } finally {
      scope[key] = shared;
      error.mockRestore();
    }
  });

  it('matches backends of one site by registrable domain', () => {
    expect(sameRegistrableDomain('https://api.plitzi.local/auth', 'https://server.plitzi.local/graphql')).toBe(true);
    expect(sameRegistrableDomain('https://api.plitzi.local/auth', 'https://api.example.com/x')).toBe(false);
    expect(sameRegistrableDomain(undefined, 'https://api.plitzi.local')).toBe(false);
  });
});
