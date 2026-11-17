import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';

import { draftStatus } from './draftStatus';
import ChangesSummary from '../../ChangesSummary';

import type { TargetAttention } from './targetAttention';
import type { SpaceSnapshot, SpaceVersionChanges } from '@plitzi/sdk-shared';

export type DraftPanelProps = {
  newest: SpaceSnapshot | undefined;
  changes: SpaceVersionChanges | undefined;
  loading: boolean;
  /** Where the draft is live as it is saved — the space's own address — when it has one. */
  draftAddress: string | undefined;
  attention: readonly TargetAttention[];
  /** Snapshot is locked by the plan: its button says so and leads to the plan. */
  snapshotLocked: boolean;
  onSnapshot: () => void;
  /** Opens Publish, on a domain when one is named. */
  onPublish: (domain?: string) => void;
};

const capitalized = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const TONE_DOT: Record<TargetAttention['tone'], string> = {
  danger: 'bg-red-500',
  warning: 'bg-amber-500',
  progress: 'bg-primary-500 animate-pulse'
};

/**
 * The draft, opened from its chip: what it is against the last snapshot and what changed, where it is
 * live as it is saved, what the space's targets ask — and the next step, Snapshot. Publish has its own button: this is
 * where a person reads where they are, not a second way to the same sheet.
 */
const DraftPanel = ({
  newest,
  changes,
  loading,
  draftAddress,
  attention,
  snapshotLocked,
  onSnapshot,
  onPublish
}: DraftPanelProps) => {
  const { words, pending } = draftStatus(newest, changes);
  const since = newest ? `${newest.environment} r${String(newest.revision)}` : undefined;

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-1 px-4 pt-3.5 pb-3">
        <span className="text-ui-fg-subtle text-[11px] font-bold tracking-wider uppercase">Draft</span>
        <span className="text-ui-fg flex items-center gap-2 text-sm font-semibold">
          <span
            className={clsx(
              'h-2 w-2 shrink-0 rounded-full',
              loading ? 'bg-ui-line-strong' : pending ? 'bg-amber-500' : 'bg-emerald-500'
            )}
          />
          {capitalized(words.replace(/^Draft · /, ''))}
        </span>
        <span className="text-ui-fg-subtle text-xs">
          {!newest
            ? 'No version of it is kept yet: saving one keeps it to publish, compare and go back to.'
            : pending
              ? 'Saved as you edit, and live only at the space’s own address: saving a version keeps it.'
              : 'Everything you see is kept in the newest version.'}
        </span>
      </div>

      {newest && (
        <ChangesSummary
          className="mx-4"
          title={since ? `Since ${since}` : 'Changes'}
          changes={changes}
          loading={loading}
        />
      )}

      {draftAddress && (
        <a
          href={`https://${draftAddress}`}
          target="_blank"
          rel="noreferrer noopener"
          className="text-ui-fg-subtle hover:text-ui-fg mx-4 mt-3 flex items-center gap-2 text-xs"
        >
          <i className="fa-solid fa-arrow-up-right-from-square w-3 text-center" />
          <span className="truncate">
            Live as it is saved at <span className="text-ui-fg font-medium">{draftAddress}</span>
          </span>
        </a>
      )}

      {attention.length > 0 && (
        <div className="border-ui-line mt-3 flex flex-col gap-1 border-t px-2 pt-2">
          <span className="text-ui-fg-subtle px-2 text-[11px] font-bold tracking-wider uppercase">Targets</span>
          {attention.map(item => (
            <button
              key={item.domain}
              type="button"
              className="hover:bg-ui-hover focus-visible:bg-ui-hover flex items-start gap-2 rounded-md px-2 py-1.5 text-left outline-none"
              onClick={() => onPublish(item.domain)}
            >
              <span className={clsx('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[item.tone])} />
              <span className="flex min-w-0 flex-col">
                <span className="text-ui-fg truncate text-xs font-semibold">{item.domain}</span>
                <span className="text-ui-fg-subtle line-clamp-2 text-xs">{item.words}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="border-ui-line mt-3 flex items-center justify-end gap-2 border-t px-4 py-3">
        <Button
          size="sm"
          intent="custom"
          className="text-ui-fg-subtle hover:text-ui-fg hover:bg-ui-hover border-transparent bg-transparent"
          onClick={() => onPublish()}
        >
          Publish…
        </Button>
        <Button size="sm" iconPlacement="before" onClick={onSnapshot}>
          {snapshotLocked && <Button.Icon icon="fa-solid fa-lock" />}
          {pending ? 'Save a version' : 'Save another version'}
        </Button>
      </div>
    </div>
  );
};

export default DraftPanel;
