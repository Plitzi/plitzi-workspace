import clsx from 'clsx';

import IssueGroup from './components/IssueGroup';
import { MUTED } from './helpers';

import type { TSpaceIssues } from '@plitzi/sdk-shared';

export type SpaceIssuesProps = {
  issues: TSpaceIssues;
  /** Said above the list — why it is being shown, when that is not simply because someone asked. */
  intro?: string;
  onNavigate: () => void;
};

/**
 * Everything the linter found in the saved space: errors first, since they are what stops a publish, then what renders
 * but most likely not as meant. Each one names its element and takes you to it.
 */
const SpaceIssues = ({ issues, intro, onNavigate }: SpaceIssuesProps) => {
  const clean = issues.errors.length === 0 && issues.warnings.length === 0;

  return (
    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
      {intro && <p className="text-sm text-zinc-700 dark:text-zinc-200">{intro}</p>}
      {clean && (
        <p className={clsx('flex items-center gap-2 text-sm', MUTED)}>
          <i className="fa-solid fa-circle-check text-green-600 dark:text-green-400" />
          Nothing wrong with the saved space.
        </p>
      )}
      <IssueGroup title="Errors" issues={issues.errors} severity="error" onNavigate={onNavigate} />
      <IssueGroup title="Warnings" issues={issues.warnings} severity="warning" onNavigate={onNavigate} />
    </div>
  );
};

export default SpaceIssues;
