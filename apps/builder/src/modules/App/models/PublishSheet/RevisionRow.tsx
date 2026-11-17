import { useCallback } from 'react';

import { ageAgo } from '../../helpers/age';
import { revisionName, revisionTitle } from '../../helpers/environments';

import type { PublishedEnvironment } from '../../helpers/environments';
import type { SpaceSnapshot } from '@plitzi/sdk-shared';

export type RevisionRowProps = {
  snapshot: SpaceSnapshot;
  /** The domain being published: the version it shows says so instead of offering itself again. */
  domain: string | undefined;
  onPublish: (environment: PublishedEnvironment, revision: number) => void;
};

/** One version kept: its words, who kept it and when, where it is live, its own preview address and a way to publish it. */
const RevisionRow = ({ snapshot, domain, onPublish }: RevisionRowProps) => {
  const liveHere = domain !== undefined && snapshot.domains.includes(domain);
  const { environment, revision } = snapshot;
  const handlePublish = useCallback(() => {
    if (environment !== 'main') {
      onPublish(environment, revision);
    }
  }, [environment, onPublish, revision]);

  return (
    <li className="hover:bg-ui-hover flex items-center gap-2 rounded-md px-2 py-1.5">
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="text-ui-fg min-w-0 truncate text-sm font-medium">
            {snapshot.description || 'No description'}
          </span>
          {liveHere && (
            <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
              live here
            </span>
          )}
        </span>
        <span className="text-ui-fg-subtle truncate text-[11px]">
          {[
            revisionTitle(environment, revision),
            snapshot.by?.username,
            ageAgo(snapshot.publishedAt),
            snapshot.domains.length > 0 && !liveHere ? `live on ${snapshot.domains.join(', ')}` : ''
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      {/* Its own address: the version as a visitor would see it, before any domain shows it. */}
      <a
        href={snapshot.previewUrl}
        target="_blank"
        rel="noreferrer noopener"
        title={`Preview ${revisionName(environment, revision)} at its own address — only whoever has the link can open it`}
        className="text-ui-fg-subtle hover:text-ui-fg focus-visible:ring-primary-500 shrink-0 rounded-md px-2 py-1 text-xs font-medium outline-none focus-visible:ring-2"
      >
        Preview
      </a>
      {domain && !liveHere && (
        <button
          type="button"
          title={`Publish ${revisionName(environment, revision)} on ${domain}`}
          className="border-ui-line text-ui-fg hover:bg-ui-panel focus-visible:ring-primary-500 shrink-0 rounded-md border px-2 py-1 text-xs font-medium outline-none focus-visible:ring-2"
          onClick={handlePublish}
        >
          Publish…
        </button>
      )}
    </li>
  );
};

export default RevisionRow;
