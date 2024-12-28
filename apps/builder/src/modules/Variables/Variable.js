// Packages
import React, { useCallback, useState } from 'react';
import noop from 'lodash/noop';
import omit from 'lodash/omit';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import VariableForm from './models/VariableForm';
import VariableDetails from './VariableDetails';
import VariableValue from './VariableValue';
import VariableActions from './VariableActions';

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
  const [selected, setSelected] = useState(false);

  const handleClickRemove = useCallback(
    e => {
      e.stopPropagation();
      onRemove(name);
    },
    [onRemove, name]
  );

  const handleClickUpdate = useCallback(
    e => {
      e.stopPropagation();
      setEditMode(true);
    },
    [onChange, name]
  );

  const handleClickCancel = useCallback(() => setEditMode(false), [setEditMode]);

  const handleClickSubmit = useCallback(
    values => {
      onChange(name, omit(values, ['name']));
      setEditMode(false);
    },
    [onChange, name, setEditMode]
  );

  const handleClick = useCallback(() => setSelected(state => !state), []);

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
    <div className="group flex flex-col border px-2 py-0.5 gap-1 border-gray-300 rounded text-sm">
      <div className="flex w-full items-center gap-2 cursor-pointer" onClick={handleClick}>
        <div className="flex w-full overflow-hidden">
          {subValues?.length > 0 && <i className="fa-solid fa-code-merge text-sm px-1" title="Has Variations" />}
          <div className="flex basis-0 gap-2 min-w-0 grow justify-between">
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

export default Variable;
