import type { Environment, OfflineDataRaw, SSRPageAdapters, SSRSpaceDeployment } from '@plitzi/sdk-shared';

/**
 * A space fetched from Plitzi, for a server that is not Plitzi's.
 *
 * This is the missing half of self-hosting: `createJsonAdapters` serves a space somebody exported by hand, which
 * goes stale the moment it is edited, and everything else meant standing up a database. Here the space stays in
 * the builder — published, versioned, edited by whoever normally edits it — and this deployment reads it over the
 * same GraphQL query the browser-rendered SDK uses, with the same space key. What is served is the deployment's
 * own: its own domain, its own auth, its own actions, its own logs.
 */
export type CloudAdaptersConfig = {
  /** The GraphQL endpoint of the Plitzi server role, e.g. `https://server.plitzi.com/graphql`. */
  serverUrl: string;
  /**
   * The space's web key, which is what says WHICH space: the token is minted for one, so no space id travels here
   * and none can be asked for by guessing a number.
   */
  webKey: string;
  /** Which version to serve. `main` is the live document the builder edits; anything else is a published revision. */
  environment?: Environment;
  revision?: number;
  /**
   * How long a fetched space is reused before asking again. Zero fetches on every render, which is a round trip to
   * Plitzi in the critical path of every page — the default is a minute, which keeps a published space effectively
   * static while an edit still shows up without a restart.
   */
  cacheSeconds?: number;
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
      flat { id idRef definition { label type initialState styleSelectors bindings interactions parentId rootId items } attributes }
      pages
      pageFolders { id name slug parentId }
      variables { name type value subValues { when value } }
    }
    segments {
      id
      identifier
      definition
      schema {
        settings
        variables { name type value subValues { value when } }
        flat { id idRef definition { label type initialState styleSelectors bindings interactions parentId rootId items } attributes }
      }
      style { cache }
    }
    plugins { type resource settings }
    style { variables cache }
  }
}`;

type SpacePayload = {
  data?: { Space?: OfflineDataRaw & { segments?: unknown[] } };
  errors?: { message: string }[];
};

/** Segments arrive as a list and are read by identifier, which is how every other reader of a space holds them. */
const byIdentifier = (segments: unknown[] | undefined): OfflineDataRaw['segments'] =>
  (segments ?? []).reduce<Record<string, never>>((acum, segment) => {
    const identifier = (segment as { identifier?: string }).identifier;
    if (!identifier || identifier in acum) {
      return acum;
    }

    return { ...acum, [identifier]: segment as never };
  }, {});

export const createCloudAdapters = (config: CloudAdaptersConfig): SSRPageAdapters => {
  const {
    serverUrl,
    webKey,
    environment = 'main',
    revision = 0,
    cacheSeconds = 60,
    spaceId = 1,
    deployment,
    fetchImpl = fetch
  } = config;

  /**
   * One entry per version, and the in-flight promise is what is cached — not the answer.
   *
   * A page server under load starts many renders before the first fetch returns, and caching only the result would
   * send one request per render for the length of that first round trip. Cached this way the second render joins
   * the first, which is the whole difference between one request and a hundred.
   */
  const inFlight = new Map<string, { expiresAt: number; data: Promise<OfflineDataRaw | undefined> }>();

  const fetchSpace = async (env: string, rev: number): Promise<OfflineDataRaw | undefined> => {
    const response = await fetchImpl(serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${webKey}` },
      body: JSON.stringify({ query: SPACE_QUERY, variables: { environment: env, revision: rev || null } })
    });

    if (!response.ok) {
      console.error(`[CloudAdapters] ${env}@${rev} answered ${response.status}`);

      return undefined;
    }

    const payload = (await response.json()) as SpacePayload;
    if (payload.errors?.length) {
      console.error(`[CloudAdapters] ${env}@${rev}: ${payload.errors.map(error => error.message).join('; ')}`);

      return undefined;
    }

    const space = payload.data?.Space;
    if (!space) {
      return undefined;
    }

    return { schema: space.schema, style: space.style, plugins: space.plugins, segments: byIdentifier(space.segments) };
  };

  const getOfflineData = (
    _spaceId: number,
    env: string,
    rev: number = revision
  ): Promise<OfflineDataRaw | undefined> => {
    const key = `${env}:${rev}`;
    const now = Date.now();
    const cached = inFlight.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    // A failed fetch is not cached: leaving `undefined` in for a minute turns one bad round trip into a minute of
    // blank pages, and the retry costs one request.
    const data = fetchSpace(env, rev).then(result => {
      if (result === undefined) {
        inFlight.delete(key);
      }

      return result;
    });
    inFlight.set(key, { expiresAt: now + cacheSeconds * 1000, data });

    return data;
  };

  /**
   * Every request is this one space.
   *
   * There is no host-to-space mapping to make: the key names the space, so a deployment that serves two of them
   * builds two servers or supplies its own resolver — which is more honest than a lookup table that silently
   * serves the wrong space when a domain is added and this is not.
   */
  const getSpaceDeployment = (): Promise<SSRSpaceDeployment> =>
    Promise.resolve({ ...deployment, spaceId, environment, revision });

  return { getOfflineData, getSpaceDeployment };
};

export default createCloudAdapters;
