export const buildHtmlCacheKey = (
  accessToken: string | undefined = 'anonymous',
  spaceId: number | string | null,
  environment: string,
  revision: number,
  req: { hostname: string; path: string; search: string }
): string =>
  `${accessToken}\0${spaceId ?? 1}\0${environment}\0${revision}\0${req.hostname}\0${req.path}\0${req.search}`;

export const buildOfflineDataCacheKey = (spaceId: number, environment: string, revision: number): string =>
  `${spaceId}|${environment}|${revision}`;

// The request URL is part of the key because RSC slices are route-dependent: a connector compiles its filters
// from routeParams/queryParams, so `/blog/a` and `/blog/b` resolve to different data under the same space,
// environment and revision. Keying the full `search` over-fragments the cache on tracking params (utm_*, fbclid),
// which costs hit rate — the alternative costs correctness, so the raw search stays in the key.
export const buildRscCacheKey = (
  spaceId: number,
  environment: string,
  revision: number,
  userId: string | number | undefined,
  idsParam: string | undefined,
  req: { hostname: string; path: string; search: string }
): string =>
  `${spaceId}\0${environment}\0${revision}\0${userId ?? 'anon'}\0${idsParam ?? ''}\0${req.hostname}\0${req.path}\0${req.search}`;
