import Heading from '@plitzi/plitzi-ui/Heading';
import { QueryBuilderFormatter } from '@plitzi/plitzi-ui/QueryBuilder';
import { useMemo } from 'react';

import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';

export type NodeWhenProps = {
  when?: RuleGroup;
};

const NodeWhen = ({ when }: NodeWhenProps) => {
  const whenStr = useMemo(() => {
    const str = QueryBuilderFormatter(when) as string;
    if (str) {
      return str;
    }

    return 'None';
  }, [when]);

  return (
    <div className="flex flex-col break-all">
      <Heading as="h5" className="mt-2 mb-0">
        Condition to execute
      </Heading>
      {whenStr}
    </div>
  );
};

export default NodeWhen;
