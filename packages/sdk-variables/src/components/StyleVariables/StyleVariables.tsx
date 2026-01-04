import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';
import { useCallback, useState } from 'react';

import VariableList from './VariableList';
import StyleVariableForm from '../../models/StyleVariableForm';

import type { styleVariableFormSchema } from '../../models/StyleVariableForm';
import type { StyleVariableCategory, StyleVariables as TStyleVariables, StyleVariableValue } from '@plitzi/sdk-shared';
import type { z } from 'zod';

export type TStyleVariable = { name: string; category: StyleVariableCategory; value: StyleVariableValue };

export type StyleVariablesProps = {
  className?: string;
  variables?: Partial<TStyleVariables>;
  onAdd?: (variable: TStyleVariable) => void;
  onUpdate?: (variable: TStyleVariable) => void;
  onRemove?: (category: StyleVariableCategory, name: string) => void;
};

const StyleVariables = ({
  className,
  variables = { color: {}, spacing: {}, shadow: {} },
  onAdd,
  onUpdate,
  onRemove
}: StyleVariablesProps) => {
  const [newVariable, setNewVariable] = useState<TStyleVariable>();

  const handleClickAddVariable = useCallback(
    (values: z.infer<typeof styleVariableFormSchema>) => {
      onAdd?.(values);
      setNewVariable(undefined);
    },
    [onAdd]
  );

  const handleUpdate = useCallback(
    (name: string, values: Omit<TStyleVariable, 'name'>) => onUpdate?.({ ...values, name }),
    [onUpdate]
  );

  const handleClickRemove = useCallback(
    (category: StyleVariableCategory, name: string) => onRemove?.(category, name),
    [onRemove]
  );

  const handleClickAddNewVariable = useCallback(() => {
    setNewVariable({ name: '', category: 'color', value: { light: '', dark: '', default: '' } });
  }, []);

  const handleClickCancel = useCallback(() => setNewVariable(undefined), []);

  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      <VariableList variables={variables} onUpdate={handleUpdate} onRemove={handleClickRemove} />
      {!newVariable && (
        <div className="flex w-full px-1">
          <Button className="w-full" size="xs" onClick={handleClickAddNewVariable} iconPlacement="before">
            <Button.Icon icon="fa-solid fa-plus" />
            Add Style Variable
          </Button>
        </div>
      )}
      {newVariable && (
        <StyleVariableForm {...newVariable} isNewRecord onSubmit={handleClickAddVariable} onClose={handleClickCancel} />
      )}
    </div>
  );
};

export default StyleVariables;
