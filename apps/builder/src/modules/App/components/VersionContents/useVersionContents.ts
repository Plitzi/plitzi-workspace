import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import type { Environment, SpaceVersionContents } from '@plitzi/sdk-shared';

/** What one version of the space holds: the draft, or an environment's snapshot — its latest unless one is named. */
const useVersionContents = (
  environment: Environment,
  revision?: number
): { contents: SpaceVersionContents | undefined; loading: boolean; error: Error | undefined } => {
  const { data, isLoading, error } = useGraphQL(
    'SpaceVersionContents',
    response => response?.SpaceVersionContents ?? undefined,
    { environment, ...(revision ? { revision } : {}) },
    // A draft changes with every edit: read it whenever it is shown, never from what was read last time.
    { revalidateOnMount: true }
  );

  return { contents: data, loading: isLoading, error };
};

export default useVersionContents;
