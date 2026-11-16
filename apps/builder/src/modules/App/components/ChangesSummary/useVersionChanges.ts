import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import type { Environment, SpaceVersionChanges } from '@plitzi/sdk-shared';

/** A version: an environment, and a revision of it — its latest when left out. */
export type VersionRef = { environment: Environment; revision?: number };

/**
 * What changes going from `from` to `to`, asked once both are known — nothing is asked while either is still being
 * chosen or read.
 */
const useVersionChanges = (
  from: VersionRef | undefined,
  to: VersionRef | undefined
): { changes: SpaceVersionChanges | undefined; loading: boolean; refresh: () => Promise<unknown> } => {
  const { data, isLoading, mutate } = useGraphQL(
    from && to ? 'SpaceVersionChanges' : null,
    response => response?.SpaceVersionChanges ?? undefined,
    {
      fromEnvironment: from?.environment,
      ...(from?.revision ? { fromRevision: from.revision } : {}),
      toEnvironment: to?.environment,
      ...(to?.revision ? { toRevision: to.revision } : {})
    },
    // The draft changes with every edit: read whenever it is shown.
    { revalidateOnMount: true }
  );

  return { changes: data, loading: isLoading, refresh: mutate };
};

export default useVersionChanges;
