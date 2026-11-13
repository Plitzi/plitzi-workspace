import { use, useCallback, useEffect, useRef } from 'react';

import useGraphQL from '@pmodules/Network/hooks/useGraphQL';
import QueueStatusContext from '@pmodules/Queue/QueueStatusContext';

import type { TSpaceIssues } from '@plitzi/sdk-shared/network';

/** The document being edited: a published snapshot was read when it was published, and cannot change. */
const VARIABLES = { environment: 'main' };

/**
 * How long the save queue stays drained before the list is asked for again. While someone edits, it drains after every
 * change, and each answer is the whole space read by the linter on the server: asked each time, a big space's checks
 * queued behind its own saves.
 */
export const QUIET_MS = 1500;

/**
 * What is wrong with the space as it is SAVED, read by the same linter the publish gate runs.
 *
 * Asked again once the save queue has drained and stayed so for a moment (`QUIET_MS`), not on every edit: the server can
 * only read what it holds, and the builder's own schema is ahead of it for as long as anything is still queued. `refresh` answers with the fresh list,
 * for a caller that has to decide on it — publishing — rather than just show it.
 */
const useSpaceIssues = () => {
  const processing = use(QueueStatusContext);
  const { data, error, mutate } = useGraphQL('SpaceIssues', undefined, VARIABLES, { revalidateOnFocus: false });
  const wasProcessing = useRef(processing);

  useEffect(() => {
    const drained = wasProcessing.current && !processing;
    wasProcessing.current = processing;
    if (!drained) {
      return undefined;
    }

    // Another save before the moment is up cancels it: the list is asked for once the editing pauses.
    const timer = setTimeout(() => void mutate(), QUIET_MS);

    return () => clearTimeout(timer);
  }, [processing, mutate]);

  const refresh = useCallback(async (): Promise<TSpaceIssues | undefined> => {
    const fresh = await mutate();

    return fresh?.SpaceIssues ?? undefined;
  }, [mutate]);

  return { issues: data?.SpaceIssues ?? undefined, error, refresh };
};

export default useSpaceIssues;
