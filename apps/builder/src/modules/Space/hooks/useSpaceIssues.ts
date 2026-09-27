import { use, useCallback, useEffect, useRef } from 'react';

import useGraphQL from '@pmodules/Network/hooks/useGraphQL';
import QueueStatusContext from '@pmodules/Queue/QueueStatusContext';

import type { TSpaceIssues } from '@plitzi/sdk-shared';

/** The document being edited: a published snapshot was read when it was published, and cannot change. */
const VARIABLES = { environment: 'main' };

/**
 * What is wrong with the space as it is SAVED, read by the same linter the publish gate runs.
 *
 * Asked again each time the save queue drains, not on every edit: the server can only read what it holds, and the
 * builder's own schema is ahead of it for as long as anything is still queued. `refresh` answers with the fresh list,
 * for a caller that has to decide on it — publishing — rather than just show it.
 */
const useSpaceIssues = () => {
  const processing = use(QueueStatusContext);
  const { data, error, mutate } = useGraphQL('SpaceIssues', undefined, VARIABLES, { revalidateOnFocus: false });
  const wasProcessing = useRef(processing);

  useEffect(() => {
    if (wasProcessing.current && !processing) {
      void mutate();
    }

    wasProcessing.current = processing;
  }, [processing, mutate]);

  const refresh = useCallback(async (): Promise<TSpaceIssues | undefined> => {
    const fresh = await mutate();

    return fresh?.SpaceIssues ?? undefined;
  }, [mutate]);

  return { issues: data?.SpaceIssues ?? undefined, error, refresh };
};

export default useSpaceIssues;
