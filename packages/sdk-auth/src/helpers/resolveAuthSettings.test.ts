import { describe, expect, it } from 'vitest';

import { resolveAuthSettings } from './resolveAuthSettings';

import type { ServerAuth } from '@plitzi/sdk-shared';

/** What `createServer({ auth })` hands every page it renders. */
const served: ServerAuth = {
  userProvider: 'basic',
  loginUrl: '/auth/login',
  userUrl: '/auth/session',
  refreshUrl: '/auth/refresh',
  logoutUrl: '/auth/logout',
  sessionHintCookie: 'acme_session_hint'
};

describe('the provider a page signs in with', () => {
  it('is the server’s, whole, when the space declares nothing', () => {
    expect(resolveAuthSettings(undefined, { tokenStorage: 'localStorage' }, served)).toEqual({
      provider: 'basic',
      settings: {
        tokenStorage: 'localStorage',
        loginUrl: '/auth/login',
        userUrl: '/auth/session',
        refreshUrl: '/auth/refresh',
        logoutUrl: '/auth/logout',
        sessionHintCookie: 'acme_session_hint'
      }
    });
  });

  // The builder leaves a cleared field as `''`: a value nobody filled in, not one that says "none".
  it('reads an empty provider and empty settings as undeclared', () => {
    const { provider, settings } = resolveAuthSettings('', { loginUrl: '', userUrl: undefined }, served);

    expect(provider).toBe('basic');
    expect(settings).toMatchObject({ loginUrl: '/auth/login', userUrl: '/auth/session' });
  });

  it('is the space’s, setting by setting, where it declares the same provider', () => {
    const { provider, settings } = resolveAuthSettings(
      'basic',
      { loginUrl: 'https://api.acme.test/auth/login', sessionHintCookie: 'mine_hint' },
      served
    );

    expect(provider).toBe('basic');
    expect(settings).toMatchObject({
      loginUrl: 'https://api.acme.test/auth/login',
      sessionHintCookie: 'mine_hint',
      userUrl: '/auth/session',
      refreshUrl: '/auth/refresh'
    });
  });

  /**
   * The hosted platform's case, and any space signing in somewhere else: a hint cookie or an endpoint borrowed from a
   * different backend would be read against the wrong one — a hint nobody writes reads as "nobody is signed in".
   */
  it('ignores the server altogether where the space names another provider', () => {
    const declared = { loginUrl: '/auth/sign-in' };

    expect(resolveAuthSettings('server', declared, served)).toEqual({ provider: 'server', settings: declared });
  });

  it('is the space’s alone when no server describes one', () => {
    const declared = { loginUrl: 'https://api.acme.test/auth/login' };

    expect(resolveAuthSettings('basic', declared, undefined)).toEqual({ provider: 'basic', settings: declared });
  });

  it('is none when neither names one', () => {
    expect(resolveAuthSettings(undefined, {}, undefined)).toEqual({ provider: '', settings: {} });
  });

  it('leaves out what the server does not offer', () => {
    const { settings } = resolveAuthSettings(undefined, {}, { userProvider: 'basic', loginUrl: '/auth/login' });

    expect(settings.refreshUrl).toBeUndefined();
    expect(settings.mfaUrl).toBeUndefined();
  });
});
