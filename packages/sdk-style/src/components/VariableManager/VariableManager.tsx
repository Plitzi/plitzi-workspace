import Button from '@plitzi/plitzi-ui/Button';
import { useCallback, useState } from 'react';

import VariableForm from './VariableForm';
import VariableList from './VariableList';

import type { StyleVariableCategory, StyleVariables, StyleThemeValue } from '@plitzi/sdk-shared';

export type VariableManagerProps = {
  variables?: StyleVariables;
  onChange?: () => void;
};

const VariableManager = ({ variables = { color: {}, spacing: {}, shadow: {} } }: VariableManagerProps) => {
  const [newVariable, setNewVariable] = useState<{
    name: string;
    category: StyleVariableCategory;
    values: StyleThemeValue;
  }>();

  const handleClickAddVariable = useCallback(() => {
    setNewVariable({ name: '', category: 'color', values: { light: '', dark: '', default: '' } });
  }, []);

  const handleClickCancel = useCallback(() => setNewVariable(undefined), []);

  return (
    <div className="flex flex-col gap-2">
      <VariableList variables={variables} />
      {!newVariable && (
        <Button className="w-full" size="xs" onClick={handleClickAddVariable} iconPlacement="before">
          <Button.Icon icon="fa-solid fa-plus" />
          Add Variable
        </Button>
      )}
      {newVariable && <VariableForm {...newVariable} onClose={handleClickCancel} />}
    </div>
  );
};

export default VariableManager;
