import { describe, expect, it, vi } from 'vitest';

import { createCloudAdapters } from './cloudAdapters';

import type { SSRRequest } from '@plitzi/sdk-shared';

/**
 * What this file is really about is how often Plitzi is asked, and what happens when it does not answer.
 *
 * A self-hosted deployment reading its space from somebody else's API has three ways to be wrong: putting that API
 * in front of every visitor, going dark when it has a bad minute, and not noticing a release. Every test here pins
 * one of the three.
 */

const space = {
  schema: { settings: {}, flat: {}, pages: [], pageFolders: [], variables: [] },
  style: { cache: '', variables: {} },
  plugins: [],
  segments: []
};

/** What the adapter answers: the same space with its segments keyed by identifier, which is how readers hold them. */
const stored = { ...space, segments: {} };

type Call = { query: string; variables: Record<string, unknown> };

/**
 * A Plitzi that answers both queries and counts each separately.
 *
 * Counting them apart is the point: latest mode is supposed to ask for a REVISION NUMBER on a timer and for a
 * SPACE only when that number moves, and a spy that lumped them together could not tell the difference.
 */
const cloud = (latest: () => number | undefined = () => 7) => {
  const calls: Call[] = [];
  let failing = false;

  const fetchImpl = vi.fn((_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as Call;
    calls.push(body);

    if (failing) {
      return Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({}) } as Response);
    }

    const data = body.query.includes('SpaceLatestRevision')
      ? { SpaceLatestRevision: { snapshot: { revision: latest() } } }
      : { Space: space };

    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data }) } as unknown as Response);
  }) as unknown as typeof fetch;

  return {
    fetchImpl,
    spaces: () => calls.filter(call => !call.query.includes('SpaceLatestRevision')).length,
    probes: () => calls.filter(call => call.query.includes('SpaceLatestRevision')).length,
    lastSpaceRevision: () =>
      calls.filter(call => !call.query.includes('SpaceLatestRevision')).at(-1)?.variables.revision,
    fail: () => {
      failing = true;
    }
  };
};

const adapters = (fetchImpl: typeof fetch, overrides: Record<string, unknown> = {}) =>
  createCloudAdapters({ webKey: 'key', fetchImpl, ...overrides });

const read = (built: ReturnType<typeof createCloudAdapters>, environment: string, revision?: number) =>
  built.getOfflineData(1, environment, revision);

// The resolver never reads the request — the key already names the space — so the tests hand it nothing to read.
const noRequest = {} as unknown as SSRRequest;

