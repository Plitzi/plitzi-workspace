import { QueryBuilderFormatter } from '@plitzi/plitzi-ui/QueryBuilder';
import { useMemo } from 'react';

import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';

export type NodeWhenProps = {
  when?: RuleGroup;
};

const NodeWhen = ({ when }: NodeWhenProps) => {
  const whenStr = useMemo(() => {
    if (!when) {
      return null;
    }

    return QueryBuilderFormatter(when) || null;
  }, [when]);

  if (!whenStr) {
    return null;
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-ui-fg-subtle text-[10px] font-semibold tracking-wider uppercase">Condition</span>
      <span className="text-ui-fg break-all">{whenStr}</span>
    </div>
  );
};

export default NodeWhen;
