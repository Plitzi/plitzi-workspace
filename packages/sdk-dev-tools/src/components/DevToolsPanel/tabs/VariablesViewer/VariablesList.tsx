import VariablesListItem from './VariablesListItem';

import type { SchemaVariable } from '@plitzi/sdk-shared';

export type VariablesListProps = { variables?: SchemaVariable[]; variablesParsed?: Record<string, string> };

const VariablesList = ({ variables, variablesParsed }: VariablesListProps) => (
  <div className="flex w-full flex-col border border-gray-300">
    {(variables ?? []).map((variable, i) => (
      <VariablesListItem key={i} name={variable.name} type={variable.type} value={variablesParsed?.[variable.name]} />
    ))}
  </div>
);

export default VariablesList;
