import { describe, expect, it } from 'vitest';

import { createAuth } from './createAuth';

import type { AccountAdapters } from './api';
import type { IdentityAdapters } from './identity';
import type { SSRSession } from '@plitzi/sdk-shared';

// What this facade is for is not brevity but the two facts that used to be stated twice. The tests that matter are
// the ones proving they cannot disagree any more.

const store = () => {
  const sessions = new Map<string, { userId: number; session: SSRSession }>();
  const adapters: IdentityAdapters & AccountAdapters = {
    findAccountByToken: token => {
      const held = sessions.get(token);

      return Promise.resolve(
        held
          ? {
              id: held.userId,
              username: 'ada',
              email: 'ada@example.test',
              verified: true,
              roles: ['user'],
              permissions: ['spaceUpdate'],
              token,
              expiresAt: held.session.expiresAt
            }
          : undefined
      );
    },
    saveSession: (userId, session) => {
      sessions.set(session.token, { userId, session });

      return Promise.resolve();
    },
    clearSession: () => Promise.resolve(),
    loadAccess: () => Promise.resolve({ roles: ['user'], permissions: ['spaceUpdate'] })
  };

  return adapters;
};

const build = (cookie?: { name: string }) =>
  createAuth({
    tokens: { secret: 'test-secret', issuer: 'https://acme.test', audience: ['https://api.acme.test'] },
    cookie,
    adapters: store()
  });

describe('createAuth', () => {
  it('hands back a working cycle from one call', () => {
    const auth = build();

    expect(auth.routes).toHaveLength(12);
    expect(auth.policy.fallback).toBe('actor');
    expect(typeof auth.authorize).toBe('function');
    expect(typeof auth.can).toBe('function');
  });

  /**
   * The bug this exists to prevent. The cookie name used to be given to the readers and the writers separately: a
   * deployment that renamed one and not the other wrote a session under a name nothing read back, and saw a login
   * that "worked" and a visitor who stayed signed out.
   */
  it('reads a session back from the cookie it wrote it to', async () => {
    const auth = build({ name: 'acme_session' });
    const written: string[] = [];
    const res = { setHeader: (_name: string, value: string | string[]) => written.push(...[value].flat()) };
    const req = { hostname: 'acme.test', headers: {} };

    const session = await auth.api.issueSession(7);
    auth.cookies.write(req, res, session);

    const cookieHeader = written.find(cookie => cookie.startsWith('acme_session='));

    expect(cookieHeader).toBeDefined();

    // Exactly what a browser would send back, read by the half that did not write it.
    const resolved = await auth.identity.resolveActor({
      hostname: 'acme.test',
      headers: { cookie: `acme_session=${encodeURIComponent(session.token)}` }
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.ok && resolved.actor.id).toBe(7);
  });

  it('follows a renamed cookie on both sides at once', async () => {
    const auth = build({ name: 'renamed_session' });
    const session = await auth.api.issueSession(7);

    const resolved = await auth.identity.resolveActor({
      hostname: 'acme.test',
      headers: { cookie: `renamed_session=${encodeURIComponent(session.token)}` }
    });

    expect(resolved.ok).toBe(true);
  });

  it('guards the flows with the policy derived from those same flows', async () => {
    const auth = build();

    expect(await auth.authorize({ hostname: 'acme.test', headers: {} }, '/auth/login')).toEqual({ ok: true });
    expect(await auth.authorize({ hostname: 'acme.test', headers: {} }, '/auth/session')).toMatchObject({
      ok: false,
      status: 401
    });
  });

  it('honours a base path other than /auth', async () => {
    const auth = createAuth({
      tokens: { secret: 'test-secret', issuer: 'https://acme.test', audience: [] },
      adapters: store(),
      basePath: '/api/auth'
    });

    expect(await auth.authorize({ hostname: 'acme.test', headers: {} }, '/api/auth/login')).toEqual({ ok: true });
  });

  // A deployment's own rules come first, so it can always open a path of its own without editing the server.
  it('puts the deployment’s own rules ahead of the derived ones', async () => {
    const auth = createAuth({
      tokens: { secret: 'test-secret', issuer: 'https://acme.test', audience: [] },
      adapters: store(),
      rules: [{ match: ['/health'], requirement: 'public' }]
    });

    expect(await auth.authorize({ hostname: 'acme.test', headers: {} }, '/health')).toEqual({ ok: true });
  });

  // No space credentials at all is a legitimate deployment — one that serves only its own pages.
  it('refuses every grant when no space-token store was supplied', async () => {
    const auth = build();

    const grant = await auth.identity.resolveGrant({
      hostname: 'acme.test',
      headers: { 'x-access-token': 'anything' }
    });

    expect(grant.ok).toBe(false);
  });
});
