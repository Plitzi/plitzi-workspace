import clsx from 'clsx';
import { useCallback } from 'react';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import VariableList from './VariableList';
import StyleVariableForm from '../../models/StyleVariableForm';

import type { styleVariableFormSchema } from '../../models/StyleVariableForm';
import type { StyleVariables as TStyleVariables, StyleVariableValue } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';
import type { z } from 'zod';

export type TStyleVariable = { name: string; category: StyleVariableCategory; value: StyleVariableValue };

export type StyleVariablesProps = {
  className?: string;
  variables?: Partial<TStyleVariables>;
  /** A new variable's form is open: said by whoever holds the action that adds one — the builder's panel toolbar. */
  adding?: boolean;
  /** The new variable's form closed — added, or let go. */
  onAddingEnd?: () => void;
  /** What shows while there are none — the builder's empty state. */
  empty?: ReactNode;
  onAdd?: (variable: TStyleVariable) => void;
  onUpdate?: (variable: TStyleVariable) => void;
  onRemove?: (category: StyleVariableCategory, name: string) => void;
};

/** What a new style variable's form starts from: a colour, written for both themes. */
const NEW_VARIABLE: TStyleVariable = {
  name: '',
  category: StyleVariableCategory.COLOR,
  value: { light: '', dark: '', default: '' }
};

const StyleVariables = ({
  className,
  variables = { color: {}, spacing: {}, shadow: {} },
  adding = false,
  onAddingEnd,
  empty,
  onAdd,
  onUpdate,
  onRemove
}: StyleVariablesProps) => {
  const handleClickAddVariable = useCallback(
    (values: z.infer<typeof styleVariableFormSchema>) => {
      onAdd?.(values);
      onAddingEnd?.();
    },
    [onAdd, onAddingEnd]
  );

  const handleUpdate = useCallback(
    (name: string, values: Omit<TStyleVariable, 'name'>) => onUpdate?.({ ...values, name }),
    [onUpdate]
  );

  const handleClickRemove = useCallback(
    (category: StyleVariableCategory, name: string) => onRemove?.(category, name),
    [onRemove]
  );

  const handleClickCancel = useCallback(() => onAddingEnd?.(), [onAddingEnd]);
  const none = Object.values(variables).every(group => Object.keys(group).length === 0);

  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      {adding && (
        <StyleVariableForm
          {...NEW_VARIABLE}
          isNewRecord
          onSubmit={handleClickAddVariable}
          onClose={handleClickCancel}
        />
      )}
      {!adding && none && empty}
      <VariableList variables={variables} onUpdate={handleUpdate} onRemove={handleClickRemove} />
    </div>
  );
};

export default StyleVariables;
