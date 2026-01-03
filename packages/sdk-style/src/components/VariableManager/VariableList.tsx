import VariableGroup from './VariableGroup';

import type { StyleVariableCategory, StyleVariables } from '@plitzi/sdk-shared';

export type VariableListProps = { variables?: Partial<StyleVariables> };

const VariableList = ({ variables }: VariableListProps) => {
  if (!variables) {
    return undefined;
  }

  return (
    <div className="flex flex-col gap-1">
      {(['color', 'spacing', 'shadow'] as StyleVariableCategory[]).map(category => (
        <VariableGroup key={category} title={category} variables={variables[category]} />
      ))}
    </div>
  );
};

export default VariableList;
