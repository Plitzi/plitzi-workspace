import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import type { SpaceTargets } from '@plitzi/sdk-shared';

const targetsOf = (response: { SpaceTargets: SpaceTargets } | undefined) => response?.SpaceTargets;

/**
 * The space's targets (RFC 0034): how each domain serves it and where it stands — read whenever shown, and every few
 * seconds while one of them is deploying, so the header and the sheet say when it ends.
 */
const useSpaceTargets = (enabled = true) => {
  const { data, isLoading, mutate } = useGraphQL(enabled ? 'SpaceTargets' : null, targetsOf, undefined, {
    revalidateOnMount: true,
    refreshInterval: latest => (latest?.SpaceTargets.targets.some(target => target.running) ? 3_000 : 0)
  });

  return {
    targets: data,
    loading: isLoading,
    refresh: async () => {
      await mutate();
    }
  };
};

export default useSpaceTargets;
