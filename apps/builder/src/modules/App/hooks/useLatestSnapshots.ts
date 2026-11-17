import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import { shortAge } from '../helpers/age';

import type { PublishedEnvironment } from '../helpers/environments';
import type { SpaceSnapshot } from '@plitzi/sdk-shared';

const latestOf = (environment: PublishedEnvironment) => ({ environment, limit: 1 });
const first = (response: { SpaceSnapshots: SpaceSnapshot[] } | undefined) => response?.SpaceSnapshots[0] ?? null;

/**
 * Each published environment's latest snapshot — none when it has none yet — and the newest of them all: what the
 * draft is compared with in the header and the snapshot modal. Read whenever shown: a snapshot taken in another tab
 * counts.
 */
const useLatestSnapshots = () => {
  const config = { revalidateOnMount: true };
  const development = useGraphQL('SpaceSnapshots', first, latestOf('development'), config);
  const staging = useGraphQL('SpaceSnapshots', first, latestOf('staging'), config);
  const production = useGraphQL('SpaceSnapshots', first, latestOf('production'), config);
  const byEnvironment: Record<PublishedEnvironment, SpaceSnapshot | undefined> = {
    development: development.data ?? undefined,
    staging: staging.data ?? undefined,
    production: production.data ?? undefined
  };
  const newest = Object.values(byEnvironment)
    .filter((snapshot): snapshot is SpaceSnapshot => snapshot !== undefined)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .at(0);

  return {
    byEnvironment,
    newest,
    loading: development.isLoading || staging.isLoading || production.isLoading,
    refresh: async () => {
      await Promise.all([development.mutate(), staging.mutate(), production.mutate()]);
    }
  };
};

/** `v12 · 2 h`, or that there is none yet. */
export const latestDetail = (snapshot: SpaceSnapshot | undefined): string =>
  snapshot ? `v${String(snapshot.revision)} · ${shortAge(snapshot.publishedAt)}` : 'No versions yet';

export default useLatestSnapshots;
