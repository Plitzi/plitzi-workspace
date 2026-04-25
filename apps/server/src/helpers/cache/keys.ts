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

export const buildRscCacheKey = (
  spaceId: number,
  environment: string,
  revision: number,
  userId: string | undefined,
  idsParam: string | undefined
): string => `${spaceId}|${environment}|${revision}|${userId ?? 'anon'}|${idsParam ?? ''}`;
