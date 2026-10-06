/**
 * A query the page server answers for a provider (`runtime: 'server'`), as the invalidations see it.
 *
 * Its answer arrives in the RSC payload, never through the {@link QueryCache}, so an invalidation that only reached
 * the cache left every server-driven list showing what it held before the write.
 */
export type ServerQuery = {
  /** The provider's element id: what an invalidation naming containers names. */
  id: string;
  /** The URL the server reads for it — only a provider that has nothing but a `query`; a connector or action has none. */
  url?: string;
  /** Asks the server again for this provider's slice, around every cache. */
  refresh: () => Promise<void>;
};

/**
 * Every server query mounted on the page, beside the cache and module-scoped like it.
 *
 * Kept apart from the cache rather than pushed into it: an observer there asks for its answer the moment it mounts,
 * and a server provider already has the one the page was rendered with — the first payload would be asked for twice.
 */
const serverQueries = new Set<ServerQuery>();

/** Makes `query` reachable by the invalidations until the returned function is called. */
export const registerServerQuery = (query: ServerQuery): (() => void) => {
  // A registration of its own, so two registrations of one object are two, each removed by its own call.
  const registration = { ...query };
  serverQueries.add(registration);

  return () => {
    serverQueries.delete(registration);
  };
};

/**
 * Asks again for every server query `matches` accepts — all of them without one.
 *
 * Settled, not all-or-nothing: one provider that could not ask again is its own to report, and the rest still refresh.
 */
export const refreshServerQueries = (matches?: (query: ServerQuery) => boolean): Promise<void> =>
  Promise.allSettled([...serverQueries].filter(query => !matches || matches(query)).map(query => query.refresh())).then(
    () => undefined
  );
