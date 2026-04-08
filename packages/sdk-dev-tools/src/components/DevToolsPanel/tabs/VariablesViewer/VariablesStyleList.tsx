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
              acum.push({ name: varKey, type: categoryKey === 'color' ? 'color' : 'text', value: category[varKey] });
            });
          }

          return acum;
        },
        []
      ),
    [variables]
  );

  if (variablesParsed.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-zinc-400 italic dark:text-zinc-600">No style variables defined</div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded border border-zinc-200 dark:border-zinc-700">
      <div className="grid grid-cols-[1fr_1.5fr] border-b border-zinc-200 bg-zinc-50 px-3 py-1 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
        <span className="text-[10px] font-semibold tracking-wider uppercase">Name</span>
        <span className="text-[10px] font-semibold tracking-wider uppercase">Value</span>
      </div>
      {variablesParsed.map((variable, i) => (
        <VariablesListItem key={i} name={variable.name} type={variable.type} value={variable.value} />
      ))}
    </div>
  );
};

export default VariablesStyleList;
