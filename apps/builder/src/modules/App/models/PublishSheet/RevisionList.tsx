import RevisionRow from './RevisionRow';

import type { PublishedEnvironment } from '../../helpers/environments';
import type { SpaceSnapshot } from '@plitzi/sdk-shared';

export type RevisionListProps = {
  /** Every version kept, newest first — one list, whatever environment kept each. */
  snapshots: readonly SpaceSnapshot[];
  loading: boolean;
  /** The domain being published: a version live there says so. */
  domain: string | undefined;
  onPublish: (environment: PublishedEnvironment, revision: number) => void;
};

/**
 * The versions kept, newest first and in one list — each to preview at its own address or to publish on the domain: how
 * a site goes back to what it showed before, or shows a version kept with Snapshot.
 */
const RevisionList = ({ snapshots, loading, domain, onPublish }: RevisionListProps) => (
  <section className="flex flex-col gap-2" aria-label="Versions you kept">
    <div className="flex flex-col gap-0.5">
      <h5 className="text-ui-fg text-sm font-semibold">Versions you kept</h5>
      <span className="text-ui-fg-subtle text-xs">
        Every publish keeps one, and so does Snapshot.
        {domain ? ` Publish an earlier one on ${domain} to go back to it.` : ''}
      </span>
    </div>
    {loading && <span className="text-ui-fg-subtle text-xs">Reading the versions…</span>}
    {!loading && snapshots.length === 0 && (
      <span className="text-ui-fg-subtle text-xs">None yet: your first publish keeps one.</span>
    )}
    <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
      {snapshots.map(snapshot => (
        <RevisionRow
          key={`${snapshot.environment}-${String(snapshot.revision)}`}
          snapshot={snapshot}
          domain={domain}
          onPublish={onPublish}
        />
      ))}
    </ul>
  </section>
);

export default RevisionList;
