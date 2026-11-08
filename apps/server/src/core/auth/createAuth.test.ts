import { afterEach, describe, expect, it, vi } from 'vitest';

import { TEST_KEYS } from '@plitzi/sdk-kernel/testing';

import { createAuth } from './createAuth';
import { TEST_SECRET } from './tests/keys';

import type { AccountAdapters } from '@plitzi/sdk-kernel/identity';
import type { IdentityAdapters } from '@plitzi/sdk-kernel/identity';
import type { SSRSession } from '@plitzi/sdk-kernel/types';

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
    tokens: { keys: TEST_KEYS, issuer: 'https://acme.test', audience: ['https://api.acme.test'] },
    secret: TEST_SECRET,
    cookie,
    adapters: store()
  });

describe('createAuth', () => {
  it('hands back a working cycle from one call', () => {
    const auth = build();

    expect(auth.routes.map(route => route.path)).toContain('/login');
    expect(auth.routes.map(route => route.path)).toContain('/admin/account/status');
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
      tokens: { keys: TEST_KEYS, issuer: 'https://acme.test', audience: [] },
      secret: TEST_SECRET,
      adapters: store(),
      basePath: '/api/auth'
    });

    expect(await auth.authorize({ hostname: 'acme.test', headers: {} }, '/api/auth/login')).toEqual({ ok: true });
  });

  // A deployment's own rules come first, so it can always open a path of its own without editing the server.
  it('puts the deployment’s own rules ahead of the derived ones', async () => {
    const auth = createAuth({
      tokens: { keys: TEST_KEYS, issuer: 'https://acme.test', audience: [] },
      secret: TEST_SECRET,
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

/**
 * A session the store no longer has — signed out everywhere, revoked, the database restored — while the browser keeps
 * its cookie, its readable hint and the token it stored: left as they are, the browser believes it is signed in, and a
 * sign-in for signed-out visitors sends it on to a page that sends it straight back, for ever.
 */
describe('a session that is over, on a page request', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const answer = () => {
    const written: string[] = [];
    const res = { setHeader: (_name: string, value: string | string[]) => written.push(...[value].flat()) };

    return { res, written };
  };
  const cleared = (written: string[]) => written.filter(cookie => /Max-Age=0/i.test(cookie)).map(c => c.split('=')[0]);

  it('is cleared, its readable hint with it', async () => {
    // Issued by a deployment with the same keys whose store kept it: this one's store never had it.
    const session = await build().api.issueSession(7);
    const { res, written } = answer();

    const user = await build().ssrIdentityAdapters.getUser(
      { hostname: 'acme.test', headers: { cookie: `plitzi_session=${encodeURIComponent(session.token)}` } },
      res
    );

    expect(user).toBeUndefined();
    expect(cleared(written)).toEqual(['plitzi_session', 'plitzi_session_refresh', 'plitzi_session_hint']);
  });

  it('leaves a live one, an expired one the refresh may renew, and a bearer header alone', async () => {
    const auth = build();
    const session = await auth.api.issueSession(7);
    const cookie = `plitzi_session=${encodeURIComponent(session.token)}`;
    const live = answer();

    expect(
      await auth.ssrIdentityAdapters.getUser({ hostname: 'acme.test', headers: { cookie } }, live.res)
    ).toBeDefined();
    expect(live.written).toEqual([]);

    const foreign = await build().api.issueSession(7);
    const bearer = answer();
    await auth.ssrIdentityAdapters.getUser(
      { hostname: 'acme.test', headers: { authorization: `Bearer ${foreign.token}` } },
      bearer.res
    );

    expect(bearer.written).toEqual([]);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 400 * 24 * 60 * 60 * 1000);
    const expired = answer();

    expect(
      await auth.ssrIdentityAdapters.getUser({ hostname: 'acme.test', headers: { cookie } }, expired.res)
    ).toBeUndefined();
    expect(expired.written).toEqual([]);
  });
});

/** A server of your own: its accounts are its space's people, read by another as an id and a username, nothing more. */
describe('an account’s public face', () => {
  it('answers an active account by username or id, its id and username alone — and nobody for an inactive one', async () => {
    const accounts = {
      mika: { id: 9, username: 'mika', email: 'mika@example.test', active: true, verified: true, passwordHash: 'x' },
      gone: { id: 10, username: 'gone', email: 'gone@example.test', active: false, verified: true }
    };
    const auth = createAuth({
      tokens: { keys: TEST_KEYS, issuer: 'https://acme.test' },
      secret: TEST_SECRET,
      adapters: {
        ...store(),
        findByUsername: username => Promise.resolve(Object.values(accounts).find(each => each.username === username)),
        findById: id => Promise.resolve(Object.values(accounts).find(each => each.id === id))
      }
    });

    expect(await auth.publicAccount('mika')).toEqual({ id: 9, username: 'mika' });
    expect(await auth.publicAccount(9)).toEqual({ id: 9, username: 'mika' });
    expect(await auth.publicAccount('gone')).toBeUndefined();
    expect(await auth.publicAccount('nobody')).toBeUndefined();
  });
});
