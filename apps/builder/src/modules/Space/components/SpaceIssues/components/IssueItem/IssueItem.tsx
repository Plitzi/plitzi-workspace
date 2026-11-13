import clsx from 'clsx';

import { MUTED } from '../../helpers';
import ElementChip from '../ElementChip';
import Message from '../Message';

import type { TSpaceIssue } from '@plitzi/sdk-shared/network';

export type IssueItemProps = {
  issue: TSpaceIssue;
  /** Called once the element is on screen, so whatever holds the list can get out of the way. */
  onDismiss: () => void;
};

/** One issue of its code's group, and the element it names — a link to it. What to write instead is the group's. */
const IssueItem = ({ issue, onDismiss }: IssueItemProps) => (
  <li className="border-ui-line flex flex-col gap-1 border-t py-2 first:border-t-0">
    <Message text={issue.message} />
    <div className="flex flex-wrap items-center gap-2">
      {issue.elementId !== null && <ElementChip elementId={issue.elementId} onDismiss={onDismiss} />}
      {issue.fixable && (
        <span className={clsx('text-[11px] tracking-wider uppercase', MUTED)}>Fixable automatically</span>
      )}
    </div>
  </li>
);

export default IssueItem;
