import { describe, expect, it } from 'vitest';

import { createSpaceTokenApi } from './spaceTokens';
import { createTokens } from './tokens';

import type { SpaceTokenAdapters, SpaceTokenRecord } from './spaceTokens';

// The lifecycle of a space's own credentials: real tokens, a fake store. What is asserted is the rules a self-hoster
// would otherwise have to rediscover — that every edit re-mints, that the platform domain is never dropped, and that
// the public credential is replaced rather than deleted.

const tokens = createTokens({
  secret: 'test-secret',
  issuer: 'https://this.test',
  audience: ['https://api.this.test']
});

const PLATFORM = 'https://acme.plitzi.app';

const record = (overrides: Partial<SpaceTokenRecord> = {}): SpaceTokenRecord => ({
  id: 1,
  token: tokens.generateSpaceToken(42, [PLATFORM], 'render'),
  scope: 'render',
  isDefault: true,
  origins: [PLATFORM],
  expiresAt: null,
  ...overrides
});

const build = (rows: SpaceTokenRecord[]) => {
  const store = new Map(rows.map(row => [row.id, { ...row }]));
  const invalidated: number[] = [];
  const adapters: SpaceTokenAdapters = {
    loadDefault: id => Promise.resolve([...store.values()].find(row => row.isDefault && id === 42)),
    find: (spaceId, tokenId) => Promise.resolve(spaceId === 42 ? store.get(tokenId) : undefined),
    list: () => Promise.resolve([...store.values()]),
    save: (id, values) => {
      const row = store.get(id);
      if (row) {
        store.set(id, {
          ...row,
          token: values.token,
          origins: values.origins ?? row.origins,
          expiresAt: values.expiresAt === undefined ? row.expiresAt : values.expiresAt
        });
      }

      return Promise.resolve();
    },
    remove: id => {
      store.delete(id);

      return Promise.resolve();
    },
    onDomainsChanged: id => {
      invalidated.push(id);

      return Promise.resolve();
    }
  };

  return { api: createSpaceTokenApi({ tokens, adapters }), store, invalidated };
};

const context = { spaceId: 42, defaultDomains: [PLATFORM] };

const bodyOf = <B extends object>(outcome: { ok: true; body: B } | { ok: false; body: object }): B => {
  if (!outcome.ok) {
    throw new Error(`expected success, got ${JSON.stringify(outcome.body)}`);
  }

  return outcome.body;
};

describe('reading the public credential', () => {
  it('serves the stored one untouched while it still verifies', async () => {
    const { api, store } = build([record()]);
    const before = store.get(1)?.token;

    expect(bodyOf(await api.read(context)).token).toBe(before);
  });

  // Rotating on *outdated* and not only on expired is what the endpoint exists for: nothing else can hand a site
  // stranded on a previous token version a working credential.
  it('rotates one that no longer verifies, keeping its domains', async () => {
    const origins = [PLATFORM, 'https://acme.com'];
    const stale = record({
      token: tokens.generateSpaceToken(42, origins, 'render', { expiresAt: Math.floor(Date.now() / 1000) - 60 }),
      origins
    });
    const { api } = build([stale]);

    const body = bodyOf(await api.read(context));

    expect(body.token).not.toBe(stale.token);
    expect(body.domains).toEqual(origins);
    expect(tokens.verifySpaceToken(body.token).ok).toBe(true);
  });

  // Garbage is not an outdated credential of ours, and re-minting on it would hand a working one to anyone who
  // stored nonsense in the row. `needsRotation` draws that line; this pins it from the endpoint's side.
  it('does not rotate a stored value that was never a credential', async () => {
    const { api } = build([record({ token: 'not-a-token-this-server-minted' })]);

    expect(bodyOf(await api.read(context)).token).toBe('not-a-token-this-server-minted');
  });

  it('reports a space with no credential rather than inventing one', async () => {
    const { api } = build([]);

    expect(await api.read(context)).toMatchObject({ ok: false, status: 404 });
  });
});

describe('rotation', () => {
  it('replaces the credential and keeps both its domains and its lifetime', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 86400;
    const { api, store } = build([record({ origins: [PLATFORM, 'https://acme.com'], expiresAt })]);
    const previous = store.get(1)?.token;

    const body = bodyOf(await api.rotate(context));

    expect(body.token).not.toBe(previous);
    expect(body.domains).toEqual([PLATFORM, 'https://acme.com']);
    expect(store.get(1)?.expiresAt).toBe(expiresAt);
  });
});

