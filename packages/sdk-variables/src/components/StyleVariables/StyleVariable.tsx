import omit from 'lodash-es/omit';
import { useCallback, useState } from 'react';

import VariableActions from './VariableActions';
import VariableDetails from './VariableDetails';
import VariableValue from './VariableValue';
import { StyleVariableForm } from '../../models';

import type { TStyleVariable } from './StyleVariables';
import type { StyleVariableCategory, StyleVariableValue } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type StyleVariableProps = {
  category: StyleVariableCategory;
  name: string;
  value?: StyleVariableValue;
  onUpdate?: (name: string, values: Omit<TStyleVariable, 'name'>) => void;
  onRemove?: (category: StyleVariableCategory, name: string) => void;
};

const StyleVariable = ({ category, name, value, onUpdate, onRemove }: StyleVariableProps) => {
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState(false);

  const handleClickUpdate = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    setEditMode(true);
  }, []);

  const handleClickRemove = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onRemove?.(category, name);
    },
    [onRemove, category, name]
  );

  const handleClick = useCallback(() => setSelected(state => !state), []);

  const handleClickCancel = useCallback(() => setEditMode(false), [setEditMode]);

  const handleClickSubmit = useCallback(
    (values: TStyleVariable) => {
      onUpdate?.(name, omit(values, ['name']));
      setEditMode(false);
    },
    [onUpdate, name, setEditMode]
  );

  if (editMode) {
    return (
      <div className="rounded-sm border border-gray-300 p-2">
        <StyleVariableForm
          name={name}
          category={category}
          value={value}
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
          <div className="flex min-w-0 grow basis-0 justify-between gap-2">
            <div className="font-bold" title={name}>
              {name}
            </div>
            <VariableValue className="truncate text-xs" type={category === 'color' ? 'color' : 'text'} value={value} />
          </div>
        </div>
        <VariableActions selected={selected} onUpdate={handleClickUpdate} onRemove={handleClickRemove} />
      </div>
      {selected && <VariableDetails name={name} />}
    </div>
  );
};

export default StyleVariable;
