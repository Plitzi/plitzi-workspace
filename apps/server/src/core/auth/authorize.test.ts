import { describe, expect, it } from 'vitest';

import { checkPermission, checkSpaceAccess } from './authorize';

import type { Actor } from './identity';

// The global half of RBAC, as an answer rather than a middleware — which is what lets any host ask it the same way.

const actor = (permissions: string[]): Actor =>
  ({ id: 7, username: 'ada', email: 'ada@example.com', verified: true, roles: ['user'], permissions }) as Actor;

describe('checkPermission', () => {
  it('passes an actor who holds it', () => {
    expect(checkPermission(actor(['pluginPublish']), 'pluginPublish')).toEqual({ ok: true });
  });

  // 401 and 403 are different facts, and collapsing them tells a signed-in caller to sign in again.
  it('separates nobody-is-here from this-is-not-yours', () => {
    expect(checkPermission(undefined, 'pluginPublish')).toMatchObject({ ok: false, status: 401 });
    expect(checkPermission(actor(['pluginPublish']), 'spaceManage')).toMatchObject({ ok: false, status: 403 });
  });
});

describe('checkSpaceAccess', () => {
  const member = { isOwner: false };
  const owner = { isOwner: true };
  const someone = actor([]);

  it('lets a member through', () => {
    expect(checkSpaceAccess(someone, member)).toEqual({ ok: true });
  });

  // The one that matters: 403 would confirm the space exists, and whether a slug belongs to somebody is not a fact
  // an outsider gets to establish by asking.
  it('answers a non-member 404, never 403', () => {
    expect(checkSpaceAccess(someone, undefined)).toMatchObject({ ok: false, status: 404 });
  });

  it('tells owners from members only once the caller has proved they belong', () => {
    expect(checkSpaceAccess(someone, member, { owner: true })).toMatchObject({ ok: false, status: 403 });
    expect(checkSpaceAccess(someone, owner, { owner: true })).toEqual({ ok: true });
  });

  it('asks who you are before anything about the space', () => {
    expect(checkSpaceAccess(undefined, owner)).toMatchObject({ ok: false, status: 401 });
  });
});
