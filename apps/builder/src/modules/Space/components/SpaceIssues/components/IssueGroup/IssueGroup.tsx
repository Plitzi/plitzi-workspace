import { byCode, SEVERITY_ICON, SEVERITY_TEXT } from '../../helpers';
import CodeGroup from '../CodeGroup';
import IssueItem from '../IssueItem';

import type { IssueSeverity } from '../../helpers';
import type { TSpaceIssue } from '@plitzi/sdk-shared/network';

export type IssueGroupProps = {
  issues: TSpaceIssue[];
  severity: IssueSeverity;
  onDismiss: () => void;
};

/** The errors or the warnings, a group per code: what to write instead said once, then each place it was found. */
const IssueGroup = ({ issues, severity, onDismiss }: IssueGroupProps) => {
  const groups = byCode(issues);

  return (
    <ul className="flex flex-col gap-2">
      {groups.map(group => (
        <CodeGroup
          key={group.code}
          code={group.code}
          count={group.items.length}
          fix={group.fix}
          icon={SEVERITY_ICON[severity]}
          tone={SEVERITY_TEXT[severity]}
          defaultOpen={groups.length === 1}
        >
          {group.items.map((issue, index) => (
            <IssueItem key={`${issue.elementId ?? ''}:${String(index)}`} issue={issue} onDismiss={onDismiss} />
          ))}
        </CodeGroup>
      ))}
    </ul>
  );
};

export default IssueGroup;
