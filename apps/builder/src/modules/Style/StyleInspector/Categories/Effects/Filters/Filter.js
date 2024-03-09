// Packages
import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Alias
import InspectorButton from '@pmodules/Style/components/InspectorButton';
import { FILTER } from '@pmodules/Style/StyleConstants';

// Relatives
import FilterItem from './FilterItem';
import InspectorLabel from '../../../InspectorLabel';

const Filter = props => {
  const { onChange = noop } = props;
  let { partialValue } = props;
  if (partialValue && partialValue !== '') {
    partialValue = partialValue.split(' ');
  } else {
    partialValue = [];
  }

  const handleClickRemoveItem = index => e => {
    e.stopPropagation();
    e.preventDefault();
    partialValue.splice(index, 1);
    if (partialValue.length > 0) {
      onChange({ type: FILTER, value: partialValue.join(' ') });
    } else {
      onChange({ type: FILTER, value: undefined });
    }
  };

  const handleChangeItem = index => filterItemValue => {
    if (filterItemValue !== partialValue[index]) {
      partialValue[index] = filterItemValue;
      onChange({ type: FILTER, value: partialValue.join(' ') });
    }
  };

  const handleClickAddItem = useCallback(() => {
    if (partialValue && partialValue.length > 0) {
      onChange({ type: FILTER, value: `${partialValue.join(' ')} blur(5px)` });
    } else {
      onChange({ type: FILTER, value: 'blur(5px)' });
    }
  }, [partialValue, onChange]);

  return (
    <>
      <div className="w-full flex justify-between">
        <InspectorLabel keyValue={FILTER}>Filters</InspectorLabel>
        <InspectorButton onClick={handleClickAddItem}>
          <i className="fas fa-plus" />
        </InspectorButton>
      </div>
      {partialValue && partialValue.length > 0 && (
        <div className="flex flex-col">
          {partialValue.map((filter, index) => (
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

Filter.propTypes = {
  partialValue: PropTypes.string,
  onChange: PropTypes.func
};

export default Filter;
