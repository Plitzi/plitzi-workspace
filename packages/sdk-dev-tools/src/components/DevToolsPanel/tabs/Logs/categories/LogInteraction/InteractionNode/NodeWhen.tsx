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
      <span className="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
        Condition
      </span>
      <span className="break-all text-zinc-700 dark:text-zinc-300">{whenStr}</span>
    </div>
  );
};

export default NodeWhen;
