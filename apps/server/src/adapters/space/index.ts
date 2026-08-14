import { presentsCredential } from './resolvers';
import { isRefusal } from './types';
import { frameAncestors as mergeFrameAncestors } from '../../core/auth/domains';

import type { SpaceCache, SpaceRefusal, SpaceResolution, SpaceResolver } from './types';
import type { SSRPageAdapters, SSRRequest, SSRSpaceDeployment } from '@plitzi/sdk-shared';

export interface FrameAncestorsConfig {
  /** The domains this space declared. Usually the origins on its public credential. */
  find: (spaceId: number) => Promise<string[]>;
  /** Always allowed on top of them — this deployment's own hosts, because a builder previews in an iframe. */
  floor?: string[];
  /** Cache the domain list too. Dropped by `invalidate.domains(spaceId)` when the owner edits it. */
  cache?: boolean;
}

export interface SpaceAdaptersConfig {
  /**
   * How a request becomes a space, in order. The first resolver to answer wins, and one that REFUSES ends the
   * chain — see {@link SpaceResolver}.
   *
   * Order is the only control here, and it is enough: put `authoringPreview` first so a credentialed request is
   * never served as an anonymous visitor, and put a `fixedSpace` last if there should be no such thing as a host
   * this server does not know.
   */
  resolvers: SpaceResolver[];
  cache?: SpaceCache;
  /** Default 300. */
  ttlSeconds?: number;
  /**
   * What a resolution is cached under, or `undefined` for a request that must not be cached at all.
   *
   * The default is the hostname, **except** for a request presenting a credential, which is not cached in either
   * direction. The cache is shared and keyed by host, while a credential can resolve the same host to a different
   * space — so a hit would serve one visitor's preview to the next, and a write would poison the host for everyone.
   */
  cacheKey?: (req: SSRRequest) => string | undefined;
  /**
   * Who may put this space in an iframe. Applied to every resolution, which is the point of it living here: a
   * deployment that derives it per branch eventually forgets a branch, and the branch it forgets serves a space
   * framable by anyone.
   */
  frameAncestors?: FrameAncestorsConfig;
  /**
   * The last word, for whatever is this deployment's alone — which plugins a space loads, template props, a
   * per-tenant theme. Runs on every resolution, after everything above.
   */
  decorate?: (resolution: SpaceResolution, req: SSRRequest) => Promise<Partial<SpaceResolution>>;
  /** What an unresolved request gets. Default `404 Space not found`. */
  notFound?: { code: number; message: string };
  /** Reported, never thrown: a resolution that fails is one bad request, not a dead server. */
  onError?: (error: unknown, req?: SSRRequest) => void;
}

const RESOLUTION_PREFIX = 'space:resolution:';
const DOMAINS_PREFIX = 'space:domains:';

/**
 * `getSpaceDeployment`, assembled.
 *
 * Answering "which space is this request for" is the same shape everywhere and the same *rules* everywhere — try
 * the ways a host can name a space, in order; never serve a credentialed request from a shared cache; derive the
 * framing policy from what the space declared; say 404 rather than leaking whether a space exists. What differs
 * between deployments is only where the rows are, which is what a resolver is.
 *
 * ```ts
 * const spaces = createSpaceAdapters({
 *   resolvers: [
 *     authoringPreview({ hosts, resolveGrant: auth.identity.resolveGrant, find: findSpace }),
 *     wildcardSubdomain({ suffix: 'example.app', find: findSpaceBySlug }),
 *     verifiedDomain(findDeploymentByDomain)
 *   ],
 *   cache: redisCache,
 *   frameAncestors: { find: findSpaceDomains, floor: hosts, cache: true }
 * });
 *
 * createServer({ adapters: { ...spaces.adapters, getOfflineData } });
 * ```
 */
