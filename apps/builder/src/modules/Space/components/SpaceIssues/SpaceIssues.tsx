import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';
import { useCallback } from 'react';

import { fixableCount } from '@pmodules/Space/helpers/spaceIssues';

import IssueGroup from './components/IssueGroup';
import { MUTED } from './helpers';

import type { TSpaceIssues } from '@plitzi/sdk-shared';

export type SpaceIssuesProps = {
  issues: TSpaceIssues;
  /** Said above the list — why it is being shown, when that is not simply because someone asked. */
  intro?: string;
  /** Called once the list has served its purpose — someone went to an element, or had the fixable ones fixed. */
  onDismiss: () => void;
  /** Fixes what has one reading; offered only when something in the list has. */
  onFix?: () => Promise<unknown>;
};

/**
 * Everything the linter found in the saved space: errors first, since they are what stops a publish, then what renders
 * but most likely not as meant. Each one names its element and takes you to it.
 */
const SpaceIssues = ({ issues, intro, onDismiss, onFix }: SpaceIssuesProps) => {
  const clean = issues.errors.length === 0 && issues.warnings.length === 0;
  const fixable = fixableCount(issues);

  const handleFix = useCallback(() => {
    void onFix?.().then(onDismiss);
  }, [onDismiss, onFix]);

  return (
    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
      {intro && <p className="text-sm text-zinc-700 dark:text-zinc-200">{intro}</p>}
      {onFix && fixable > 0 && (
        <Button size="sm" intent="secondary" className="self-start" onClick={handleFix}>
          {`Fix ${fixable} automatically`}
        </Button>
      )}
      {clean && (
        <p className={clsx('flex items-center gap-2 text-sm', MUTED)}>
          <i className="fa-solid fa-circle-check text-green-600 dark:text-green-400" />
          Nothing wrong with the saved space.
        </p>
      )}
      <IssueGroup title="Errors" issues={issues.errors} severity="error" onDismiss={onDismiss} />
      <IssueGroup title="Warnings" issues={issues.warnings} severity="warning" onDismiss={onDismiss} />
    </div>
  );
};

export default SpaceIssues;
