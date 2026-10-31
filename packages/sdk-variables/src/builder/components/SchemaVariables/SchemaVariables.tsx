import clsx from 'clsx';
import { useCallback } from 'react';

import SchemaVariable from './SchemaVariable';
import SchemaVariableForm from '../../models/SchemaVariableForm';

import type { Environment, QueryParams, RouteParams, SchemaVariable as TSchemaVariable } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type SchemaVariablesProps = {
  className?: string;
  variables?: TSchemaVariable[];
  whenData?: {
    routeParams: RouteParams;
    queryParams: QueryParams;
    hostname?: string;
    environment: Environment;
  };
  /** A new variable's form is open: said by whoever holds the action that adds one — the builder's panel toolbar. */
  adding?: boolean;
  /** The new variable's form closed — added, or let go. */
  onAddingEnd?: () => void;
  /** What shows while there are none — the builder's empty state. */
  empty?: ReactNode;
  onAdd?: (variable: TSchemaVariable) => void;
  onUpdate?: (variable: TSchemaVariable) => void;
  onRemove?: (name: string) => void;
};

/** What a new space variable's form starts from. */
const NEW_VARIABLE: TSchemaVariable = { name: 'variable', type: 'text', category: '', value: '', subValues: [] };

const SchemaVariables = ({
  className,
  variables,
  whenData,
  adding = false,
  onAddingEnd,
  empty,
  onAdd,
  onUpdate,
  onRemove
}: SchemaVariablesProps) => {
  const handleClickAddVariable = useCallback(
    (values: TSchemaVariable) => {
      onAdd?.(values);
      onAddingEnd?.();
    },
    [onAdd, onAddingEnd]
  );

  const handleUpdate = useCallback(
    (name: string, values: Omit<TSchemaVariable, 'name'>) => onUpdate?.({ ...values, name } as TSchemaVariable),
    [onUpdate]
  );

  const handleClickRemove = useCallback((name: string) => onRemove?.(name), [onRemove]);

  const handleClickCancel = useCallback(() => onAddingEnd?.(), [onAddingEnd]);

  return (
    <div className={clsx('flex w-full flex-col gap-3', className)}>
      {adding && (
        <SchemaVariableForm
          {...NEW_VARIABLE}
          isNewRecord
          onSubmit={handleClickAddVariable}
          onClose={handleClickCancel}
        />
      )}
      {!adding && (variables ?? []).length === 0 && empty}
      <div className="flex min-h-0 grow basis-0 flex-col gap-1 overflow-y-auto">
        {variables?.map(segment => {
          const { name, type, value, category, subValues } = segment;

          return (
            <SchemaVariable
              key={name}
              name={name}
              category={category}
              type={type}
              value={String(value)}
              subValues={subValues}
              whenData={whenData}
              onChange={handleUpdate}
              onRemove={handleClickRemove}
            />
          );
        })}
      </div>
    </div>
  );
};

export default SchemaVariables;
