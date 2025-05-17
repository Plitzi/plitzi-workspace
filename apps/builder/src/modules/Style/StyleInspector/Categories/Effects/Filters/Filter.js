// Packages
import React, { useCallback } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { FILTER } from '@plitzi/sdk-shared/style/StyleConstants';

// Alias
import InspectorButton from '@pmodules/Style/components/InspectorButton';

// Relatives
import FilterItem from './FilterItem';
import InspectorLabel from '../../../InspectorLabel';

/**
 * @param {{
 *   value: string;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Filter = props => {
  const { onChange = noop } = props;
  let { value } = props;
  if (value && value !== '') {
    value = value.split(' ');
  } else {
    value = [];
  }

  const handleClickRemoveItem = index => e => {
    e.stopPropagation();
    e.preventDefault();
    value.splice(index, 1);
    if (value.length > 0) {
      onChange({ type: FILTER, value: value.join(' ') });
    } else {
      onChange({ type: FILTER, value: undefined });
    }
  };

  const handleChangeItem = index => filterItemValue => {
    if (filterItemValue !== value[index]) {
      value[index] = filterItemValue;
      onChange({ type: FILTER, value: value.join(' ') });
    }
  };

  const handleClickAddItem = useCallback(() => {
    if (value && value.length > 0) {
      onChange({ type: FILTER, value: `${value.join(' ')} blur(5px)` });
    } else {
      onChange({ type: FILTER, value: 'blur(5px)' });
    }
  }, [value, onChange]);

  return (
    <>
      <div className="w-full flex justify-between">
        <InspectorLabel keyValue={FILTER}>Filters</InspectorLabel>
        <InspectorButton onClick={handleClickAddItem}>
          <i className="fas fa-plus" />
        </InspectorButton>
      </div>
      {value && value.length > 0 && (
        <div className="flex flex-col">
          {value.map((filter, index) => (
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
