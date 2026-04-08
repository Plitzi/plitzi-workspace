import clsx from 'clsx';

import VariablesListItem from './VariablesListItem';
import { useDevToolsTheme } from '../../../../DevToolsThemeContext';

import type { SchemaVariable } from '@plitzi/sdk-shared';

export type VariablesListProps = { variables?: SchemaVariable[]; variablesParsed?: Record<string, string> };

const VariablesList = ({ variables, variablesParsed }: VariablesListProps) => {
  const { isDark } = useDevToolsTheme();

  if (!variables || variables.length === 0) {
    return (
      <div className={clsx('py-4 text-center text-xs italic', isDark ? 'text-zinc-600' : 'text-zinc-400')}>
        No variables defined
      </div>
    );
  }

  return (
    <div className={clsx('w-full overflow-hidden rounded border', isDark ? 'border-zinc-700' : 'border-zinc-200')}>
      {/* Column headers */}
      <div
        className={clsx(
          'grid grid-cols-[1fr_1.5fr] border-b px-3 py-1',
          isDark ? 'border-zinc-700 bg-zinc-800 text-zinc-500' : 'border-zinc-200 bg-zinc-50 text-zinc-400'
        )}
      >
        <span className="text-[10px] font-semibold tracking-wider uppercase">Name</span>
        <span className="text-[10px] font-semibold tracking-wider uppercase">Value</span>
      </div>
      {variables.map((variable, i) => (
        <VariablesListItem key={i} name={variable.name} type={variable.type} value={variablesParsed?.[variable.name]} />
      ))}
    </div>
  );
};

export default VariablesList;
