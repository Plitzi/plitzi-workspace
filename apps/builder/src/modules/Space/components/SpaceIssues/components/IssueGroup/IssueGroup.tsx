import clsx from 'clsx';

import { MUTED } from '../../helpers';
import IssueItem from '../IssueItem';

import type { IssueSeverity } from '../../helpers';
import type { TSpaceIssue } from '@plitzi/sdk-shared';

export type IssueGroupProps = {
  title: string;
  issues: TSpaceIssue[];
  severity: IssueSeverity;
  onNavigate: () => void;
};

const IssueGroup = ({ title, issues, severity, onNavigate }: IssueGroupProps) => {
  if (issues.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-1">
      <h5 className={clsx('text-[10px] font-bold tracking-wider uppercase', MUTED)}>
        {title} · {issues.length}
      </h5>
      <ul className="flex flex-col">
        {issues.map((issue, index) => (
          <IssueItem
            key={`${issue.code}:${issue.elementId ?? ''}:${index}`}
            issue={issue}
            severity={severity}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </section>
  );
};

export default IssueGroup;
