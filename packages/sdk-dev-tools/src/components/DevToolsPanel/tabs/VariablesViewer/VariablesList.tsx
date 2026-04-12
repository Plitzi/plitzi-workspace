import VariablesListItem from './VariablesListItem';

import type { SchemaVariable } from '@plitzi/sdk-shared';

export type VariablesListProps = { variables?: SchemaVariable[]; variablesParsed?: Record<string, string> };

const VariablesList = ({ variables, variablesParsed }: VariablesListProps) => {
  if (!variables || variables.length === 0) {
    return <div className="py-4 text-center text-xs text-zinc-400 italic dark:text-zinc-600">No variables defined</div>;
  }

  return (
    <div className="w-full overflow-hidden rounded border border-zinc-200 dark:border-zinc-700">
      {/* Column headers */}
      <div className="grid grid-cols-[1fr_1.5fr] border-b border-zinc-200 bg-zinc-50 px-3 py-1 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
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
