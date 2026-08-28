import { describe, expect, it } from 'vitest';

import { createCarriers, presentedOrigin } from './credentials';
import { createIdentity } from './identity';
import { createTokens } from './tokens';

import type { CredentialCarrier } from './credentials';
import type { Actor, IdentityAdapters, SpaceMembership, StoredSpaceToken } from './identity';

// Identity resolution and RBAC are the server's rules over a deployment's data, so they are exercised the way a
// deployment uses them: real tokens, fake stores. What is asserted here is the rules — that a signature is never
// enough on its own, that a public credential is bound to where it is presented, and that a permission needs both
// halves — none of which depends on anyone's database.

const tokens = createTokens({
  secret: 'test-secret',
  issuer: 'https://this.test',
  audience: ['https://api.this.test']
});

const carriers = createCarriers(() => 'session_cookie');

const account = (overrides: Partial<Actor> = {}): Actor => ({
  id: 7,
  username: 'ada',
  email: 'ada@example.com',
  verified: true,
  roles: ['user'],
  permissions: ['spaceUpdate'],
  token: 'token',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  ...overrides
});

const build = (adapters: Partial<IdentityAdapters>, config = {}) =>
  createIdentity({
    tokens,
    carriers,
    presentedOrigin,
    config,
    adapters: {
      findAccountByToken: () => Promise.resolve(undefined),
      findSpaceToken: () => Promise.resolve(undefined),
      ...adapters
    }
  });

const carrier = (headers: Record<string, string>, hostname = 'app.example.com'): CredentialCarrier => ({
  headers,
  hostname,
  query: {}
});

describe('resolving an account', () => {
  it('accepts a token the store still recognises', async () => {
    const token = tokens.generateUserToken(7);
    const identity = build({ findAccountByToken: () => Promise.resolve(account({ token })) });

    const result = await identity.resolveActorFromToken(token);

    expect(result.ok && result.actor.username).toBe('ada');
  });

  // The signature stays valid for a day; the row is what can be taken back. Rotating a session overwrites it, and
  // that is the whole mechanism by which signing in elsewhere ends this one.
  it('refuses a perfectly valid signature the store no longer knows', async () => {
    const identity = build({ findAccountByToken: () => Promise.resolve(undefined) });

    const result = await identity.resolveActorFromToken(tokens.generateUserToken(7));

    expect(result).toEqual({ ok: false, reason: 'revoked' });
  });

  it('refuses a token whose subject is not the account it resolved to', async () => {
    const identity = build({ findAccountByToken: () => Promise.resolve(account({ id: 99 })) });

    const result = await identity.resolveActorFromToken(tokens.generateUserToken(7));

    expect(result).toEqual({ ok: false, reason: 'revoked' });
  });

  it('reports an elapsed row as expired, which is renewable, rather than revoked', async () => {
    const token = tokens.generateUserToken(7);
    const identity = build({
      findAccountByToken: () => Promise.resolve(account({ token, expiresAt: Math.floor(Date.now() / 1000) - 10 }))
    });

    expect(await identity.resolveActorFromToken(token)).toEqual({ ok: false, reason: 'expired' });
  });

  it('refuses a token minted by another deployment', async () => {
    const other = createTokens({ secret: 'test-secret', issuer: 'https://elsewhere.test', audience: ['x'] });
    const identity = build({ findAccountByToken: () => Promise.resolve(account()) });

    expect(await identity.resolveActorFromToken(other.generateUserToken(7))).toEqual({
      ok: false,
      reason: 'issuer-not-allowed'
    });
  });

  it('finds the credential wherever it rides, cookie included', async () => {
    const token = tokens.generateUserToken(7);
    const identity = build({ findAccountByToken: () => Promise.resolve(account({ token })) });

    const viaCookie = await identity.resolveActor(carrier({ cookie: `session_cookie=${token}` }));
    const viaBearer = await identity.resolveActor(carrier({ authorization: `Bearer ${token}` }));

    expect(viaCookie.ok).toBe(true);
    expect(viaBearer.ok).toBe(true);
  });
});

