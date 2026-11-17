import clsx from 'clsx';
import { useCallback } from 'react';

import { ageAgo } from '../../helpers/age';

import type { SpaceSnapshot } from '@plitzi/sdk-shared';

export type RevisionOptionProps = {
  snapshot: SpaceSnapshot;
  chosen: boolean;
  /** The domain being published: the version it shows says so. */
  domain: string;
  onPick: (revision: number) => void;
};

/** One version to choose: its number and words, who kept it and when, where it is live, and its own preview address. */
const RevisionOption = ({ snapshot, chosen, domain, onPick }: RevisionOptionProps) => {
  const liveHere = snapshot.domains.includes(domain);
  const handlePick = useCallback(() => onPick(snapshot.revision), [onPick, snapshot.revision]);

  return (
    <li className="flex items-stretch gap-1">
      <button
        type="button"
        role="radio"
        aria-checked={chosen}
        className={clsx(
          'flex min-w-0 grow items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-left transition-colors outline-none',
          'focus-visible:ring-primary-500 focus-visible:ring-2',
          chosen ? 'border-primary-500 bg-primary-500/10' : 'hover:bg-ui-hover border-transparent'
        )}
        onClick={handlePick}
      >
        <span className="text-ui-fg bg-ui-raised shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold">
          v{snapshot.revision}
        </span>
        <span className="flex min-w-0 grow flex-col">
          <span className="text-ui-fg truncate text-sm">{snapshot.description || 'No description'}</span>
          <span className="text-ui-fg-subtle truncate text-[11px]">
            {[snapshot.by?.username, ageAgo(snapshot.publishedAt)].filter(Boolean).join(' · ')}
          </span>
        </span>
        {liveHere && (
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
            live here
          </span>
        )}
      </button>
      {/* Its own address: the version as a visitor would see it, before any domain shows it. */}
      <a
        href={snapshot.previewUrl}
        target="_blank"
        rel="noreferrer noopener"
        title={`Preview v${String(snapshot.revision)} at its own address — only whoever has the link can open it`}
        className="text-ui-fg-subtle hover:text-ui-fg hover:bg-ui-hover focus-visible:ring-primary-500 flex shrink-0 items-center rounded-md px-2 text-xs font-medium outline-none focus-visible:ring-2"
      >
        Preview
      </a>
    </li>
  );
};

export default RevisionOption;
