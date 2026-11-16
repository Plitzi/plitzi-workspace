import clsx from 'clsx';

import { draftStatus } from './draftStatus';

import type { SpaceSnapshot, SpaceVersionChanges } from '@plitzi/sdk-shared';

export type DraftStatusChipProps = {
  newest: SpaceSnapshot | undefined;
  changes: SpaceVersionChanges | undefined;
  loading: boolean;
  onClick: () => void;
};

/**
 * The draft's status at the head of the release cluster: kept as a snapshot, or how far it has moved since the last one.
 * Pressed, it opens the publish sheet. Under 1,536 px it shows its short form, its words staying its title.
 */
const DraftStatusChip = ({ newest, changes, loading, onClick }: DraftStatusChipProps) => {
  const { words, short, pending } = draftStatus(newest, changes);

  return (
    <button
      id="header-draft-status"
      type="button"
      title={`${words} — open Publish`}
      aria-label={`${words} — open Publish`}
      className="border-ui-line text-ui-fg-subtle hover:bg-ui-hover hover:text-ui-fg flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs whitespace-nowrap transition-colors"
      onClick={onClick}
    >
      <span
        className={clsx(
          'h-1.5 w-1.5 rounded-full',
          loading ? 'bg-ui-line-strong' : pending ? 'bg-amber-500' : 'bg-emerald-500'
        )}
      />
      <span className="hidden 2xl:inline">{words}</span>
      <span className="2xl:hidden">{short}</span>
    </button>
  );
};

export default DraftStatusChip;
