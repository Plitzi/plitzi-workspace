import { schemaFromWire } from '@plitzi/sdk-shared/schema/wire';

import { serverLog } from '../helpers/serverLog';

import type {
  Environment,
  OfflineDataRaw,
  PluginRaw,
  Schema,
  SchemaRaw,
  SSRPageAdapters,
  SSRSpaceDeployment,
  Style
} from '@plitzi/sdk-shared';

/**
 * A space fetched from Plitzi, for a server that is not Plitzi's.
 *
 * This is the missing half of self-hosting: `createJsonAdapters` serves a space somebody exported by hand, which
 * goes stale the moment it is edited, and everything else meant standing up a database. Here the space stays in
 * the builder — published, versioned, edited by whoever normally edits it — and this deployment reads it over the
 * same GraphQL query the browser-rendered SDK uses, with the same space key. What is served is the deployment's
 * own: its own domain, its own auth, its own actions, its own logs.
 *
 * **Plitzi is never in the critical path of a page.** A version is fetched once and then served from cache; the
 * live document refreshes behind the request rather than in front of it, and a refresh that fails leaves the last
 * good copy serving. A self-hosted site does not go down because somebody else's API did.
 */

/**
 * Plitzi's own server role, which serves GraphQL at its root — no `/graphql` path, exactly as the browser SDK
 * addresses it. Production is the default because production is where a self-hosted deployment reads from; a
 * staging Plitzi is the exception and says so.
 */
const PLITZI_SERVER_URL = 'https://server.plitzi.com';

/**
 * Where a fetched space is kept between requests. Five operations over strings, with no rule to obey — Redis, a
 * table, a directory, whatever this deployment already runs.
 *
 * Omitted leaves an in-process Map, which is per replica: five replicas mean five copies and five refreshes per
 * window. Sharing one costs the cloud a single fetch per version no matter how many of them there are, and it
 * survives a restart — which is what keeps a cold deploy from asking Plitzi once per replica.
 */
export type CloudSpaceCache = {
  get: (key: string) => Promise<string | undefined>;
  set: (key: string, value: string) => Promise<void>;
};

export type CloudAdaptersConfig = {
  /** The GraphQL endpoint of the Plitzi server role. Defaults to production. */
  serverUrl?: string;
  /**
   * The space's **host** key, which is what says WHICH space: the token is minted for one, so no space id travels
   * here and none can be asked for by guessing a number.
   *
   * This is NOT the public render key that a published page embeds. It is issued separately, shown once, and must
   * stay secret — see {@link assertHostKey} for why the public one is refused here rather than being allowed to
   * work.
   */
  webKey: string;
  /**
   * Which environment to serve. `main` is the live document the builder is editing; anything else is published.
   *
   * This is the single switch between the two modes below, and it is worth being deliberate about: `main` is a
   * development target and a published environment is a production one.
   */
  environment?: Environment;
  /**
   * Which published revision to serve. **Ignored when `environment` is `main`** — the live document has no
   * revisions, it has whatever the builder last saved.
   *
   * Pinned to a number, this deployment serves that exact version until somebody changes the config: a revision
   * cannot change, so it is fetched once and kept for the life of the process. Its feature flags are not part of it
   * and still follow the environment — a flag turned in production reaches a pinned deployment too. That is what a deployment wants
   * when it rolls forward on its own schedule, or when it has to be able to say precisely what it is serving.
   *
   * Left out, it serves the **latest** revision of that environment and notices when a new one is published: a
   * cheap probe every `cacheSeconds` asks which revision is current, and the space is refetched only when the
   * answer changes. Publishing from the builder is then all it takes to release.
   */
  revision?: number;
  /**
   * How often Plitzi is ASKED anything, in seconds. Default a minute. Ignored in both directions at the edges:
   *
   * - `main` **does not cache at all**. It is the document somebody is actively editing, and an edit that shows
   *   up a minute later is worse than the round trip — every request reads it live. (Concurrent requests still
   *   share one in-flight fetch: that is not caching, it is not asking the same question twice at once.)
   * - A **pinned revision** never expires. Expiring an immutable document on a timer would be paying for a
   *   question whose answer is already known.
   *
   * So this paces exactly one thing: the probe — "which revision is current" in latest mode, and in both modes "what
   * are the flags at", whose answer is a hash and whose flags are fetched only when it moved. It never sits in front
   * of a visitor: the copy already held is served while the probe runs behind it.
   */
  cacheSeconds?: number;
  /** Where fetched spaces are kept. Omitted, they are kept in this process only — see {@link CloudSpaceCache}. */
  cache?: CloudSpaceCache;
  /**
   * What this server calls the space locally — the number every per-space thing here is keyed by (its actions, its
   * cache entries, its logs). It is NOT Plitzi's id and does not have to match one: the key already says which
   * space is being read, and a deployment serving one space has one number to choose.
   */
  spaceId?: number;
  /** Who may frame this space, and whether a render counts as authoring. Passed through to the page server. */
  deployment?: Omit<SSRSpaceDeployment, 'spaceId' | 'environment' | 'revision'>;
  fetchImpl?: typeof fetch;
};

