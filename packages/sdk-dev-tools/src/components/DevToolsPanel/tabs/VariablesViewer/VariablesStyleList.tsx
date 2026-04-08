import clsx from 'clsx';
import { useMemo } from 'react';

import VariablesListItem from './VariablesListItem';
import { useDevToolsTheme } from '../../../../DevToolsThemeContext';

import type { StyleVariables, StyleVariableValue } from '@plitzi/sdk-shared';

export type VariablesListProps = { variables?: Partial<StyleVariables> };

const VariablesStyleList = ({ variables }: VariablesListProps) => {
  const { isDark } = useDevToolsTheme();

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
      <div className={clsx('py-4 text-center text-xs italic', isDark ? 'text-zinc-600' : 'text-zinc-400')}>
        No style variables defined
      </div>
    );
  }

  return (
    <div className={clsx('w-full overflow-hidden rounded border', isDark ? 'border-zinc-700' : 'border-zinc-200')}>
      <div
        className={clsx(
          'grid grid-cols-[1fr_1.5fr] border-b px-3 py-1',
          isDark ? 'border-zinc-700 bg-zinc-800 text-zinc-500' : 'border-zinc-200 bg-zinc-50 text-zinc-400'
        )}
      >
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
