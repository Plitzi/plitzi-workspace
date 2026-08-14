import { describe, expect, it, vi } from 'vitest';

import { createSpaceAdapters } from './index';
import { authoringPreview, verifiedDomain, wildcardSubdomain } from './resolvers';
import { createMemoryCache, refuse } from './types';

import type { SpaceResolver } from './types';
import type { GrantResult } from '../../core/auth/identity';
import type { SSRRequest } from '@plitzi/sdk-shared';

const request = (hostname: string, extra: Partial<SSRRequest> = {}): SSRRequest =>
  ({ hostname, query: {}, headers: {}, ...extra }) as SSRRequest;

const granted = (spaceId: number) => (): Promise<GrantResult> =>
  Promise.resolve({ ok: true, grant: { spaceId, scope: 'render', origins: [] } });

const denied = (): (() => Promise<GrantResult>) => () => Promise.resolve({ ok: false, reason: 'revoked' });

describe('the resolver chain', () => {
  it('takes the first resolver that answers, and asks no more', async () => {
    const second: SpaceResolver = vi.fn(() => Promise.resolve({ spaceId: 2 }));
    const spaces = createSpaceAdapters({ resolvers: [() => Promise.resolve({ spaceId: 1 }), second] });

    expect(await spaces.getSpaceDeployment(request('a.test'))).toMatchObject({ spaceId: 1 });
    expect(second).not.toHaveBeenCalled();
  });

  it('skips a resolver that declines and tries the next', async () => {
    const spaces = createSpaceAdapters({
      resolvers: [() => Promise.resolve(undefined), () => Promise.resolve({ spaceId: 7 })]
    });

    expect(await spaces.getSpaceDeployment(request('a.test'))).toMatchObject({ spaceId: 7 });
  });

  /**
   * The rule the list exists for. A request that tried to act for a space and failed must not then be served as an
   * anonymous visitor of whatever else that host resolves to — which is what a fall-through would do.
   */
  it('stops dead on a refusal instead of falling through', async () => {
    const later: SpaceResolver = vi.fn(() => Promise.resolve({ spaceId: 9 }));
    const spaces = createSpaceAdapters({ resolvers: [() => Promise.resolve(refuse(403, 'Nope')), later] });

    expect(await spaces.getSpaceDeployment(request('a.test'))).toEqual({ error: { code: 403, message: 'Nope' } });
    expect(later).not.toHaveBeenCalled();
  });

  it('answers 404 when nobody claims the request', async () => {
    const spaces = createSpaceAdapters({ resolvers: [() => Promise.resolve(undefined)] });

    expect(await spaces.getSpaceDeployment(request('nope.test'))).toEqual({
      error: { code: 404, message: 'Space not found' }
    });
  });

  it('reports a throwing resolver and serves a 500 rather than dying', async () => {
    const onError = vi.fn();
    const spaces = createSpaceAdapters({
      resolvers: [
        () => {
          throw new Error('database is on fire');
        }
      ],
      onError
    });

    expect(await spaces.getSpaceDeployment(request('a.test'))).toMatchObject({ error: { code: 500 } });
    expect(onError).toHaveBeenCalled();
  });

  it('fills in the live main snapshot when a resolver does not say', async () => {
    const spaces = createSpaceAdapters({ resolvers: [() => Promise.resolve({ spaceId: 3 })] });

    expect(await spaces.getSpaceDeployment(request('a.test'))).toMatchObject({
      spaceId: 3,
      environment: 'main',
      revision: 0
    });
  });
});

