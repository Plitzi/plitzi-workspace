import { formatTime, snapshotLabel } from '../../helpers';

import type { TSnapshotMarker } from '@plitzi/sdk-shared';

export type SnapshotMarkerProps = { snapshot: TSnapshotMarker };

/** Where a published revision falls on the timeline: what sits below it is what it includes. */
const SnapshotMarker = ({ snapshot }: SnapshotMarkerProps) => (
  <li
    className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-indigo-700 dark:text-indigo-300"
    title={formatTime(snapshot.publishedAt)}
  >
    <span className="h-px w-3 shrink-0 bg-indigo-200 dark:bg-indigo-500/40" />
    <i className="fa-solid fa-camera shrink-0" />
    <span className="truncate">{snapshotLabel(snapshot)}</span>
    <span className="h-px grow bg-indigo-200 dark:bg-indigo-500/40" />
  </li>
);

export default SnapshotMarker;
