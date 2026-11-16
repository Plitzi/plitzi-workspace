import clsx from 'clsx';

import { ageAgo } from '../../helpers/age';
import { ENVIRONMENT_META } from '../../helpers/environments';

import type { Environment, SpaceSnapshot } from '@plitzi/sdk-shared';

export type RevisionListProps = {
  environment: Exclude<Environment, 'main'>;
  snapshots: readonly SpaceSnapshot[];
  loading: boolean;
  revision: number | undefined;
  /** The domain being published: a revision live there says so. */
  domain: string | undefined;
  onPick: (revision: number) => void;
};

/**
 * An environment's snapshots to publish, newest first: each with its words, who made it, how old and where it is live,
 * and its own preview address beside it.
 */
const RevisionList = ({ environment, snapshots, loading, revision, domain, onPick }: RevisionListProps) => (
  <section className="flex flex-col gap-2" aria-label="Revision">
    <h5 className="text-ui-fg text-xs font-medium">Version</h5>
    {loading && <span className="text-ui-fg-subtle text-xs">Reading the snapshots…</span>}
    {!loading && snapshots.length === 0 && (
      <span className="text-ui-fg-subtle text-xs">No versions kept in {ENVIRONMENT_META[environment].label} yet.</span>
    )}
    <div role="radiogroup" aria-label="Revision" className="flex max-h-64 flex-col gap-1 overflow-y-auto">
      {snapshots.map(snapshot => {
        const chosen = snapshot.revision === revision;
        const liveHere = snapshot.domains.includes(domain ?? '');

        return (
          <div key={snapshot.revision} className="flex items-stretch gap-1">
            <button
              type="button"
              role="radio"
              aria-checked={chosen}
              className={clsx(
                'flex min-w-0 flex-1 flex-col gap-0.5 rounded-md border px-3 py-1.5 text-left transition-colors outline-none',
                'focus-visible:ring-primary-500 focus-visible:ring-2',
                chosen ? 'border-primary-500 bg-primary-500/10' : 'hover:bg-ui-hover border-transparent'
              )}
              onClick={() => onPick(snapshot.revision)}
            >
              <span className="flex items-center gap-2">
                <span className="text-ui-fg text-sm font-semibold">r{snapshot.revision}</span>
                <span className="text-ui-fg min-w-0 truncate text-sm">{snapshot.description || 'No description'}</span>
                {liveHere && (
                  <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                    live here
                  </span>
                )}
              </span>
              <span className="text-ui-fg-subtle truncate text-[11px]">
                {[
                  snapshot.by?.username,
                  ageAgo(snapshot.publishedAt),
                  snapshot.domains.length > 0 && !liveHere ? `live on ${snapshot.domains.join(', ')}` : ''
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </button>
            {/* Its own address: the snapshot as a visitor would see it, before any domain serves it. */}
            <a
              href={snapshot.previewUrl}
              target="_blank"
              rel="noreferrer noopener"
              title={`Preview r${String(snapshot.revision)} at its own address — only whoever has the link can open it`}
              className="text-ui-fg-subtle hover:text-ui-fg hover:bg-ui-hover focus-visible:ring-primary-500 flex shrink-0 items-center rounded-md px-2 text-xs font-medium outline-none focus-visible:ring-2"
            >
              Preview
            </a>
          </div>
        );
      })}
    </div>
  </section>
);

export default RevisionList;