describe('caching', () => {
  it('resolves once and serves the rest from the cache', async () => {
    const resolver: SpaceResolver = vi.fn(() => Promise.resolve({ spaceId: 1 }));
    const spaces = createSpaceAdapters({ resolvers: [resolver], cache: createMemoryCache() });

    await spaces.getSpaceDeployment(request('a.test'));
    await spaces.getSpaceDeployment(request('a.test'));

    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it('keys by host, so a second domain is resolved on its own', async () => {
    const resolver: SpaceResolver = vi.fn((req: SSRRequest) =>
      Promise.resolve({ spaceId: req.hostname === 'a.test' ? 1 : 2 })
    );
    const spaces = createSpaceAdapters({ resolvers: [resolver], cache: createMemoryCache() });

    expect(await spaces.getSpaceDeployment(request('a.test'))).toMatchObject({ spaceId: 1 });
    expect(await spaces.getSpaceDeployment(request('b.test'))).toMatchObject({ spaceId: 2 });
  });

  /**
   * The cache is shared and keyed by host, while a credential resolves the same host to a different space. A write
   * would poison the host for every visitor; a read would serve one author's preview to the next.
   */
  it('neither reads nor writes the cache for a request presenting a credential', async () => {
    const resolver: SpaceResolver = vi.fn(() => Promise.resolve({ spaceId: 1 }));
    const cache = createMemoryCache();
    const spaces = createSpaceAdapters({ resolvers: [resolver], cache });

    const credentialed = request('a.test', { query: { 'access-token': 'tok' } });
    await spaces.getSpaceDeployment(credentialed);
    await spaces.getSpaceDeployment(credentialed);

    expect(resolver).toHaveBeenCalledTimes(2);
    expect(await cache.get('space:resolution:a.test')).toBeUndefined();
  });

  it('never caches an authoring resolution, even without a credential in the query', async () => {
    const cache = createMemoryCache();
    const spaces = createSpaceAdapters({
      resolvers: [() => Promise.resolve({ spaceId: 1, authoring: true })],
      cache
    });

    await spaces.getSpaceDeployment(request('a.test'));

    expect(await cache.get('space:resolution:a.test')).toBeUndefined();
  });

  it('does not cache a refusal, so fixing the row fixes the site', async () => {
    let verified = false;
    const spaces = createSpaceAdapters({
      resolvers: [verifiedDomain(() => Promise.resolve({ spaceId: 1, verified }))],
      cache: createMemoryCache()
    });

    expect(await spaces.getSpaceDeployment(request('a.test'))).toMatchObject({ error: { code: 404 } });
    verified = true;
    expect(await spaces.getSpaceDeployment(request('a.test'))).toMatchObject({ spaceId: 1 });
  });

  it('re-resolves after the resolution is invalidated', async () => {
    const resolver: SpaceResolver = vi.fn(() => Promise.resolve({ spaceId: 1 }));
    const spaces = createSpaceAdapters({ resolvers: [resolver], cache: createMemoryCache() });

    await spaces.getSpaceDeployment(request('a.test'));
    await spaces.invalidate.resolution('a.test');
    await spaces.getSpaceDeployment(request('a.test'));

    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it('serves the request when the cache itself is broken', async () => {
    const onError = vi.fn();
    const spaces = createSpaceAdapters({
      resolvers: [() => Promise.resolve({ spaceId: 4 })],
      cache: {
        get: () => Promise.reject(new Error('redis is gone')),
        set: () => Promise.reject(new Error('redis is gone')),
        delete: () => Promise.resolve()
      },
      onError
    });

    expect(await spaces.getSpaceDeployment(request('a.test'))).toMatchObject({ spaceId: 4 });
    expect(onError).toHaveBeenCalled();
  });
});

describe('frame ancestors', () => {
  /** Derived centrally so that a deployment cannot forget it on one branch and serve a space framable by anyone. */
  it('applies to every resolution, whichever resolver produced it', async () => {
    const spaces = createSpaceAdapters({
      resolvers: [req => Promise.resolve(req.hostname === 'a.test' ? { spaceId: 1 } : { spaceId: 2, authoring: true })],
      frameAncestors: { find: () => Promise.resolve(['https://acme.com']), floor: ['builder.test'] }
    });

    const publicPage = await spaces.getSpaceDeployment(request('a.test'));
    const preview = await spaces.getSpaceDeployment(request('b.test'));

    expect(publicPage.frameAncestors).toContain('https://acme.com');
    expect(preview.frameAncestors).toContain('https://acme.com');
    expect(preview.frameAncestors).toEqual(publicPage.frameAncestors);
  });

  it('caches the domain list and drops it on invalidate', async () => {
    const find = vi.fn(() => Promise.resolve(['https://acme.com']));
    const spaces = createSpaceAdapters({
      resolvers: [() => Promise.resolve({ spaceId: 1 })],
      cache: createMemoryCache(),
      frameAncestors: { find, cache: true }
    });

    await spaces.getSpaceDeployment(request('a.test'));
    await spaces.getSpaceDeployment(request('b.test'));
    expect(find).toHaveBeenCalledTimes(1);

    await spaces.invalidate.domains(1);
    await spaces.getSpaceDeployment(request('c.test'));
    expect(find).toHaveBeenCalledTimes(2);
  });
});

describe('decorate', () => {
  it('is the last word, and runs on cached resolutions too', async () => {
    const decorate = vi.fn(() => Promise.resolve({ pluginNames: ['navbar'] }));
    const spaces = createSpaceAdapters({
      resolvers: [() => Promise.resolve({ spaceId: 1 })],
      cache: createMemoryCache(),
      decorate
    });

    expect(await spaces.getSpaceDeployment(request('a.test'))).toMatchObject({ pluginNames: ['navbar'] });
    expect(await spaces.getSpaceDeployment(request('a.test'))).toMatchObject({ pluginNames: ['navbar'] });
    expect(decorate).toHaveBeenCalledTimes(2);
  });
});

describe('verifiedDomain', () => {
  it('declines an unknown domain so a later resolver gets a turn', async () => {
    expect(await verifiedDomain(() => Promise.resolve(undefined))(request('a.test'))).toBeUndefined();
  });

  it('refuses a row that is not verified', async () => {
    const resolver = verifiedDomain(() => Promise.resolve({ spaceId: 1, verified: false }));

    expect(await resolver(request('a.test'))).toEqual({ refuse: { code: 404, message: 'Domain not verified' } });
  });

  it('reads a null revision as the live one', async () => {
    const resolver = verifiedDomain(() => Promise.resolve({ spaceId: 1, revision: null }));

    expect(await resolver(request('a.test'))).toMatchObject({ revision: 0 });
  });
});

describe('wildcardSubdomain', () => {
  const resolver = wildcardSubdomain({
    suffix: 'example.app',
    find: slug => Promise.resolve(slug === 'acme' ? { spaceId: 5 } : undefined)
  });

  it('reads the sub-domain as the slug', async () => {
    expect(await resolver(request('acme.example.app'))).toMatchObject({ spaceId: 5, revision: 0 });
  });

  it('ignores a host outside the wildcard', async () => {
    expect(await resolver(request('acme.other.app'))).toBeUndefined();
  });

  it('ignores the bare domain itself', async () => {
    expect(await resolver(request('example.app'))).toBeUndefined();
  });

  /** `a.b.example.app` is not the space `a.b` — treating it as one lets anyone mint a host for somebody's space. */
  it('refuses to read a deeper sub-domain as a slug', async () => {
    expect(await resolver(request('a.b.example.app'))).toBeUndefined();
  });

  it('declines a slug that names no space', async () => {
    expect(await resolver(request('ghost.example.app'))).toBeUndefined();
  });
});

describe('authoringPreview', () => {
  const options = {
    hosts: ['app.test'],
    find: (spaceId: number) => Promise.resolve({ spaceId })
  };

  it('ignores a host this deployment does not own', async () => {
    const resolver = authoringPreview({ ...options, resolveGrant: granted(1) });

    expect(await resolver(request('acme.com', { query: { 'access-token': 'tok' } }))).toBeUndefined();
  });

  /** An anonymous visitor landing on a first-party host must be served, not asked for a credential. */
  it('ignores a first-party request that presented nothing', async () => {
    const resolver = authoringPreview({ ...options, resolveGrant: granted(1) });

    expect(await resolver(request('app.test'))).toBeUndefined();
  });

  it('marks a good credential as authoring, so metering skips it', async () => {
    const resolver = authoringPreview({ ...options, resolveGrant: granted(42) });

    expect(await resolver(request('app.test', { query: { 'access-token': 'tok' } }))).toMatchObject({
      spaceId: 42,
      authoring: true,
      revision: 0
    });
  });

  it('refuses a bad credential rather than letting it fall through', async () => {
    const resolver = authoringPreview({ ...options, resolveGrant: denied() });

    expect(await resolver(request('app.test', { query: { 'access-token': 'tok' } }))).toEqual({
      refuse: { code: 403, message: 'Access Not Authorized' }
    });
  });

  it('accepts a bearer token as well as the query parameter', async () => {
    const resolver = authoringPreview({ ...options, resolveGrant: granted(8) });

    expect(await resolver(request('app.test', { headers: { authorization: 'Bearer tok' } }))).toMatchObject({
      spaceId: 8
    });
  });

  it('404s when the grant names a space that is gone', async () => {
    const resolver = authoringPreview({
      ...options,
      resolveGrant: granted(99),
      find: () => Promise.resolve(undefined)
    });

    expect(await resolver(request('app.test', { query: { 'access-token': 'tok' } }))).toEqual({
      refuse: { code: 404, message: 'Space not found' }
    });
  });
});
