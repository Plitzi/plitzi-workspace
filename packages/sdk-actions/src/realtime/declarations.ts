import type { ChannelDeclarations, OfflineDataRaw } from '@plitzi/sdk-shared';

type GetOfflineData = (spaceId: number, environment: string, revision?: number) => Promise<OfflineDataRaw | undefined>;

/** How long a space's channels are remembered: a publish is frequent, and a space's settings change rarely. */
const TTL_MS = 5000;

/**
 * The channels a space declares, read from its schema and remembered for a few seconds.
 *
 * A publish is checked against them on every message; reading the space's documents for each one would cost more
 * than the message. A space that changes its channels is heard within the TTL.
 */
export const createChannelResolver = (getOfflineData: GetOfflineData) => {
  const cache = new Map<string, { at: number; channels: Promise<ChannelDeclarations | undefined> }>();

  return (spaceId: number, environment: string, revision?: number): Promise<ChannelDeclarations | undefined> => {
    const key = `${spaceId}:${environment}:${revision ?? ''}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) {
      return hit.channels;
    }

    const channels = getOfflineData(spaceId, environment, revision).then(data => data?.schema.settings.channels);
    cache.set(key, { at: Date.now(), channels });
    channels.catch(() => cache.delete(key));

    return channels;
  };
};

export type ChannelResolver = ReturnType<typeof createChannelResolver>;
