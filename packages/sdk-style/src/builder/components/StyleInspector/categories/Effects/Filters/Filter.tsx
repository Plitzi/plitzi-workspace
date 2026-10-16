import { useCallback } from 'react';

import FilterItem from './FilterItem';
import { FILTER_SPECS, serializeFilter } from './helpers';
import ValueList from '../../../components/ValueList';
import { splitBySpaceOutsideParens } from '../../../cssValues';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type FilterProps = {
  styleKey?: StyleCategory;
  label?: string;
  value?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const Filter = ({ styleKey = 'filter', label = 'Filters', value, onChange }: FilterProps) => {
  // Split outside parentheses: `drop-shadow(0 2px 4px black)` is one function, not four.
  const filters = typeof value === 'string' && value !== '' ? splitBySpaceOutsideParens(value) : [];
  const itemTitle = styleKey === 'backdrop-filter' ? 'Backdrop filter' : 'Filter';

  const emit = useCallback((next: string[]) => onChange?.(next.length > 0 ? next.join(' ') : ''), [onChange]);

  const handleRemoveItem = (index: number) => () => emit(filters.filter((_, i) => i !== index));

  const handleChangeItem = (index: number) => (item: string) => {
    if (item !== filters[index]) {
      emit(filters.map((filter, i) => (i === index ? item : filter)));
    }
  };

  const handleAdd = () => emit([...filters, serializeFilter({ name: 'blur', amount: FILTER_SPECS.blur.default })]);

  return (
    <ValueList label={label} keys={[styleKey]} addLabel={`Add ${itemTitle.toLowerCase()}`} onAdd={handleAdd}>
      {filters.length > 0 &&
        filters.map((filter, index) => (
          <FilterItem
            key={index}
            value={filter}
            title={itemTitle}
            onChange={handleChangeItem(index)}
            onRemove={handleRemoveItem(index)}
          />
        ))}
    </ValueList>
  );
};

export default Filter;