/**
 * The one query. Written out rather than imported from the shared package's `gql` document because this runs in a
 * server with no Apollo in it: the wire format is a string, and a string is what a `fetch` needs.
 */
const SPACE_QUERY = `query InitQuery($environment: String!, $revision: Int) {
  Space(environment: $environment, revision: $revision) {
    schema {
      settings
      rsc
      flat { id definition { label type initialState styleSelectors bindings interactions parentId rootId items runtime loadStrategy flag { name is } } attributes }
      pages
      components
      flags
      pageFolders { id name slug parentId }
      variables { name type value subValues { when value } }
    }
    plugins { type resource settings }
    style { variables cache }
  }
}`;

/**
 * Which revision of an environment is current.
 *
 * A separate, tiny query on purpose: in latest mode this is what runs on a timer, and asking it is orders of
 * magnitude cheaper — for this deployment and for Plitzi — than pulling a whole space down to discover it did not
 * change. The space itself is fetched only when this answer moves.
 */
const LATEST_REVISION_QUERY = `query SpaceLatestRevisionQuery($environment: String!) {
  SpaceLatestRevision(environment: $environment) {
    snapshot { revision }
    flagsHash
  }
}`;

/**
 * The environment's feature flags. Asked only when the probe's `flagsHash` moved: flags change apart from revisions —
 * one set per environment, shared by every revision it serves — so they are fetched and kept on their own, and a flag
 * turned in production costs this deployment a few hundred bytes rather than the space again.
 */
const FLAGS_QUERY = `query SpaceFlagsQuery($environment: String!) {
  SpaceFlags(environment: $environment) { flags hash }
}`;

type LatestRevisionPayload = {
  data?: { SpaceLatestRevision?: { snapshot?: { revision?: number } | null; flagsHash?: string | null } | null };
  errors?: { message: string }[];
};

type FlagsPayload = { data?: { SpaceFlags?: HeldFlags | null } };

/** An environment's flags as last fetched, and the hash Plitzi gave them — what the page server's caches are keyed by. */
type HeldFlags = { hash: string; flags: NonNullable<Schema['flags']> };

type SpacePayload = {
  data?: { Space?: { schema?: SchemaRaw; style?: Style; plugins?: PluginRaw[] } };
  errors?: { message: string }[];
};

/**
 * The `scope` claim, read without verifying anything.
 *
 * Verification is the server's and this cannot do it — there is no signing key here, and a key this deployment does
 * not hold could not be checked anyway. Reading the claim is enough for what this is for: telling the operator, at
 * startup, that they pasted the wrong one of their two keys.
 */
const scopeOf = (token: string): string | undefined => {
  const payload = token.split('.')[1];
  if (!payload) {
    return undefined;
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { scope?: unknown };

    return typeof claims.scope === 'string' ? claims.scope : undefined;
  } catch {
    // Not a JWT this understands. The server will say so properly; guessing here would only pre-empt a better error.
    return undefined;
  }
};

/**
 * Refuse the PUBLIC key here, where the mistake is cheap, rather than as a 401 an hour later.
 *
 * The two keys are not interchangeable and the difference is the whole security model. A `render` key is embedded in
 * every published page, so anyone who views source has it; what keeps a copied one from working is that a browser is
 * made to state the origin it is presenting from, and that statement is checked. A server has no such statement to
 * make — which is exactly why a server must not be reading with the public key: if it could, a render key lifted
 * from someone else's site would be enough to serve a byte-identical clone of it from here.
 *
 * So self-hosting has a credential of its own. It is secret, issued once, bound to no domain, and revocable on its
 * own row without touching the published site's key.
 */