describe('resolving a space grant', () => {
  const stored = (overrides: Partial<StoredSpaceToken> = {}): StoredSpaceToken => ({
    spaceId: 42,
    scope: 'render',
    ...overrides
  });

  it('binds a render token to the domains it declares', async () => {
    const token = tokens.generateSpaceToken(42, ['https://acme.com']);
    const identity = build({ findSpaceToken: () => Promise.resolve(stored()) });

    const atHome = await identity.resolveGrantFromToken(token, 'https://acme.com', { host: 'acme.com' });
    const elsewhere = await identity.resolveGrantFromToken(token, 'https://acme.com', { host: 'evil.com' });

    expect(atHome.ok).toBe(true);
    expect(elsewhere).toEqual({ ok: false, reason: 'domain-not-allowed' });
  });

  // `skipOrigin` exists for transports with no Origin at all; it must not become a way around the domain binding,
  // which is the only thing protecting a credential that ships in the clear inside every published page.
  it('keeps the domain binding even when the origin check is waived', async () => {
    const token = tokens.generateSpaceToken(42, ['https://acme.com']);
    const identity = build({ findSpaceToken: () => Promise.resolve(stored()) });

    const result = await identity.resolveGrantFromToken(token, '', { skipOrigin: true, host: 'evil.com' });

    expect(result).toEqual({ ok: false, reason: 'domain-not-allowed' });
  });

  it('exempts an agent grant, which reaches no domain', async () => {
    const token = tokens.generateSpaceToken(42, [], 'agent');
    const identity = build({ findSpaceToken: () => Promise.resolve(stored({ scope: 'agent', userId: 7 })) });

    const result = await identity.resolveGrantFromToken(token, '', { skipOrigin: true, host: 'anywhere.com' });

    expect(result.ok && result.grant.userId).toBe(7);
  });

  it('refuses a token whose stored scope was narrowed after it was signed', async () => {
    const token = tokens.generateSpaceToken(42, ['*'], 'agent');
    const identity = build({ findSpaceToken: () => Promise.resolve(stored({ scope: 'render' })) });

    expect(await identity.resolveGrantFromToken(token, '', { skipOrigin: true })).toEqual({
      ok: false,
      reason: 'scope-mismatch'
    });
  });

  it('refuses one whose row is gone, however valid the signature', async () => {
    const token = tokens.generateSpaceToken(42, ['*']);
    const identity = build({ findSpaceToken: () => Promise.resolve(undefined) });

    expect(await identity.resolveGrantFromToken(token, '', { skipOrigin: true })).toEqual({
      ok: false,
      reason: 'revoked'
    });
  });

  it('lets this deployment’s own hosts through whatever a token declares', async () => {
    const token = tokens.generateSpaceToken(42, ['https://acme.com']);
    const identity = build({ findSpaceToken: () => Promise.resolve(stored()) }, { platformHosts: ['builder.us.test'] });

    const result = await identity.resolveGrantFromToken(token, '', { skipOrigin: true, host: 'builder.us.test' });

    expect(result.ok).toBe(true);
  });

  // The public credential is held to its allowlist even when nobody claims an origin. The check only ever worked
  // because a BROWSER is made to state where it presents from — omitting the header is declining to be asked, not
  // passing. Without this, a render key lifted from a published page is enough to clone that site from any server:
  // the domain binding above does not stop it, since a self-hosted renderer addresses the platform's own host.
  it('refuses a PUBLIC render token presented with no Origin at all', async () => {
    const token = tokens.generateSpaceToken(42, ['https://acme.com']);
    const identity = build({ findSpaceToken: () => Promise.resolve(stored()) }, { platformHosts: ['server.us.test'] });

    const result = await identity.resolveGrant(carrier({ authorization: `Bearer ${token}` }, 'server.us.test'));

    expect(result).toEqual({ ok: false, reason: 'origin-not-allowed' });
  });

  // …and the deployment that genuinely has no browser gets its own credential rather than a hole in that one. A
  // `host` token is secret: possessing it IS the proof an origin was standing in for.
  it('admits a SECRET host token with no Origin — what self-hosting uses', async () => {
    const token = tokens.generateSpaceToken(42, ['my-deployment'], 'host');
    const identity = build(
      { findSpaceToken: () => Promise.resolve(stored({ scope: 'host' })) },
      { platformHosts: ['server.us.test'] }
    );

    const result = await identity.resolveGrant(carrier({ authorization: `Bearer ${token}` }, 'server.us.test'));

    expect(result.ok && result.grant.scope).toBe('host');
  });

  // A host grant is a server's, so it reaches no browser domain and the embed binding does not apply to it — the
  // same exemption an agent grant has, and the reason it can be presented from anywhere its holder runs.
  it('does not hold a host token to the domains a render token is bound by', async () => {
    const token = tokens.generateSpaceToken(42, ['my-deployment'], 'host');
    const identity = build({ findSpaceToken: () => Promise.resolve(stored({ scope: 'host' })) });

    const result = await identity.resolveGrantFromToken(token, '', { host: 'anywhere.example' });

    expect(result.ok).toBe(true);
  });

  // The stored scope still has to agree, so a host row cannot be reached with a render signature or the other way
  // round — narrowing a row takes effect without re-issuing anything.
  it('refuses a render token whose row was changed to host', async () => {
    const token = tokens.generateSpaceToken(42, ['https://acme.com']);
    const identity = build({ findSpaceToken: () => Promise.resolve(stored({ scope: 'host' })) });

    expect(await identity.resolveGrantFromToken(token, '', { skipOrigin: true })).toEqual({
      ok: false,
      reason: 'scope-mismatch'
    });
  });

  it('still refuses a browser presenting from an origin the token does not declare', async () => {
    const token = tokens.generateSpaceToken(42, ['https://acme.com']);
    const identity = build({ findSpaceToken: () => Promise.resolve(stored()) }, { platformHosts: ['server.us.test'] });

    const result = await identity.resolveGrant(
      carrier({ authorization: `Bearer ${token}`, origin: 'https://evil.com' }, 'server.us.test')
    );

    expect(result).toEqual({ ok: false, reason: 'origin-not-allowed' });
  });

  // The escape hatch stays reachable for a deployment that deliberately wants it — which it was NOT before, because
  // the hostname fallback meant `origin` was never empty and this branch could not be reached at all.
  it('honours allowWithoutOrigin for deployments that opt in', async () => {
    const token = tokens.generateSpaceToken(42, ['https://acme.com']);
    const identity = build(
      { findSpaceToken: () => Promise.resolve(stored()) },
      { platformHosts: ['server.us.test'], allowWithoutOrigin: true }
    );

    const result = await identity.resolveGrant(carrier({ authorization: `Bearer ${token}` }, 'server.us.test'));

    expect(result.ok).toBe(true);
  });
});

