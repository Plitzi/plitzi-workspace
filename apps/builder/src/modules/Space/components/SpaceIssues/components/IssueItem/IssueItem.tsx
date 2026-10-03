import clsx from 'clsx';

import { MUTED, SEVERITY_ICON, SEVERITY_TEXT } from '../../helpers';
import ElementChip from '../ElementChip';
import IssueFix from '../IssueFix';

import type { IssueSeverity } from '../../helpers';
import type { TSpaceIssue } from '@plitzi/sdk-shared';

export type IssueItemProps = {
  issue: TSpaceIssue;
  severity: IssueSeverity;
  /** Called once the element is on screen, so whatever holds the list can get out of the way. */
  onDismiss: () => void;
};

/** One issue, what to write instead, and the element it names — a link to it. */
const IssueItem = ({ issue, severity, onDismiss }: IssueItemProps) => (
  <li className="flex gap-2 border-b border-zinc-100 py-2 last:border-b-0 dark:border-zinc-800">
    <i className={clsx('fa-solid mt-0.5 text-xs', SEVERITY_ICON[severity], SEVERITY_TEXT[severity])} />
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-200">{issue.message}</p>
      {issue.fix && <IssueFix fix={issue.fix} />}
      {issue.fixable && (
        <span className={clsx('text-[10px] tracking-wider uppercase', MUTED)}>Fixable automatically</span>
      )}
      {issue.elementId !== null && <ElementChip elementId={issue.elementId} onDismiss={onDismiss} />}
    </div>
  </li>
);

export default IssueItem;
