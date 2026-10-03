import clsx from 'clsx';
import { memo, useCallback } from 'react';

import { levelOf } from '@pmodules/Space/helpers/spaceIssues';
import useShowSpaceIssues from '@pmodules/Space/hooks/useShowSpaceIssues';
import useSpaceIssues from '@pmodules/Space/hooks/useSpaceIssues';

import { LEVEL_ICON, LEVEL_TEXT, LEVEL_TITLE, SUGGESTING_TEXT } from './helpers';

/**
 * How the saved space reads, in the header: the count of what stops it from publishing, or of what only asks to be
 * looked at, or — nothing wrong — of the shorter ways to the same page, or a quiet tick. Found out here, while editing,
 * rather than from a refused publish.
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
  // Nothing wrong, and something shorter: said in the accent, not as an alarm.
  const suggesting = level === 'clean' && issues.suggestions.length > 0;
  const count = level === 'errors' ? issues.errors.length : issues.warnings.length;
  const shown = suggesting ? issues.suggestions.length : count;
  const tone = suggesting ? SUGGESTING_TEXT : LEVEL_TEXT[level];
  const icon = suggesting ? 'fa-lightbulb' : LEVEL_ICON[level];
  const title = suggesting
    ? `${LEVEL_TITLE.clean} — ${String(issues.suggestions.length)} shorter way${issues.suggestions.length === 1 ? '' : 's'} to the same page`
    : LEVEL_TITLE[level];

  return (
    <button
      id="header-issues"
      type="button"
      title={title}
      className={clsx(
        'flex h-7 cursor-pointer items-center gap-1.5 rounded px-2 text-xs transition-colors select-none',
        'hover:bg-zinc-100 dark:hover:bg-zinc-800',
        tone
      )}
      onClick={handleClick}
    >
      <i className={clsx('fa-solid text-[10px]', icon)} />
      {(level !== 'clean' || suggesting) && <span className="font-medium">{shown}</span>}
    </button>
  );
};

export default memo(IssuesButton);
