// Relatives
import VariablesListItem from './VariablesListItem';

// Types
import type { SchemaVariable } from '@plitzi/sdk-shared';

export type VariablesListProps = { variables?: SchemaVariable[]; variablesParsed?: Record<string, string> };

const VariablesList = ({ variables, variablesParsed }: VariablesListProps) => (
  <div className="flex flex-col w-full">
    {(variables ?? []).map((variable, i) => (
      <VariablesListItem key={i} name={variable.name} type={variable.type} value={variablesParsed?.[variable.name]} />
    ))}
  </div>
);

export default VariablesList;
