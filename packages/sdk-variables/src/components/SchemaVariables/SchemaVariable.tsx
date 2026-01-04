import omit from 'lodash-es/omit';
import { useCallback, useState } from 'react';

import VariableActions from './VariableActions';
import VariableDetails from './VariableDetails';
import VariableValue from './VariableValue';
import SchemaVariableForm from '../../models/SchemaVariableForm';

import type { Environment, QueryParams, RouteParams, SchemaVariable as TSchemaVariable } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type SchemaVariableProps = {
  name?: string;
  category?: string;
  value?: string;
  type?: TSchemaVariable['type'];
  subValues?: TSchemaVariable['subValues'];
  whenData?: {
    routeParams: RouteParams;
    queryParams: QueryParams;
    hostname?: string;
    environment: Environment;
  };
  onChange?: (name: string, value: Omit<TSchemaVariable, 'name'>) => void;
  onRemove: (name: string) => void;
  onParentRefresh?: (identifier: string, segment: object) => void;
};

const SchemaVariable = ({
  name = 'variable',
  value = '',
  type = 'text',
  category = '',
  subValues,
  whenData,
  onChange,
  onRemove
}: SchemaVariableProps) => {
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState(false);

  const handleClickRemove = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onRemove(name);
    },
    [onRemove, name]
  );

  const handleClickUpdate = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    setEditMode(true);
  }, []);

  const handleClickCancel = useCallback(() => setEditMode(false), [setEditMode]);

  const handleClickSubmit = useCallback(
    (values: TSchemaVariable) => {
      onChange?.(name, omit(values, ['name']));
      setEditMode(false);
    },
    [onChange, name, setEditMode]
  );

  const handleClick = useCallback(() => setSelected(state => !state), []);

  if (editMode) {
    return (
      <div className="rounded-sm border border-gray-300 p-2">
        <SchemaVariableForm
          name={name}
          category={category}
          type={type}
          value={value}
          subValues={subValues}
          whenData={whenData}
          onSubmit={handleClickSubmit}
          onClose={handleClickCancel}
        />
      </div>
    );
  }

  return (
    <div className="group flex flex-col gap-1 rounded-sm border border-gray-300 px-2 py-0.5 text-sm">
      <div className="flex w-full cursor-pointer items-center gap-2" onClick={handleClick}>
        <div className="flex w-full overflow-hidden">
          {subValues && subValues.length > 0 && (
            <i className="fa-solid fa-code-merge px-1 text-sm" title="Has Variations" />
          )}
          <div className="flex min-w-0 grow basis-0 justify-between gap-2">
            <div className="font-bold" title={name}>
              {name}
            </div>
            <VariableValue className="truncate text-xs" type={type} value={value} />
          </div>
        </div>
        <VariableActions selected={selected} onUpdate={handleClickUpdate} onRemove={handleClickRemove} />
      </div>
      {selected && <VariableDetails name={name} type={type} subValues={subValues} />}
    </div>
  );
};

export default SchemaVariable;
