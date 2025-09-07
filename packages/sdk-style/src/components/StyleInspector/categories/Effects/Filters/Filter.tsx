import Icon from '@plitzi/plitzi-ui/Icon';
import { useCallback } from 'react';

import FilterItem from './FilterItem';
import InspectorLabel from '../../../components/InspectorLabel';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type FilterProps = {
  value?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const Filter = ({ value, onChange }: FilterProps) => {
  let filters: string[] = [];
  if (value && value !== '') {
    filters = (value as string).split(' ');
  }

  const handleClickRemoveItem = (index: number) => (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    filters.splice(index, 1);
    if (filters.length > 0) {
      onChange?.(filters.join(' '));
    } else {
      onChange?.('');
    }
  };

  const handleChangeItem = (index: number) => (filterItemValue: string) => {
    if (filterItemValue !== filters[index]) {
      filters[index] = filterItemValue;
      onChange?.(filters.join(' '));
    }
  };

  const handleClickAddItem = useCallback(() => {
    if (value) {
      onChange?.(`${value} blur(5px)`);
    } else {
      onChange?.('blur(5px)');
    }
  }, [value, onChange]);

  return (
    <>
      <div className="flex w-full justify-between">
        <InspectorLabel keyValue={['filter']}>Filters</InspectorLabel>
        <Icon className="cursor-pointer" icon="fas fa-plus" onClick={handleClickAddItem} />
      </div>
      {filters.length > 0 && (
        <div className="flex flex-col">
          {filters.map((filter, index) => (
            <FilterItem
              key={index}
              value={filter}
              onChange={handleChangeItem(index)}
              onRemove={handleClickRemoveItem(index)}
            />
          ))}
        </div>
      )}
    </>
  );
};

export default Filter;
