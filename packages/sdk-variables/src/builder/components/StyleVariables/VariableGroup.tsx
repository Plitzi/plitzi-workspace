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

const VariableGroup = ({ category, variables = {}, onUpdate, onRemove }: VariableGroupProps) => {
  const variablesCount = Object.keys(variables).length;

  return (
    <ContainerCollapsable collapsed>
      <ContainerCollapsable.Header
        className="h-7 px-1"
        title={
          <span className="flex w-full items-center justify-between gap-1 text-xs font-medium text-zinc-700 capitalize dark:text-zinc-200">
            {category}
            <span className="text-[11px] font-normal text-zinc-500 tabular-nums dark:text-zinc-400">
              {variablesCount}
            </span>
          </span>
        }
        placement="right"
        iconCollapsed={<Icon icon="fa-solid fa-angle-down" />}
        iconExpanded={<Icon icon="fa-solid fa-angle-up" />}
      />
      {variablesCount > 0 && (
        <ContainerCollapsable.Content className="flex flex-col gap-1 py-1">
          {Object.keys(variables).map((variable, i) => (
            <StyleVariable
              key={`${category}-${i}`}
              category={category}
              name={variable}
              value={variables[variable]}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          ))}
        </ContainerCollapsable.Content>
      )}
    </ContainerCollapsable>
  );
};

export default VariableGroup;
