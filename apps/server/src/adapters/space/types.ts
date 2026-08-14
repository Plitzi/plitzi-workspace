import type { Environment, PluginSource, SSRCredential, SSRRequest, SSRTemplateProps } from '@plitzi/sdk-shared';

/**
 * Which space a request resolved to, before the server fills in what is the same for everybody.
 *
 * `SSRSpaceDeployment` minus the parts a resolver has no business deciding: `frameAncestors` is derived from the
 * space's declared domains by one rule, and `error` is what a REFUSAL is, which is a different return.
 */
export interface SpaceResolution {
  spaceId: number;
  /** Defaults to `main`. */
  environment?: Environment;
  /** Defaults to `0` — the live snapshot. */
  revision?: number;
  credential?: SSRCredential;
  /**
   * This render is an author looking at their own work rather than a visitor being served. Metering skips it.
   * `authoringPreview` sets it; nothing infers it, because only the resolver can tell the two apart.
   */
  authoring?: boolean;
  templateProps?: SSRTemplateProps;
  pluginNames?: string[];
  pluginSources?: Record<string, PluginSource>;
}

/** A resolver that has decided this request gets nothing, and that no later resolver should be asked. */
export interface SpaceRefusal {
  refuse: { code: number; message: string };
}

/**
 * One way a request becomes a space.
 *
 * Three returns, and the difference between two of them is the whole reason this is a list:
 *
 * - a `SpaceResolution` — mine, here it is;
 * - a `SpaceRefusal` — mine, and the answer is no. **The chain stops.** A request that presented a bad credential
 *   for a space must not fall through to being served as an anonymous visitor of some other one;
 * - `undefined` — not mine, ask the next.
 */
export type SpaceResolver = (req: SSRRequest) => Promise<SpaceResolution | SpaceRefusal | undefined>;

/**
 * Somewhere to keep a lookup that every request repeats. Strings in, strings out: JSON is this module's problem,
 * and a `get`/`set`/`delete` of strings is satisfied by Redis, Memcached, a file, or the in-memory cache below —
 * without any of them being named here.
 *
 * Every method may fail without failing the request: a cache that is down is a slow deployment, not a broken one.
 */
export interface SpaceCache {
  get: (key: string) => Promise<string | undefined>;
  set: (key: string, value: string, ttlSeconds: number) => Promise<void>;
  delete: (key: string) => Promise<void>;
}

export const isRefusal = (value: SpaceResolution | SpaceRefusal): value is SpaceRefusal => 'refuse' in value;

/** A resolver's refusal, as the one-liner it deserves to be at a call site. */
export const refuse = (code: number, message: string): SpaceRefusal => ({ refuse: { code, message } });

/**
 * A cache in this process's memory, for a deployment that runs one.
 *
 * Say that out loud before using it: each process keeps its own, so invalidating on one does not invalidate on the
 * others, and a deployment behind more than one replica will serve a stale resolution from the replicas that were
 * not told. That is fine for a single-process server and wrong for a cluster, which wants Redis or nothing.
 */
export const createMemoryCache = (): SpaceCache => {
  const entries = new Map<string, { value: string; expiresAt: number }>();

  return {
    get: (key: string): Promise<string | undefined> => {
      const entry = entries.get(key);
      if (!entry) {
        return Promise.resolve(undefined);
      }

      if (Date.now() > entry.expiresAt) {
        entries.delete(key);

        return Promise.resolve(undefined);
      }

      return Promise.resolve(entry.value);
    },
    set: (key: string, value: string, ttlSeconds: number): Promise<void> => {
      entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });

      return Promise.resolve();
    },
    delete: (key: string): Promise<void> => {
      entries.delete(key);

      return Promise.resolve();
    }
  };
};
