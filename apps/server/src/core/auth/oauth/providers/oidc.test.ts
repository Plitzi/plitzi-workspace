import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createOidcProvider, discoverOidc } from './oidc';
import { fakeIssuer } from '../../tests/fakeIssuer';
import { createSocialAuth } from '../index';

import type { AccountRecord } from '../../api';
import type { OAuthProfile } from '../types';

// Each test names an issuer of its own: discovery documents and key sets are kept per issuer for an hour.
let issuers = 0;
const issuerFor = () => {
  issuers += 1;
  const issuer = fakeIssuer(`https://idp${String(issuers)}.example.test`);
  vi.stubGlobal('fetch', vi.fn(issuer.fetch));

  return issuer;
};

const providerOf = (issuer: string) =>
  createOidcProvider({
    id: 'sso-1',
    label: 'Acme',
    issuer,
    clientId: 'plitzi',
    clientSecret: 'secret',
    redirectUri: 'https://api.test/auth/sso-1/callback'
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reading an issuer', () => {
  it('takes the endpoints its discovery document names, and keeps them', async () => {
    const idp = issuerFor();

    const provider = await providerOf(idp.issuer);
    await providerOf(idp.issuer);

    expect(provider).toMatchObject({
      authorizationUrl: `${idp.issuer}/authorize`,
      tokenUrl: `${idp.issuer}/token`,
      usePkce: true,
      sendsNonce: true,
      scope: 'openid email profile'
    });
    expect(idp.reads.discovery).toBe(1);
  });

  it('refuses a document that is another issuer’s, and an issuer that is not https', async () => {
    const idp = issuerFor();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              issuer: 'https://other.test',
              authorization_endpoint: 'https://x',
              token_endpoint: 'https://x',
              jwks_uri: 'https://x'
            })
          )
        )
      )
    );

    await expect(discoverOidc(idp.issuer)).rejects.toThrow(/is for "https:\/\/other.test"/);
    await expect(discoverOidc('http://idp.example.test')).rejects.toThrow(/https:\/\//);
  });
});

describe('who an ID token says signed in', () => {
  it('reads the person from a token signed by the issuer, for this client, with this sign-in’s nonce', async () => {
    const idp = issuerFor();
    const provider = await providerOf(idp.issuer);
    const idToken = idp.sign({ sub: 'u-1', aud: 'plitzi', nonce: 'n-1', email: 'Ada@Acme.test', name: 'Ada' });

    expect(await provider.fetchProfile({ accessToken: 'a', idToken, nonce: 'n-1' })).toEqual<OAuthProfile>({
      id: 'u-1',
      email: 'ada@acme.test',
      emailVerified: false,
      username: 'Ada'
    });
  });

  it('refuses one replayed from another sign-in, meant for another client, expired, or keyed by a shared secret', async () => {
    const idp = issuerFor();
    const provider = await providerOf(idp.issuer);
    const profile = (idToken: string) => provider.fetchProfile({ accessToken: 'a', idToken, nonce: 'n-1' });

    await expect(profile(idp.sign({ sub: 'u', aud: 'plitzi', nonce: 'n-2' }))).rejects.toThrow(/nonce/);
    await expect(profile(idp.sign({ sub: 'u', aud: 'someone-else', nonce: 'n-1' }))).rejects.toThrow(/did not verify/);
    await expect(profile(idp.sign({ sub: 'u', aud: 'plitzi', nonce: 'n-1' }, { expiresIn: -120 }))).rejects.toThrow(
      /did not verify/
    );
    const hmac = jwt.sign({ iss: idp.issuer, sub: 'u', aud: 'plitzi', nonce: 'n-1' }, 'secret', {
      algorithm: 'HS256',
      keyid: 'key-1'
    });
    await expect(profile(hmac)).rejects.toThrow(/asymmetric/);
    await expect(provider.fetchProfile({ accessToken: 'a', nonce: 'n-1' })).rejects.toThrow(/no ID token/);
  });

  it('reads the key set again for a key it does not have — a rotation — and refuses a key nobody publishes', async () => {
    const idp = issuerFor();
    const provider = await providerOf(idp.issuer);

    await provider.fetchProfile({
      accessToken: 'a',
      idToken: idp.sign({ sub: 'u', aud: 'plitzi', nonce: 'n' }),
      nonce: 'n'
    });
    await expect(
      provider.fetchProfile({
        accessToken: 'a',
        idToken: idp.sign({ sub: 'u', aud: 'plitzi', nonce: 'n' }, { kid: 'gone' }),
        nonce: 'n'
      })
    ).rejects.toThrow(/does not publish \(gone\)/);
    expect(idp.reads.keys).toBe(1);
  });
});

