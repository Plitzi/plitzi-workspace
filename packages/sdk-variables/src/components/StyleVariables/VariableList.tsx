import { StyleVariableCategory } from '@plitzi/sdk-shared';

import VariableGroup from './VariableGroup';

import type { TStyleVariable } from './StyleVariables';
import type { StyleVariables } from '@plitzi/sdk-shared';

export type VariableListProps = {
  variables?: Partial<StyleVariables>;
  onUpdate?: (name: string, values: Omit<TStyleVariable, 'name'>) => void;
  onRemove?: (category: StyleVariableCategory, name: string) => void;
};

const VariableList = ({ variables, onUpdate, onRemove }: VariableListProps) => {
  if (!variables) {
    return undefined;
  }

  return (
    <div className="flex flex-col">
      {Object.values(StyleVariableCategory).map(category => (
        <VariableGroup
          key={category}
          category={category}
          variables={variables[category]}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
};

export default VariableList;
