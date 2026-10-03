import { formatTime, snapshotLabel } from '../../helpers';

import type { TSnapshotMarker } from '@plitzi/sdk-shared';

export type SnapshotMarkerProps = { snapshot: TSnapshotMarker };

/** Where a published revision falls on the timeline: what sits below it is what it includes. */
const SnapshotMarker = ({ snapshot }: SnapshotMarkerProps) => (
  <li
    className="text-primary-700 dark:text-primary-300 flex items-center gap-2 px-3 py-1.5 text-[11px]"
    title={formatTime(snapshot.publishedAt)}
  >
    <span className="bg-primary-200 dark:bg-primary-400/40 h-px w-3 shrink-0" />
    <i className="fa-solid fa-camera shrink-0" />
    <span className="truncate">{snapshotLabel(snapshot)}</span>
    <span className="bg-primary-200 dark:bg-primary-400/40 h-px grow" />
  </li>
);

export default SnapshotMarker;
