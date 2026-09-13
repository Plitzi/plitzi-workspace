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
  it('hands every report to every listener until it unsubscribes', () => {
    const listener = vi.fn();
    const unsubscribe = onAuthFailure(listener);

    reportAuthFailure({ reason: 'revoked', url: 'https://api.example.com/profile' });
    unsubscribe();
    reportAuthFailure({ reason: 'revoked' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ reason: 'revoked', url: 'https://api.example.com/profile' });
  });

  it('matches backends of one site by registrable domain', () => {
    expect(sameRegistrableDomain('https://api.plitzi.local/auth', 'https://server.plitzi.local/graphql')).toBe(true);
    expect(sameRegistrableDomain('https://api.plitzi.local/auth', 'https://api.example.com/x')).toBe(false);
    expect(sameRegistrableDomain(undefined, 'https://api.plitzi.local')).toBe(false);
  });
});
