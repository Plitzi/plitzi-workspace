import type { OfflineDataRaw } from '@plitzi/sdk-shared';

export type OfflineDataLoader = () => Promise<OfflineDataRaw | undefined>;

/**
 * One read of the space per request, however many things ask for it.
 *
 * The page render and the RSC read both need the schema and are deliberately started in parallel, so neither can
 * hand its result to the other. Sharing the promise is what makes that safe: whichever asks first begins the read
 * and the other joins it. It holds the promise, not the value — there is no cache here and nothing to invalidate,
 * because it lives exactly as long as the request that made it.
 */
export const createOfflineDataLoader = (read: OfflineDataLoader): OfflineDataLoader => {
  let pending: Promise<OfflineDataRaw | undefined> | undefined;

  return () => (pending ??= read());
};
