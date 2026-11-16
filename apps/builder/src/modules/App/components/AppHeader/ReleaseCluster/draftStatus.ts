import { revisionName } from '../../../helpers/environments';

import type { SpaceSnapshot, SpaceVersionChanges } from '@plitzi/sdk-shared';

/** What the draft is against the last snapshot, in words: the header's answer to "is what I see kept anywhere?". */
export const draftStatus = (
  newest: SpaceSnapshot | undefined,
  changes: SpaceVersionChanges | undefined
): { words: string; short: string; pending: boolean } => {
  if (!newest) {
    return { words: 'Draft · no snapshot yet', short: 'No snapshot', pending: true };
  }

  const kept = revisionName(newest.environment, newest.revision);
  if (!changes || changes.total === 0) {
    return { words: `Draft · kept as ${kept}`, short: `r${String(newest.revision)}`, pending: false };
  }

  const count = changes.total === 1 ? '1 change' : `${String(changes.total)} changes`;

  return { words: `Draft · ${count} since ${kept}`, short: count, pending: true };
};
