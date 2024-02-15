// Packages
import React, { useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import Dropdown from '@plitzi/plitzi-ui-components/Dropdown';

// Alias
import InspectorButton from '@pmodules/Style/components/InspectorButton';

// Relatives
import GroupButtons from '../../../../components/GroupButtons';

const FilterItem = props => {
  const { value = 'blur(5px)', onRemove = noop, onChange = noop } = props;
  const valueParts = value.match(/[a-z-]+|[0-9.-]+(px|%|deg|)/gim);
  let { propType = 'blur', amount = '5px' } = {};
  if (valueParts.length === 2) {
    [propType, amount] = valueParts;
  }

  const valueRef = useRef(value);
  valueRef.current = { propType, amount };

  const handleChange = useCallback(
    itemValue => {
      const { type, value } = itemValue;
      const valueAux = { ...valueRef.current };
      valueAux[type] = value;
      const { propType } = valueAux;
      let { amount } = valueAux;
      if (type === 'propType' && valueRef.current.type !== value) {
        if (value === 'blur') {
          amount = '5px';
        } else if (value === 'hue-rotate') {
          amount = '0deg';
        } else {
          amount = '0.5';
        }
      }

      onChange(`${propType}(${amount})`);
    },
    [onChange]
  );

  const fieldSpecs = useMemo(() => {
    if (propType === 'hue-rotate') {
      return {
        type: 'inputMetric',
        inputProps: { emptyValue: '0deg', defaultMetric: 'deg', typeMetric: 'unit' }
      };
    }

    if (propType === 'blur') {
      return {
        type: 'inputMetric',
        inputProps: { emptyValue: '0px', defaultMetric: 'px', typeMetric: 'unit' }
      };
    }

    return {
      type: 'inputMetric',
      inputProps: { emptyValue: '0', defaultMetric: '', typeMetric: 'number', minValue: 0, maxValue: 1 }
    };
  }, [propType]);

  const items = useMemo(
    () => [
      {
        type: 'select',
        value: propType,
        extraValue: { type: 'propType' },
        label: 'Property',
        children: (
          <>
            <optgroup label="General">
              <option value="blur">Blur</option>
            </optgroup>
            <optgroup label="Color Adjustments">
              <option value="brightness">Brightness</option>
              <option value="contrast">Contrast</option>
              <option value="hue-rotate">Hue Rotate</option>
              <option value="saturate">Saturation</option>
            </optgroup>
            <optgroup label="Color Effects">
              <option value="grayscale">Grayscale</option>
              <option value="invert">Invert</option>
              <option value="sepia">Sepia</option>
            </optgroup>
          </>
        )
      },
      { value: amount, extraValue: { type: 'amount' }, label: 'Amount', ...fieldSpecs }
    ],
    [value, fieldSpecs]
  );

  return (
    <Dropdown
      showIcon={false}
      className="w-full border bg-white rounded border-gray-300 not-first:mt-2 hover:bg-gray-100"
      backgroundDisabled
      closeOnClick={false}
    >
      <Dropdown.Content className="w-full px-2 py-1 flex justify-between">
        <div className="flex items-center">{value}</div>
        <div className="flex">
          <InspectorButton onClick={onRemove} intent="danger" title="Remove">
            <i className="fas fa-trash-alt" />
          </InspectorButton>
        </div>
      </Dropdown.Content>
      <Dropdown.Container className="w-[260px]">
        <div className="p-2">
          <GroupButtons
            className="w-full"
            classNameContainer="w-[180px]"
            items={items}
            label="Type"
            onChange={handleChange}
          />
        </div>
      </Dropdown.Container>
    </Dropdown>
  );
};

FilterItem.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  onRemove: PropTypes.func
};

export default FilterItem;
