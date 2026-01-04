import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';
import { useCallback, useState } from 'react';

import SchemaVariable from './SchemaVariable';
import SchemaVariableForm from '../../models/SchemaVariableForm';

import type { schemaVariableFormSchema } from '../../models/SchemaVariableForm';
import type { Environment, QueryParams, RouteParams, SchemaVariable as TSchemaVariable } from '@plitzi/sdk-shared';
import type { z } from 'zod';

export type SchemaVariablesProps = {
  className?: string;
  variables?: TSchemaVariable[];
  whenData?: {
    routeParams: RouteParams;
    queryParams: QueryParams;
    hostname?: string;
    environment: Environment;
  };
  onAdd?: (variable: TSchemaVariable) => void;
  onUpdate?: (variable: TSchemaVariable) => void;
  onRemove?: (name: string) => void;
};

const SchemaVariables = ({ className, variables, whenData, onAdd, onUpdate, onRemove }: SchemaVariablesProps) => {
  const [newVariable, setNewVariable] = useState<TSchemaVariable>();

  const handleClickAddVariable = useCallback(
    (values: z.infer<typeof schemaVariableFormSchema>) => {
      onAdd?.(values as TSchemaVariable);
      setNewVariable(undefined);
    },
    [onAdd]
  );

  const handleUpdate = useCallback(
    (name: string, values: Omit<TSchemaVariable, 'name'>) => onUpdate?.({ ...values, name }),
    [onUpdate]
  );

  const handleClickRemove = useCallback((name: string) => onRemove?.(name), [onRemove]);

  const handleClickAddNewVariable = useCallback(() => {
    setNewVariable({ name: 'variable', type: 'text', category: '', value: '', subValues: [] });
  }, []);

  const handleClickCancel = useCallback(() => setNewVariable(undefined), []);

  return (
    <div className={clsx('flex w-full flex-col gap-3', className)}>
      <div className="flex min-h-0 grow basis-0 flex-col gap-1 overflow-y-auto">
        {variables?.map(segment => {
          const { name, type, value, category, subValues } = segment;

          return (
            <SchemaVariable
              key={name}
              name={name}
              category={category}
              type={type}
              value={value}
              subValues={subValues}
              whenData={whenData}
              onChange={handleUpdate}
              onRemove={handleClickRemove}
            />
          );
        })}
      </div>
      {!newVariable && (
        <div className="flex w-full px-1">
          <Button className="w-full" size="xs" onClick={handleClickAddNewVariable} iconPlacement="before">
            <Button.Icon icon="fa-solid fa-plus" />
            Add Space Variable
          </Button>
        </div>
      )}
      {newVariable && (
        <SchemaVariableForm
          {...newVariable}
          isNewRecord
          onSubmit={handleClickAddVariable}
          onClose={handleClickCancel}
        />
      )}
    </div>
  );
};

export default SchemaVariables;
