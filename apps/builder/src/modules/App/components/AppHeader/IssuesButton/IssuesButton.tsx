import clsx from 'clsx';
import { memo, useCallback } from 'react';

import { levelOf } from '@pmodules/Space/helpers/spaceIssues';
import useShowSpaceIssues from '@pmodules/Space/hooks/useShowSpaceIssues';
import useSpaceIssues from '@pmodules/Space/hooks/useSpaceIssues';

import { LEVEL_ICON, LEVEL_TEXT, LEVEL_TITLE } from './helpers';

/**
 * How the saved space reads, in the header: the count of what stops it from publishing, or of what only asks to be
 * looked at, or a quiet tick. Found out here, while editing, rather than from a refused publish.
 */
const IssuesButton = () => {
  const { issues } = useSpaceIssues();
  const showSpaceIssues = useShowSpaceIssues();

  const handleClick = useCallback(() => {
    if (issues) {
      void showSpaceIssues(issues);
    }
  }, [issues, showSpaceIssues]);

  if (!issues) {
    return null;
  }

  const level = levelOf(issues);
  const count = level === 'errors' ? issues.errors.length : issues.warnings.length;

  return (
    <button
      id="header-issues"
      type="button"
      title={LEVEL_TITLE[level]}
      className={clsx(
        'flex h-7 cursor-pointer items-center gap-1.5 rounded px-2 text-xs transition-colors select-none',
        'hover:bg-zinc-100 dark:hover:bg-zinc-800',
        LEVEL_TEXT[level]
      )}
      onClick={handleClick}
    >
      <i className={clsx('fa-solid text-[10px]', LEVEL_ICON[level])} />
      {level !== 'clean' && <span className="font-medium">{count}</span>}
    </button>
  );
};

export default memo(IssuesButton);