describe('domains', () => {
  it('always keeps the platform domain, however narrow the list', async () => {
    const { api } = build([record()]);

    const body = bodyOf(await api.setDomains(context, ['https://acme.com']));

    expect(body.domains).toEqual([PLATFORM, 'https://acme.com']);
  });

  it('stores the wildcard alone, and says what it costs', async () => {
    const { api } = build([record()]);

    const body = bodyOf(await api.setDomains(context, ['*', 'https://acme.com']));

    expect(body.domains).toEqual(['*']);
    expect(body.warning).toContain('any domain');
  });

  it('re-mints, so the previous credential stops working at once', async () => {
    const { api, store } = build([record()]);
    const previous = store.get(1)?.token;

    const body = bodyOf(await api.setDomains(context, ['https://acme.com']));

    expect(body.token).not.toBe(previous);
    expect(tokens.verifySpaceToken(body.token).ok).toBe(true);
  });

  it('tells the deployment its cached domain list is stale', async () => {
    const { api, invalidated } = build([record()]);

    await api.setDomains(context, ['https://acme.com']);

    expect(invalidated).toEqual([42]);
  });

  it('refuses a list that is not domains, naming what it rejected', async () => {
    const { api } = build([record()]);

    expect(await api.setDomains(context, 'acme.com')).toMatchObject({ ok: false, status: 400 });
    expect(await api.setDomains(context, ['not a domain'])).toMatchObject({
      ok: false,
      status: 400,
      body: { domains: ['not a domain'] }
    });
  });
});

describe('expiry', () => {
  it('sets a deadline and re-mints under it', async () => {
    const { api, store } = build([record()]);

    const body = bodyOf(await api.setExpiry(context, 7));

    expect(body.neverExpires).toBe(false);
    expect(body.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(store.get(1)?.token).toBe(body.token);
  });

  it('takes null as never, which is what a published site wants', async () => {
    const { api } = build([record({ expiresAt: Math.floor(Date.now() / 1000) + 60 })]);

    const body = bodyOf(await api.setExpiry(context, null));

    expect(body.neverExpires).toBe(true);
    expect(body.expiresAt).toBeNull();
  });

  it('refuses a deadline that is not one', async () => {
    const { api } = build([record()]);

    for (const value of [0, -3, 'soon']) {
      expect(await api.setExpiry(context, value)).toMatchObject({ ok: false, status: 400 });
    }
  });
});

describe('listing and revoking', () => {
  it('never lists the secrets themselves', async () => {
    const { api } = build([record(), record({ id: 2, scope: 'agent', isDefault: false, origins: ['claude'] })]);

    const body = bodyOf(await api.list(context));

    expect(JSON.stringify(body)).not.toContain('eyJ');
    expect(body.tokens).toHaveLength(2);
  });

  it('reads the same column as domains for the public credential and as a label for an agent one', async () => {
    const { api } = build([record(), record({ id: 2, scope: 'agent', isDefault: false, origins: ['claude'] })]);

    const [publicOne, agent] = bodyOf(await api.list(context)).tokens;

    expect(publicOne.domains).toEqual([PLATFORM]);
    expect(agent.label).toBe('claude');
    expect(agent.domains).toBeUndefined();
  });

  it('revokes an agent credential by dropping the record', async () => {
    const { api, store } = build([record(), record({ id: 2, scope: 'agent', isDefault: false, origins: ['claude'] })]);

    expect(await api.revoke(context, 2)).toMatchObject({ ok: true });
    expect(store.has(2)).toBe(false);
  });

  // Deleting it would leave the published site with no credential at all, which is never what a leak calls for.
  it('refuses to delete the public credential, and says what to do instead', async () => {
    const { api, store } = build([record()]);

    const outcome = await api.revoke(context, 1);

    expect(outcome).toMatchObject({ ok: false, status: 400 });
    expect(outcome.ok ? '' : String(outcome.body.rotate)).toContain('/token/rotate');
    expect(store.has(1)).toBe(true);
  });

  it('does not reach into another space', async () => {
    const { api } = build([record({ id: 2, isDefault: false })]);

    expect(await api.revoke({ ...context, spaceId: 99 }, 2)).toMatchObject({ ok: false, status: 404 });
  });
});
