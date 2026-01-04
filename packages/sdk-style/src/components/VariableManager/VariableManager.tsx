import Button from '@plitzi/plitzi-ui/Button';
import { use, useCallback, useState } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
// import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';

import VariableForm from './VariableForm';
import VariableList from './VariableList';

import type { variableFormSchema } from './VariableForm';
import type { StyleVariableCategory, StyleVariables, StyleThemeValue, DisplayMode } from '@plitzi/sdk-shared';
import type { z } from 'zod';

export type VariableManagerProps = {
  displayMode: DisplayMode;
  selector?: string;
  variables?: Partial<StyleVariables>;
  onChange?: () => void;
  onAdd?: () => void;
  onRemove?: (category: StyleVariableCategory, name: string) => void;
};

const VariableManager = ({
  displayMode,
  selector,
  variables = { color: {}, spacing: {}, shadow: {} }
}: VariableManagerProps) => {
  const { builderHandler } = use(BuilderContext);
  const [newVariable, setNewVariable] = useState<{
    name: string;
    category: StyleVariableCategory;
    values: StyleThemeValue;
  }>();

  const handleClickAddVariable = useCallback(() => {
    setNewVariable({ name: '', category: 'color', values: { light: '', dark: '', default: '' } });
  }, []);

  const handleClickSubmit = useCallback(
    (formValues: z.infer<typeof variableFormSchema>) => {
      if (!selector) {
        return;
      }

      const { name, category, values } = formValues;
      builderHandler('styleAddSelectorVariable', displayMode, selector, category, name, values);
      setNewVariable(undefined);
    },
    [builderHandler, displayMode, selector]
  );

  const handleClickCancel = useCallback(() => setNewVariable(undefined), []);

  return (
    <div className="flex flex-col gap-2">
      <VariableList variables={variables} />
      {!newVariable && (
        <div className="flex w-full px-1">
          <Button className="w-full" size="xs" onClick={handleClickAddVariable} iconPlacement="before">
            <Button.Icon icon="fa-solid fa-plus" />
            Add Variable
          </Button>
        </div>
      )}
      {newVariable && <VariableForm {...newVariable} onSubmit={handleClickSubmit} onClose={handleClickCancel} />}
    </div>
  );
};

export default VariableManager;
