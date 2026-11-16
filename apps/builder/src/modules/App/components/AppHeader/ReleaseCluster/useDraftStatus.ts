import { use, useEffect, useRef } from 'react';

import QueueStatusContext from '@pmodules/Queue/QueueStatusContext';
import { QUIET_MS } from '@pmodules/Space/hooks/useSpaceIssues';

import useLatestSnapshots from '../../../hooks/useLatestSnapshots';
import { useVersionChanges } from '../../ChangesSummary';

/**
 * The draft against the last snapshot made, in any environment: how many things differ — read again once the saves
 * have drained and stayed so for a moment, as the issues are, never on every edit.
 */
const useDraftStatus = () => {
  const { newest, loading: readingSnapshots, refresh: refreshSnapshots } = useLatestSnapshots();
  const {
    changes,
    loading,
    refresh: refreshChanges
  } = useVersionChanges(newest ? { environment: newest.environment, revision: newest.revision } : undefined, {
    environment: 'main'
  });
  const processing = use(QueueStatusContext);
  const wasProcessing = useRef(processing);

  useEffect(() => {
    const drained = wasProcessing.current && !processing;
    wasProcessing.current = processing;
    if (!drained) {
      return undefined;
    }

    const timer = setTimeout(() => void refreshChanges(), QUIET_MS);

    return () => clearTimeout(timer);
  }, [processing, refreshChanges]);

  return {
    newest,
    changes,
    loading: readingSnapshots || loading,
    /** After a snapshot or a publish: the newest snapshot, and the draft against it. */
    refresh: async () => {
      await refreshSnapshots();
      await refreshChanges();
    }
  };
};

export default useDraftStatus;
