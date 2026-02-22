import { useMemo } from 'react';

import VariablesListItem from './VariablesListItem';

import type { StyleVariables, StyleVariableValue } from '@plitzi/sdk-shared';

export type VariablesListProps = { variables?: Partial<StyleVariables> };

const VariablesStyleList = ({ variables }: VariablesListProps) => {
  const variablesParsed = useMemo(
    () =>
      Object.keys(variables ?? {}).reduce<{ name: string; type: string; value: string | StyleVariableValue }[]>(
        (acum, categoryKey) => {
          const category = variables?.[categoryKey as keyof StyleVariables];
          if (category) {
            Object.keys(category).forEach(varKey => {
              acum.push({
                name: varKey,
                type: categoryKey === 'color' ? 'color' : 'text',
                value: category[varKey]
              });
            });
          }

          return acum;
        },
        []
      ),
    [variables]
  );

  return (
    <div className="flex w-full flex-col border border-gray-300">
      {variablesParsed.map((variable, i) => (
        <VariablesListItem key={i} name={variable.name} type={variable.type} value={variable.value} />
      ))}
    </div>
  );
};

export default VariablesStyleList;
