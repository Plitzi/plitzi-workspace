import VariablesListItem from './VariablesListItem';

import type { SchemaVariable } from '@plitzi/sdk-shared';

export type VariablesListProps = { variables?: SchemaVariable[]; variablesParsed?: Record<string, string> };

const VariablesList = ({ variables, variablesParsed }: VariablesListProps) => {
  if (!variables || variables.length === 0) {
    return <div className="text-ui-fg-subtle py-4 text-center text-xs italic">No variables defined</div>;
  }

  return (
    <div className="border-ui-line w-full overflow-hidden rounded border">
      <div className="border-ui-line bg-ui-raised text-ui-fg-subtle grid grid-cols-[1fr_1.5fr] border-b px-3 py-1">
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
