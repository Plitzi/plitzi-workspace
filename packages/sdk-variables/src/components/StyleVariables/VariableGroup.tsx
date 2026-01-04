import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import Icon from '@plitzi/plitzi-ui/Icon';

import StyleVariable from './StyleVariable';

import type { TStyleVariable } from './StyleVariables';
import type { StyleVariableCategory, StyleVariableGroup } from '@plitzi/sdk-shared';

export type VariableGroupProps = {
  category: StyleVariableCategory;
  variables?: StyleVariableGroup;
  onUpdate?: (name: string, values: Omit<TStyleVariable, 'name'>) => void;
  onRemove?: (category: StyleVariableCategory, name: string) => void;
};

const VariableGroup = ({ category, variables, onUpdate, onRemove }: VariableGroupProps) => {
  return (
    <ContainerCollapsable collapsed>
      <ContainerCollapsable.Header
        className="h-6 text-sm"
        title={
          <span className="flex w-full items-center justify-between font-bold">
            {category}
            <span className="text-xs font-normal text-gray-500">({Object.keys(variables ?? {}).length})</span>
          </span>
        }
        placement="right"
        iconCollapsed={<Icon icon="fa-solid fa-angle-down" />}
        iconExpanded={<Icon icon="fa-solid fa-angle-up" />}
      />
      <ContainerCollapsable.Content className="flex flex-col gap-3 py-2">
        {Object.keys(variables ?? {}).map((variable, i) => (
          <StyleVariable
            key={`${category}-${i}`}
            category={category}
            name={variable}
            value={variables?.[variable]}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        ))}
      </ContainerCollapsable.Content>
    </ContainerCollapsable>
  );
};

export default VariableGroup;
