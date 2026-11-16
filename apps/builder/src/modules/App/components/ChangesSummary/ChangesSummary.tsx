import clsx from 'clsx';

import { changeLines } from './helpers';

import type { SpaceVersionChanges } from '@plitzi/sdk-shared';

export type ChangesSummaryProps = {
  /** What it is a summary of: "What changes since production r12". */
  title: string;
  changes: SpaceVersionChanges | undefined;
  loading: boolean;
  /** Said instead when there is nothing to compare with — the first snapshot of an environment. */
  empty?: string;
  className?: string;
};

/** What changes between two versions: a line of counts, and the names behind it for whoever opens them. */
const ChangesSummary = ({
  title,
  changes,
  loading,
  empty = 'Nothing to compare with yet',
  className
}: ChangesSummaryProps) => {
  const lines = changes ? changeLines(changes) : undefined;

  return (
    <div className={clsx('bg-ui-raised flex flex-col gap-1 rounded-lg px-3 py-2.5 text-xs', className)}>
      <span className="text-ui-fg-subtle text-[11px] font-bold tracking-wider uppercase">{title}</span>
      {loading && <span className="text-ui-fg-subtle">Comparing…</span>}
      {!loading && !lines && <span className="text-ui-fg-subtle">{empty}</span>}
      {!loading && lines && (
        <>
          <span className={clsx(changes?.total ? 'text-ui-fg' : 'text-ui-fg-subtle')}>{lines.summary}</span>
          {lines.details.length > 0 && (
            <details className="text-ui-fg-subtle">
              <summary className="hover:text-ui-fg w-fit cursor-pointer">What exactly</summary>
              <ul className="mt-1 flex flex-col gap-0.5 pl-3">
                {lines.details.map(line => (
                  <li key={line} className="list-disc">
                    {line}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
};

export default ChangesSummary;