const assertHostKey = (webKey: string): void => {
  const scope = scopeOf(webKey);
  if (scope === undefined || scope === 'space:host') {
    return;
  }

  if (scope === 'space:render') {
    throw new Error(
      'createCloudAdapters was given the space’s PUBLIC render key. That key is embedded in published pages and is ' +
        'only honoured from the origins it declares, so a server cannot present it. Issue a host key instead ' +
        '(Credentials → “Self-hosting” in the builder, or POST /spaces/{id}/tokens/host) and keep it secret — it is ' +
        'not safe to commit or to ship in a page.'
    );
  }

  throw new Error(`createCloudAdapters needs a space host key; this one is scoped "${scope}".`);
};

export const createCloudAdapters = (config: CloudAdaptersConfig): SSRPageAdapters => {
  const {
    serverUrl = PLITZI_SERVER_URL,
    webKey,
    environment = 'main',
    revision,
    cacheSeconds = 60,
    cache,
    spaceId = 1,
    deployment,
    fetchImpl = fetch
  } = config;

  assertHostKey(webKey);

  /** `main` is the document somebody is editing right now. Nothing about it is worth remembering for a minute. */
  const isLive = (env: string) => env === 'main';

  /** A version somebody named: fetched once, kept for good, because a published revision cannot change. */
  const isPinned = (env: string, rev?: number) => !isLive(env) && typeof rev === 'number' && rev > 0;

  const post = async <T>(query: string, variables: Record<string, unknown>, what: string): Promise<T | undefined> => {
    try {
      const response = await fetchImpl(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${webKey}` },
        body: JSON.stringify({ query, variables })
      });

      if (!response.ok) {
        serverLog.error('CloudAdapters', `${what} answered ${response.status}`);

        return undefined;
      }

      const payload = (await response.json()) as { data?: T; errors?: { message: string }[] };
      if (payload.errors?.length) {
        serverLog.error('CloudAdapters', `${what}: ${payload.errors.map(error => error.message).join('; ')}`);

        return undefined;
      }

      return payload.data;
    } catch (error: unknown) {
      serverLog.error('CloudAdapters', `${what} could not be reached`, error);

      return undefined;
    }
  };

  const fetchSpace = async (env: string, rev?: number): Promise<OfflineDataRaw | undefined> => {
    const data = await post<SpacePayload['data']>(
      SPACE_QUERY,
      { environment: env, revision: rev ?? null },
      `space ${env}@${rev ?? 'latest'}`
    );
    const space = data?.Space;
    // A space with no schema is not a space this can serve, and answering a half-built one would surface as a blank
    // page rather than as the failed fetch it is — the caller keeps the last good copy on `undefined`.
    if (!space?.schema) {
      return undefined;
    }

    return {
      // GraphQL answers `flat` as a list, and `null` for every field an element does not have; every reader indexes
      // it by id and reads an absent field as absent. Without the conversion nothing throws — the router just matches
      // no page, and every URL is a 404 on a space that fetched correctly.
      schema: schemaFromWire(space.schema),
      style: space.style as Style,
      plugins: space.plugins
    };
  };

  /** Which revision is current, and what the flags are at — one small question for both halves of a served space. */
  const probe = async (env: string): Promise<{ revision?: number; flagsHash?: string }> => {
    const data = await post<LatestRevisionPayload['data']>(
      LATEST_REVISION_QUERY,
      { environment: env },
      `latest revision of ${env}`
    );
    const answer = data?.SpaceLatestRevision;

    return { revision: answer?.snapshot?.revision, flagsHash: answer?.flagsHash ?? undefined };
  };

  const cacheKey = (env: string, rev: number) => `plitzi:space:${env}:${rev}`;
  const flagsCacheKey = (env: string) => `plitzi:flags:${env}`;

  /** Each environment's flags as last fetched, and when the probe last confirmed them. */
  const heldFlags = new Map<string, HeldFlags & { checkedAt: number }>();

  /** The flags this process last held, or — on a cold start — the shared cache's, so a restart with Plitzi down keeps
   *  serving the flags it knew rather than the ones frozen into a cached revision. */
  const restoreFlags = async (env: string): Promise<void> => {
    if (heldFlags.has(env)) {
      return;
    }

    try {
      const stored = await cache?.get(flagsCacheKey(env));
      if (stored) {
        heldFlags.set(env, { ...(JSON.parse(stored) as HeldFlags), checkedAt: 0 });
      }
    } catch {
      // Nothing usable kept: the next probe fetches them.
    }
  };

  /** Brings the flags up to the hash the probe answered, fetching them only when it moved. A failed probe or fetch keeps
   *  the flags already held. */
  const syncFlags = async (env: string, hash: string | undefined): Promise<void> => {
    if (hash === undefined) {
      return;
    }

    const current = heldFlags.get(env);
    if (current?.hash === hash) {
      current.checkedAt = Date.now();

      return;
    }

    const fetched = (await post<FlagsPayload['data']>(FLAGS_QUERY, { environment: env }, `flags of ${env}`))
      ?.SpaceFlags;
    if (!fetched) {
      return;
    }

    heldFlags.set(env, { ...fetched, checkedAt: Date.now() });
    await cache?.set(flagsCacheKey(env), JSON.stringify(fetched)).catch(() => undefined);
  };

  /** A served space with the flags held for its environment — the same object for the same pair, so the page server
   *  serialises it once rather than per request. */
  const combined = new WeakMap<OfflineDataRaw, { hash: string; data: OfflineDataRaw }>();
  const withFlags = (env: string, data: OfflineDataRaw): OfflineDataRaw => {
    const flags = heldFlags.get(env);
    if (!flags) {
      return data;
    }

    const known = combined.get(data);
    if (known?.hash === flags.hash) {
      return known.data;
    }

    const joined = { ...data, schema: { ...data.schema, flags: flags.flags } };
    combined.set(data, { hash: flags.hash, data: joined });

    return joined;
  };

  /** The last good copy per environment, which revision it is, and when the probe last ran. */
  type Held = { revision: number; data: OfflineDataRaw; checkedAt: number };
  const held = new Map<string, Held>();
  /** One request per key at a time: a burst of renders on a cold cache joins the first, it does not multiply it. */
  const inFlight = new Map<string, Promise<OfflineDataRaw | undefined>>();

  const once = (key: string, run: () => Promise<OfflineDataRaw | undefined>): Promise<OfflineDataRaw | undefined> => {
    const pending = inFlight.get(key);
    if (pending) {
      return pending;
    }

    const request = run().finally(() => inFlight.delete(key));
    inFlight.set(key, request);

    return request;
  };

  /** Reads a published revision through the shared cache, then the network, and writes back what it learned. */
  const loadRevision = (env: string, rev: number): Promise<OfflineDataRaw | undefined> => {
    const key = cacheKey(env, rev);

    return once(key, async () => {
      try {
        const stored = await cache?.get(key);
        if (stored) {
          const data = JSON.parse(stored) as OfflineDataRaw;
          held.set(env, { revision: rev, data, checkedAt: Date.now() });

          return data;
        }
      } catch {
        // A cache that cannot answer, or an entry that is not the shape it was written as. Asking Plitzi is the
        // fallback the cache was an optimisation over.
      }

      const fetched = await fetchSpace(env, rev);
      if (!fetched) {
        return undefined;
      }

      held.set(env, { revision: rev, data: fetched, checkedAt: Date.now() });
      await cache?.set(key, JSON.stringify(fetched)).catch(() => undefined);

      return fetched;
    });
  };

  /**
   * Latest mode: find out which revision is current, and fetch the space only if that moved.
   *
   * The probe is the thing on the timer, not the space. A deployment that publishes once a week asks Plitzi for a
   * revision number every minute and for a space once — and a publish is live within one window rather than
   * whenever a blanket TTL happened to fall.
   *
   * A probe that fails leaves `checkedAt` alone so the next request tries again, and leaves the held copy serving.
   */
  const refreshLatest = async (env: string): Promise<OfflineDataRaw | undefined> => {
    await restoreFlags(env);
    const { revision: current, flagsHash } = await probe(env);
    await syncFlags(env, flagsHash);
    const previous = held.get(env);
    if (current === undefined) {
      return previous?.data;
    }

    if (previous && previous.revision === current) {
      previous.checkedAt = Date.now();

      return previous.data;
    }

    const fetched = await loadRevision(env, current);

    return fetched ?? previous?.data;
  };

  /**
   * A pinned revision's flags: waited for once — the first render must not go out with the flags frozen into the copy
   * it fetched — and then checked behind the answer, on the window.
   */
  const refreshPinnedFlags = async (env: string): Promise<void> => {
    await restoreFlags(env);
    const flags = heldFlags.get(env);
    if (!flags) {
      await syncFlags(env, (await probe(env)).flagsHash);

      return;
    }

    if (Date.now() - flags.checkedAt >= cacheSeconds * 1000) {
      flags.checkedAt = Date.now();
      void probe(env)
        .then(({ flagsHash }) => syncFlags(env, flagsHash))
        .catch(() => undefined);
    }
  };

  /**
   * The space, and how hard this deployment leans on Plitzi to get it.
   *
   * - **`main`**: read live, every time. It is being edited; a cached answer is a wrong one.
   * - **A pinned revision**: from cache forever after the first read. It cannot change — its flags can, so they are
   *   probed on the same window as the latest mode's revision, and fetched only when they moved.
   * - **Latest**: the held copy is served immediately and a revision probe runs behind it once the window is up.
   *   After the first render no page ever waits on Plitzi, and a failed probe or fetch changes nothing — the last
   *   good copy keeps serving, because a self-hosted site going blank over somebody else's bad minute is not a
   *   trade worth making.
   */
  const getOfflineData = async (_spaceId: number, env: string, rev?: number): Promise<OfflineDataRaw | undefined> => {
    if (isLive(env)) {
      return once(`live:${env}`, () => fetchSpace(env));
    }

    const pinned = rev ?? revision;
    if (pinned !== undefined && isPinned(env, pinned)) {
      await refreshPinnedFlags(env);
      const already = held.get(env);
      const data = already?.revision === pinned ? already.data : await loadRevision(env, pinned);

      return data && withFlags(env, data);
    }

    const current = held.get(env);
    if (!current) {
      const data = await refreshLatest(env);

      return data && withFlags(env, data);
    }

    if (Date.now() - current.checkedAt >= cacheSeconds * 1000) {
      // Behind the answer, not in front of it. Marked as checked before the probe returns so a burst of requests
      // starts one, and rolled back on failure so the next one retries.
      current.checkedAt = Date.now();
      void refreshLatest(env).catch(() => undefined);
    }

    return withFlags(env, current.data);
  };

  /**
   * Every request is this one space.
   *
   * There is no host-to-space mapping to make: the key names the space, so a deployment that serves two of them
   * builds two servers or supplies its own resolver — which is more honest than a lookup table that silently
   * serves the wrong space when a domain is added and this is not.
   *
   * The revision it reports is the one actually being served, with what its flags are at, which in latest mode is whatever the last probe
   * found: a deployment reading `at: { environment, revision }` must be told the version its page was built from,
   * not the zero that means "whatever is live".
   */
  const getSpaceDeployment: NonNullable<SSRPageAdapters['getSpaceDeployment']> = async () => {
    if (isLive(environment)) {
      return { ...deployment, spaceId, environment, revision: 0 };
    }

    // What the flags are at goes with the revision: the page server keys its caches by both, and a flag turned in
    // production changes the page while the revision does not.
    const flagsVersion = (): { flagsVersion?: string } => {
      const flags = heldFlags.get(environment);

      return flags ? { flagsVersion: flags.hash } : {};
    };

    if (isPinned(environment, revision)) {
      await refreshPinnedFlags(environment);

      return { ...deployment, spaceId, environment, revision, ...flagsVersion() };
    }

    if (!held.has(environment)) {
      await refreshLatest(environment);
    }

    return { ...deployment, spaceId, environment, revision: held.get(environment)?.revision ?? 0, ...flagsVersion() };
  };

  return { getOfflineData, getSpaceDeployment };
};

export default createCloudAdapters;
