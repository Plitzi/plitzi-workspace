// Packages
import React, { useCallback, useState } from 'react';
import noop from 'lodash/noop';
import omit from 'lodash/omit';
import Button from '@plitzi/plitzi-ui-components/Button';
import QueryBuilderFormatter from '@plitzi/plitzi-ui-components/QueryBuilder/helpers/QueryBuilderFormatter';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import VariableForm from './models/VariableForm';

const subValuesDefault = [];

/**
 * @param {{
 *   name?: string;
 *   category?: string;
 *   value?: string;
 *   type?: string;
 *   subValues?: [{ value: string; when: object }];
 *   whenData?: object;
 *   onChange?: (name: string, value: string) => void;
 *   onRemove: (name: string) => void;
 *   onParentRefresh?: (identifier: string, segment: object) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Variable = props => {
  const {
    name = 'variable',
    value = '',
    type = 'text',
    category = '',
    subValues = subValuesDefault,
    whenData = emptyObject,
    onChange = noop,
    onRemove = noop
  } = props;
  const [editMode, setEditMode] = useState(false);
  const hasSubValues = subValues && subValues?.length > 0;

  const handleClickRemove = useCallback(() => {
    onRemove(name);
  }, [onRemove, name]);

  const handleClickUpdate = useCallback(() => {
    setEditMode(true);
  }, [onChange, name]);

  const handleClickSubmit = useCallback(
    values => {
      onChange(name, omit(values, ['name']));
      setEditMode(false);
    },
    [onChange, name, setEditMode]
  );

  const handleClickCancel = useCallback(() => setEditMode(false), [setEditMode]);

  if (editMode) {
    return (
      <div className="border border-gray-300 rounded p-2">
        <VariableForm
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
    <div className="group flex items-center gap-1 border p-1 border-gray-300 rounded">
      <div className="flex flex-col w-full">
        <div className="flex basis-0 grow">
          <div className="flex flex-col gap-1 min-w-0 grow">
            <div className="flex grow basis-0 min-w-0 gap-1 items-center text-sm bold" title={name}>
              <div className="font-bold whitespace-nowrap">Name:</div>
              <div className="truncate">{`{{${name}}}`}</div>
            </div>
            <div className="flex grow basis-0 min-w-0 text-sm gap-1" title={value}>
              <div className="font-bold whitespace-nowrap">{hasSubValues ? 'Fallback Value:' : 'Value:'}</div>
              <div className="truncate">{value}</div>
            </div>
          </div>
          <div className="flex flex-col group-hover:visible invisible">
            <Button
              intent="custom"
              size="custom"
              onClick={handleClickUpdate}
              title="Update"
              className="px-1 py-1 hover:text-blue-400 text-xs"
            >
              <i className="fas fa-pen" />
            </Button>
            <Button
              intent="custom"
              size="custom"
              onClick={handleClickRemove}
              title="Remove"
              className="text-red-400 hover:text-red-500 px-1 py-1 text-xs"
            >
              <i className="fas fa-trash-alt" />
            </Button>
          </div>
        </div>
        {hasSubValues && (
          <div className="flex flex-col w-full mt-2 gap-1">
            <div className="font-bold text-sm">Conditional Values:</div>
            {subValues.map((subValue, index) => (
              <div key={index} className="flex flex-col gap-1 text-xs border border-gray-300 rounded w-full">
                <div className="flex gap-1 px-1">
                  <div className="font-bold">Value:</div>
                  <div>{subValue.value}</div>
                </div>
                <div className="flex gap-1 px-1 border-t border-gray-300">
                  <div className="font-bold">When:</div>
                  {QueryBuilderFormatter(subValue.when)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Variable;
