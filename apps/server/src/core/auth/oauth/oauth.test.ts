import { describe, expect, it, vi } from 'vitest';

import { createSocialAuth } from './index';
import { codeChallenge, consumeFlow, startFlow } from './state';

import type { AccountRecord } from '../api';

// The authorization-code grant is protocol, not product, and these are the parts of it that are load-bearing: the
// state that binds a callback to the browser that started it, and the redirect target that is an open redirect the
// moment it is trusted.

const SECRET = 'flow-secret';

const ada: AccountRecord = { id: 1, username: 'ada', email: 'ada@example.com', active: true, verified: true };

const build = (overrides: Partial<Parameters<typeof createSocialAuth>[0]> = {}) =>
  createSocialAuth({
    providers: { google: { clientId: 'id', clientSecret: 'secret', redirectUri: 'https://api.test/cb' } },
    config: { secret: SECRET, defaultRedirect: 'https://app.test/spaces', callbackBaseUrl: 'https://api.test' },
    adapters: { linkAccount: () => Promise.resolve(ada) },
    ...overrides
  });

describe('the state that survives the round trip', () => {
  it('reads back a flow it started', () => {
    const { state, cookie } = startFlow('google', '/spaces', SECRET, 600);

    expect(consumeFlow(cookie, 'google', state.nonce, SECRET)).toMatchObject({
      provider: 'google',
      redirect: '/spaces'
    });
  });

  // Each of these is somebody trying to land a callback in a browser that never started one.
  it('refuses a nonce that does not match, a provider that does not match, and a forged value', () => {
    const { state, cookie } = startFlow('google', '/spaces', SECRET, 600);

    expect(consumeFlow(cookie, 'google', 'other-nonce', SECRET)).toBeNull();
    expect(consumeFlow(cookie, 'github', state.nonce, SECRET)).toBeNull();
    expect(consumeFlow(cookie, 'google', state.nonce, 'another-secret')).toBeNull();
    expect(consumeFlow(undefined, 'google', state.nonce, SECRET)).toBeNull();
  });

  it('refuses one that has expired', () => {
    const { state, cookie } = startFlow('google', '/spaces', SECRET, -1);

    expect(consumeFlow(cookie, 'google', state.nonce, SECRET)).toBeNull();
  });

  // RFC 7636: the verifier never leaves this server, only its hash does.
  it('sends the challenge, never the verifier', () => {
    const { state } = startFlow('google', '/spaces', SECRET, 600);
    const started = build().start('google', '/spaces');

    expect(codeChallenge(state.verifier)).not.toBe(state.verifier);
    expect(started?.redirectTo).toContain('code_challenge=');
    expect(started?.redirectTo).not.toContain(state.verifier);
  });
});

describe('where the browser is sent afterwards', () => {
  const target = (redirect: unknown): string => {
    const started = build().start('google', redirect);
    const nonce = new URL(started?.redirectTo ?? '').searchParams.get('state');

    return consumeFlow(started?.stateCookie, 'google', nonce, SECRET)?.redirect ?? '';
  };

  it('keeps a relative path', () => {
    expect(target('/spaces/42')).toBe('/spaces/42');
  });

  // Protocol-relative and backslash variants read as a path but navigate off-site.
  it('refuses the paths that only look relative', () => {
    expect(target('//evil.test/steal')).toBe('https://app.test/spaces');
    expect(target('/\\evil.test')).toBe('https://app.test/spaces');
  });

  it('refuses an absolute URL to an origin nobody allowed', () => {
    expect(target('https://evil.test/steal')).toBe('https://app.test/spaces');
  });

  it('keeps an absolute URL to an allowed one', () => {
    expect(target('https://app.test/spaces/42')).toBe('https://app.test/spaces/42');
  });
});

describe('which providers exist', () => {
  it('registers only the ones with credentials', () => {
    const social = build({
      providers: { google: { clientId: 'id', clientSecret: 'secret' }, github: { clientId: '', clientSecret: '' } }
    });

    expect(social.list().map(entry => entry.id)).toEqual(['google']);
    expect(social.get('github')).toBeUndefined();
  });

  it('takes an adapter the server does not ship', () => {
    const acme = vi.fn(() => ({ id: 'acme', label: 'Acme' }) as never);
    const social = build({
      providers: { acme: { clientId: 'id', clientSecret: 'secret' } },
      customProviders: { acme }
    });

    expect(social.list().map(entry => entry.id)).toEqual(['acme']);
  });

  it('has nothing to start for a provider it does not know', () => {
    expect(build().start('nope', '/')).toBeUndefined();
  });
});

describe('coming back', () => {
  it('refuses a callback with no valid flow, and has nowhere safe to report it', async () => {
    const result = await build().complete('google', { code: 'c', state: 'forged' });

    expect(result).toMatchObject({ ok: false, reason: 'invalid_state' });
    expect(!result.ok && result.redirectTo).toBeUndefined();
  });

  it('reports a refusal at the provider on the vetted target, so the page can say what happened', async () => {
    const social = build();
    const started = social.start('google', '/spaces');
    const nonce = new URL(started?.redirectTo ?? '').searchParams.get('state');

    const result = await social.complete('google', {
      error: 'access_denied',
      state: nonce ?? '',
      stateCookie: started?.stateCookie
    });

    expect(!result.ok && result.redirectTo).toBe('/spaces?error=access_denied');
  });
});
