import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import QueryBuilder from '@plitzi/plitzi-ui/QueryBuilder';
import { useCallback, useMemo } from 'react';

import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';

import type { Field, RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';

export type NodeWhenProps = {
  when?: RuleGroup;
  fields?: Record<string, Field>;
  onChange?: (data: { when: RuleGroup }) => void;
};

const NodeWhen = ({ when, fields = emptyObject, onChange }: NodeWhenProps) => {
  const handleChange = useCallback((query: RuleGroup) => onChange?.({ when: query }), [onChange]);

  const isCollapsed = useMemo(
    () => !when || !(when.rules as RuleGroup['rules'] | undefined) || when.rules.length === 0,
    [when]
  );

  return (
    <div className="flex flex-col items-center border-t-2 border-dotted border-gray-300 px-4 py-2">
      <ContainerCollapsable className="flex w-full justify-center" collapsed={isCollapsed}>
        <ContainerCollapsable.Header title="When" placement="right" />
        <ContainerCollapsable.Content>
          <QueryBuilder
            direction="vertical"
            className="w-full py-2"
            query={when}
            fields={fields}
            onChange={handleChange}
            showBranches
          />
        </ContainerCollapsable.Content>
      </ContainerCollapsable>
    </div>
  );
};

export default NodeWhen;