describe('createCloudAdapters', () => {
  it('sends the space key and nothing that names a space by number', async () => {
    const plitzi = cloud();
    await read(adapters(plitzi.fetchImpl), 'main');

    const [url, init] = (plitzi.fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe('https://server.plitzi.com');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer key');
    expect(init.body as string).not.toContain('spaceId');
  });

  /**
   * `main` is the document somebody is editing right now. A cached answer there is a wrong one — the whole reason
   * to point a deployment at `main` is to see the edit.
   */
  describe('the live environment', () => {
    it('reads live on every request and never caches', async () => {
      const plitzi = cloud();
      const built = adapters(plitzi.fetchImpl, { environment: 'main' });

      await read(built, 'main');
      await read(built, 'main');
      await read(built, 'main');

      expect(plitzi.spaces()).toBe(3);
      expect(plitzi.probes()).toBe(0);
    });

    /** Not caching is not the same as asking the same question twice at once. */
    it('still shares one in-flight fetch between concurrent requests', async () => {
      const plitzi = cloud();
      const built = adapters(plitzi.fetchImpl, { environment: 'main' });

      await Promise.all([read(built, 'main'), read(built, 'main'), read(built, 'main')]);

      expect(plitzi.spaces()).toBe(1);
    });

    it('ignores a revision entirely: the live document has none', async () => {
      const plitzi = cloud();
      await read(adapters(plitzi.fetchImpl, { environment: 'main', revision: 12 }), 'main');

      expect(plitzi.lastSpaceRevision()).toBeNull();
      expect(plitzi.probes()).toBe(0);
    });
  });

  /** A published revision cannot change, so a window on it would be paying for a known answer. */
  describe('a pinned revision', () => {
    it('is fetched once and kept, however long the server is up', async () => {
      const plitzi = cloud();
      const built = adapters(plitzi.fetchImpl, { environment: 'production', revision: 12, cacheSeconds: 0 });

      await read(built, 'production');
      await read(built, 'production');

      expect(plitzi.spaces()).toBe(1);
      expect(plitzi.lastSpaceRevision()).toBe(12);
      // Nothing to discover: the deployment already said which version it serves.
      expect(plitzi.probes()).toBe(0);
    });

    it('reports the version it is serving to the page server', async () => {
      const plitzi = cloud();
      const built = adapters(plitzi.fetchImpl, { environment: 'production', revision: 12 });

      await expect(built.getSpaceDeployment(noRequest)).resolves.toMatchObject({
        environment: 'production',
        revision: 12
      });
    });
  });

  /**
   * Latest mode. The timer paces a REVISION NUMBER, not a space — which is what makes a publish show up within a
   * window instead of whenever a blanket TTL happened to fall, and costs the cloud almost nothing in between.
   */
  describe('the latest revision', () => {
    it('fetches the current revision and serves it', async () => {
      const plitzi = cloud(() => 7);
      const built = adapters(plitzi.fetchImpl, { environment: 'production' });

      await expect(read(built, 'production')).resolves.toEqual(stored);
      expect(plitzi.lastSpaceRevision()).toBe(7);
    });

    it('asks for the number on the timer and for the space only when it moves', async () => {
      let current = 7;
      const plitzi = cloud(() => current);
      const built = adapters(plitzi.fetchImpl, { environment: 'production', cacheSeconds: 0 });

      await read(built, 'production');
      await read(built, 'production');
      await vi.waitFor(() => expect(plitzi.probes()).toBeGreaterThan(1));

      // The revision has not moved, so nothing was refetched.
      expect(plitzi.spaces()).toBe(1);

      current = 8;
      await read(built, 'production');
      await vi.waitFor(() => expect(plitzi.lastSpaceRevision()).toBe(8));
      expect(plitzi.spaces()).toBe(2);
    });

    /** The probe runs behind the answer: after the first render no page waits on Plitzi. */
    it('answers from the held copy while it checks', async () => {
      const plitzi = cloud();
      const built = adapters(plitzi.fetchImpl, { environment: 'production', cacheSeconds: 0 });

      await read(built, 'production');

      await expect(read(built, 'production')).resolves.toEqual(stored);
    });

    it('reports the revision it discovered to the page server', async () => {
      const plitzi = cloud(() => 9);
      const built = adapters(plitzi.fetchImpl, { environment: 'production' });

      await expect(built.getSpaceDeployment(noRequest)).resolves.toMatchObject({
        environment: 'production',
        revision: 9
      });
    });
  });

  /** A self-hosted site does not go blank because somebody else's API had a bad minute. */
  it('keeps serving the last good copy when Plitzi stops answering', async () => {
    const plitzi = cloud();
    const built = adapters(plitzi.fetchImpl, { environment: 'production', cacheSeconds: 0 });

    await read(built, 'production');
    plitzi.fail();

    await expect(read(built, 'production')).resolves.toEqual(stored);
    await expect(read(built, 'production')).resolves.toEqual(stored);
  });

  it('answers nothing when the very first read fails, rather than half a space', async () => {
    const plitzi = cloud();
    plitzi.fail();

    await expect(
      read(adapters(plitzi.fetchImpl, { environment: 'production' }), 'production')
    ).resolves.toBeUndefined();
  });

  /** A shared cache is what turns "one fetch per replica" into "one fetch", and survives a restart. */
  it('reads a shared cache before the network and writes back what it fetched', async () => {
    const store = new Map<string, string>();
    const cache = {
      get: (key: string) => Promise.resolve(store.get(key)),
      set: (key: string, value: string) => {
        store.set(key, value);

        return Promise.resolve();
      }
    };

    const first = cloud();
    await read(adapters(first.fetchImpl, { environment: 'production', revision: 12, cache }), 'production');
    expect(first.spaces()).toBe(1);
    expect(store.has('plitzi:space:production:12')).toBe(true);

    // A second replica — its own adapters, its own memory, the same cache.
    const second = cloud();
    const built = adapters(second.fetchImpl, { environment: 'production', revision: 12, cache });
    await expect(read(built, 'production')).resolves.toEqual(stored);
    expect(second.spaces()).toBe(0);
  });
});