describe('what an actor may do in a space', () => {
  const membership = (permissions: string[]): SpaceMembership => ({
    spaceId: 42,
    isOwner: false,
    role: 'editor',
    permissions
  });

  it('needs both halves: the account may do it at all, and may do it here', async () => {
    const identity = build({ findMembership: () => Promise.resolve(membership(['spaceUpdate'])) });

    expect(await identity.can(account(), 42, 'spaceUpdate')).toBe(true);
  });

  it('refuses when the account lacks the global capability, whatever its role in the space', async () => {
    const identity = build({ findMembership: () => Promise.resolve(membership(['spaceUpdate'])) });

    expect(await identity.can(account({ permissions: [] }), 42, 'spaceUpdate')).toBe(false);
  });

  it('refuses a non-member holding the global capability — it says nothing about this space', async () => {
    const identity = build({ findMembership: () => Promise.resolve(undefined) });

    expect(await identity.can(account(), 42, 'spaceUpdate')).toBe(false);
  });

  it('refuses an unverified account outright', async () => {
    const identity = build({ findMembership: () => Promise.resolve(membership(['spaceUpdate'])) });

    expect(await identity.can(account({ verified: false }), 42, 'spaceUpdate')).toBe(false);
  });

  // An agent grant's authority is the member who consented, read live — so losing access to the space revokes every
  // agent token that member ever authorised, without anything having to go and find them.
  it('resolves an agent grant against its member, and refuses a render one', async () => {
    const identity = build({ findMembership: () => Promise.resolve(membership(['spaceUpdate'])) });

    const agent = await identity.grantCan({ spaceId: 42, scope: 'agent', userId: 7, origins: [] }, 'spaceUpdate');
    const render = await identity.grantCan({ spaceId: 42, scope: 'render', origins: [] }, 'spaceUpdate');

    expect(agent).toBe(true);
    expect(render).toBe(false);
  });

  it('refuses everything when the deployment supplies no membership adapter', async () => {
    const identity = build({});

    expect(await identity.can(account(), 42, 'spaceUpdate')).toBe(false);
  });
});
