import { useMemo } from 'react';

import VariablesListItem from './VariablesListItem';

import type { StyleVariables, StyleVariableValue } from '@plitzi/sdk-shared';

export type VariablesListProps = { variables?: Partial<StyleVariables> };

const VariablesStyleList = ({ variables }: VariablesListProps) => {
  const variablesParsed = useMemo(
    () =>
      Object.entries(variables ?? {}).reduce<{ name: string; type: string; value: string | StyleVariableValue }[]>(
        (acum, [categoryKey, category]) => {
          Object.keys(category).forEach(varKey => {
            acum.push({ name: varKey, type: categoryKey === 'color' ? 'color' : 'text', value: category[varKey] });
          });

          return acum;
        },
        []
      ),
    [variables]
  );

  if (variablesParsed.length === 0) {
    return <div className="text-ui-fg-subtle py-4 text-center text-xs italic">No style variables defined</div>;
  }

  return (
    <div className="border-ui-line w-full overflow-hidden rounded border">
      <div className="border-ui-line bg-ui-raised text-ui-fg-subtle grid grid-cols-[1fr_1.5fr] border-b px-3 py-1">
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
