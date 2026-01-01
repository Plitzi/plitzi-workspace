import VariableGroup from './VariableGroup';

import type { StyleVariables } from '@plitzi/sdk-shared';

export type VariableListProps = { variables?: StyleVariables };

const VariableList = ({ variables }: VariableListProps) => {
  if (!variables) {
    return undefined;
  }

  return (
    <div className="flex flex-col gap-1">
      {Object.keys(variables).map(category => (
        <VariableGroup key={category} title={category} variables={variables[category as keyof typeof variables]} />
      ))}
    </div>
  );
};

export default VariableList;
