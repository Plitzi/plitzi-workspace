import clsx from 'clsx';
import { useCallback } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { chainOf } from '@pmodules/Builder/helpers/elementChain';
import useRevealElement from '@pmodules/Builder/hooks/useRevealElement';

import { SEVERITY_ICON, SEVERITY_TEXT } from '../../helpers';

import type { IssueSeverity } from '../../helpers';
import type { TSpaceIssue } from '@plitzi/sdk-shared';

export type IssueItemProps = {
  issue: TSpaceIssue;
  severity: IssueSeverity;
  /** Called once the element is on screen, so whatever holds the list can get out of the way. */
  onNavigate: () => void;
};

/**
 * One issue, and the way to it: the element it names is a link that opens its page or layout, unfolds the tree down
 * to it and selects it. An element deleted since the space was saved is named but not linked — there is nothing left
 * to take anyone to, and the issue goes away with the next save.
 */
const IssueItem = ({ issue, severity, onNavigate }: IssueItemProps) => {
  const [flat] = useBuilderStore('schema.flat');
  const revealElement = useRevealElement();
  const { elementId, message } = issue;
  const reachable = elementId !== null && elementId in flat;

  const handleReveal = useCallback(() => {
    if (elementId === null) {
      return;
    }

    revealElement({ id: elementId, ...chainOf(flat, elementId) });
    onNavigate();
  }, [elementId, flat, onNavigate, revealElement]);

  return (
    <li className="flex gap-2 border-b border-zinc-100 py-2 last:border-b-0 dark:border-zinc-800">
      <i className={clsx('fa-solid mt-0.5 text-xs', SEVERITY_ICON[severity], SEVERITY_TEXT[severity])} />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-200">{message}</p>
        {reachable && (
          <button
            type="button"
            className="self-start rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-indigo-700 hover:bg-indigo-50 dark:bg-zinc-800 dark:text-indigo-300 dark:hover:bg-zinc-700"
            title="Select this element"
            onClick={handleReveal}
          >
            {elementId}
          </button>
        )}
        {elementId !== null && !reachable && (
          <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{elementId}</span>
        )}
      </div>
    </li>
  );
};

export default IssueItem;