describe('single sign-on through the social flow', () => {
  const ada: AccountRecord = { id: 1, username: 'ada', email: 'ada@acme.test', active: true, verified: true };

  const build = (
    issuer: string,
    linkAccount = vi.fn<(provider: string, profile: OAuthProfile) => Promise<AccountRecord>>(() => Promise.resolve(ada))
  ) => ({
    linkAccount,
    social: createSocialAuth({
      providers: {},
      config: { secret: 'flow-secret', defaultRedirect: 'https://app.test/', callbackBaseUrl: 'https://api.test' },
      adapters: {
        linkAccount,
        resolveProvider: (id, redirectUri) =>
          id === 'sso-1'
            ? createOidcProvider({ id, label: 'Acme', issuer, clientId: 'plitzi', clientSecret: 'secret', redirectUri })
            : Promise.resolve(undefined),
        providerForEmail: email => Promise.resolve(email.endsWith('@acme.test') ? 'sso-1' : undefined)
      }
    })
  });

  it('finds the sign-on of an address by its domain, and says when a domain has none', async () => {
    const idp = issuerFor();
    const { social } = build(idp.issuer);

    expect(await social.sso(' Ada@ACME.test ')).toEqual({
      provider: { id: 'sso-1', label: 'Acme', url: 'https://api.test/auth/sso-1/login' }
    });
    expect(await social.sso('bob@elsewhere.test')).toEqual({
      error: 'elsewhere.test has no single sign-on here: sign in another way'
    });
    expect(await social.sso('not an address')).toEqual({ error: 'An email address is required' });
  });

  it('signs in the person the issuer vouches for, its nonce sent out and checked on the way back', async () => {
    const idp = issuerFor();
    const { social, linkAccount } = build(idp.issuer);

    const started = await social.start('sso-1', '/spaces');
    const sent = new URL(started?.redirectTo ?? '');
    expect(sent.origin + sent.pathname).toBe(`${idp.issuer}/authorize`);
    expect(sent.searchParams.get('redirect_uri')).toBe('https://api.test/auth/sso-1/callback');
    const nonce = sent.searchParams.get('nonce') ?? '';
    expect(nonce).not.toBe(sent.searchParams.get('state'));

    idp.answerWith(idp.sign({ sub: 'u-1', aud: 'plitzi', nonce, email: 'ada@acme.test', email_verified: true }));
    const result = await social.complete('sso-1', {
      code: 'code',
      state: sent.searchParams.get('state') ?? '',
      stateCookie: started?.stateCookie
    });

    expect(result).toMatchObject({ ok: true, account: ada });
    expect(linkAccount).toHaveBeenCalledWith('sso-1', {
      id: 'u-1',
      email: 'ada@acme.test',
      emailVerified: true,
      username: ''
    });
    expect(social.get('sso-1')).toBeUndefined();
  });

  it('carries the deployment’s own word for a refusal back beside the reason', async () => {
    const idp = issuerFor();
    const { OAuthFailure } = await import('../types');
    const { social } = build(
      idp.issuer,
      vi.fn(() => Promise.reject(new OAuthFailure('not_permitted', 'Outside the domain', 'outside-domain')))
    );

    const started = await social.start('sso-1', '/sso');
    const sent = new URL(started?.redirectTo ?? '');
    idp.answerWith(idp.sign({ sub: 'u', aud: 'plitzi', nonce: sent.searchParams.get('nonce') ?? '' }));
    const result = await social.complete('sso-1', {
      code: 'code',
      state: sent.searchParams.get('state') ?? '',
      stateCookie: started?.stateCookie
    });

    expect(result).toMatchObject({
      ok: false,
      reason: 'not_permitted',
      detail: 'outside-domain',
      redirectTo: '/sso?error=not_permitted&detail=outside-domain'
    });
  });
});