export const createSpaceAdapters = (config: SpaceAdaptersConfig) => {
  const {
    resolvers,
    cache,
    ttlSeconds = 300,
    cacheKey = req => (presentsCredential(req) ? undefined : req.hostname),
    frameAncestors,
    decorate,
    notFound = { code: 404, message: 'Space not found' },
    onError
  } = config;

  const readCache = async <T>(key: string): Promise<T | undefined> => {
    if (!cache) {
      return undefined;
    }

    try {
      const raw = await cache.get(key);

      return raw === undefined ? undefined : (JSON.parse(raw) as T);
    } catch (error: unknown) {
      // A cache that is down, or a value written by an older shape of this code, must not take the request with
      // it. Treated as a miss, which costs a lookup and nothing else.
      onError?.(error);

      return undefined;
    }
  };

  const writeCache = async (key: string, value: unknown): Promise<void> => {
    if (!cache) {
      return;
    }

    try {
      await cache.set(key, JSON.stringify(value), ttlSeconds);
    } catch (error: unknown) {
      onError?.(error);
    }
  };

  const domainsOf = async (spaceId: number): Promise<string[]> => {
    if (!frameAncestors) {
      return [];
    }

    const key = `${DOMAINS_PREFIX}${spaceId}`;

    if (frameAncestors.cache) {
      const cached = await readCache<string[]>(key);
      if (cached) {
        return cached;
      }
    }

    const domains = await frameAncestors.find(spaceId);

    if (frameAncestors.cache) {
      await writeCache(key, domains);
    }

    return domains;
  };

  /** Everything that is true of a resolution regardless of which resolver produced it. */
  const complete = async (resolution: SpaceResolution, req: SSRRequest): Promise<SSRSpaceDeployment> => {
    const decorated = decorate ? { ...resolution, ...(await decorate(resolution, req)) } : resolution;

    return {
      environment: 'main',
      revision: 0,
      ...decorated,
      ...(frameAncestors
        ? { frameAncestors: mergeFrameAncestors(await domainsOf(decorated.spaceId), frameAncestors.floor ?? []) }
        : {})
    };
  };

  const runResolvers = async (req: SSRRequest): Promise<SpaceResolution | SpaceRefusal | undefined> => {
    for (const resolve of resolvers) {
      const answer = await resolve(req);
      if (answer) {
        return answer;
      }
    }

    return undefined;
  };

  const getSpaceDeployment = async (req: SSRRequest): Promise<SSRSpaceDeployment> => {
    const key = cacheKey(req);

    try {
      if (key !== undefined) {
        const cached = await readCache<SpaceResolution>(`${RESOLUTION_PREFIX}${key}`);
        if (cached) {
          return await complete(cached, req);
        }
      }

      const answer = await runResolvers(req);
      if (!answer) {
        return { error: notFound };
      }

      if (isRefusal(answer)) {
        return { error: answer.refuse };
      }

      // Never cached: an authoring preview is what a specific credential resolved to, and the key is a host that
      // anonymous visitors also arrive on.
      if (key !== undefined && !answer.authoring) {
        await writeCache(`${RESOLUTION_PREFIX}${key}`, answer);
      }

      return await complete(answer, req);
    } catch (error: unknown) {
      onError?.(error, req);

      return { error: { code: 500, message: 'Space could not be resolved' } };
    }
  };

  return {
    /** Spread into `createServer({ adapters })` beside whatever answers `getOfflineData`. */
    adapters: { getSpaceDeployment } satisfies Pick<SSRPageAdapters, 'getSpaceDeployment'>,
    getSpaceDeployment,

    /**
     * Drop what a change made untrue. Both matter the moment an owner edits something through an API: without the
     * first a domain keeps resolving to the space it used to, and without the second a space stays framable by a
     * site whose permission was just withdrawn — in both cases until the TTL, which is not a security boundary.
     */
    invalidate: {
      resolution: async (key: string): Promise<void> => {
        await cache?.delete(`${RESOLUTION_PREFIX}${key}`);
      },
      domains: async (spaceId: number): Promise<void> => {
        await cache?.delete(`${DOMAINS_PREFIX}${spaceId}`);
      }
    }
  };
};

export type SpaceAdapters = ReturnType<typeof createSpaceAdapters>;

export { authoringPreview, fixedSpace, presentsCredential, verifiedDomain, wildcardSubdomain } from './resolvers';
export { createMemoryCache, refuse } from './types';

export type { AuthoringPreviewOptions, DeploymentRow, WildcardSubdomainOptions } from './resolvers';
export type { SpaceCache, SpaceRefusal, SpaceResolution, SpaceResolver } from './types';
