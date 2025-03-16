// Packages
import React, { useCallback, useMemo, useRef } from 'react';
import noop from 'lodash/noop';
import Dropdown from '@plitzi/plitzi-ui-components/Dropdown';

// Alias
import InspectorButton from '@pmodules/Style/components/InspectorButton';

// Relatives
import GroupButtons from '../../../../components/GroupButtons';

/**
 * @param {{
 *   value: string;
 *   onRemove?: () => void;
 *   onChange?: (value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const TransformItem = props => {
  const { value = 'translate3d(0px, 0px, 0px)', onRemove = noop, onChange = noop } = props;
  const valueParts = value.match(/[a-x0-9-.%]+/gim);
  let { type = 'translate3d', posX = '0px', posY = '0px', posZ = '0px' } = {};
  if (valueParts.length === 6) {
    [, posX, type, posY, , posZ] = valueParts;
  } else if (valueParts.length === 4) {
    [type, posX, posY, posZ] = valueParts;
  } else if (valueParts.length === 3) {
    [type, posX, posY] = valueParts;
  }

  const valueRef = useRef(value);
  valueRef.current = { type, posX, posY, posZ };

  const handleChange = useCallback(
    itemValue => {
      const { type: inputType, value } = itemValue;
      const valueAux = { ...valueRef.current };
      valueAux[inputType] = value;
      const { type } = valueAux;
      let { posX, posY, posZ } = valueAux;
      if (inputType === 'type' && valueRef.current.type !== value) {
        if (value === 'rotate' || value === 'skew') {
          ({ posX, posY, posZ } = { posX: '0deg', posY: '0deg', posZ: '0deg' });
        } else if (value === 'scale3d') {
          ({ posX, posY, posZ } = { posX: '1', posY: '1', posZ: '1' });
        } else {
          ({ posX, posY, posZ } = { posX: '0px', posY: '0px', posZ: '0px' });
        }
      }

      if (type === 'rotate') {
        onChange(`${type}X(${posX}) ${type}Y(${posY}) ${type}Z(${posZ})`);
      } else if (type === 'skew') {
        onChange(`${type}(${posX}, ${posY})`);
      } else {
        onChange(`${type}(${posX}, ${posY}, ${posZ})`);
      }
    },
    [onChange]
  );

  const itemsType = useMemo(
    () => [
      {
        value: { value: 'translate3d', type: 'type' },
        children: <div className="text-xs select-none px-1">Move</div>,
        description: '',
        active: type === 'translate3d'
      },
      {
        value: { value: 'scale3d', type: 'type' },
        children: <div className="text-xs select-none px-1">Scale</div>,
        description: '',
        active: type === 'scale3d'
      },
      {
        value: { value: 'rotate', type: 'type' },
        children: <div className="text-xs select-none px-1">Rotate</div>,
        description: '',
        active: type === 'rotate'
      },
      {
        value: { value: 'skew', type: 'type' },
        children: <div className="text-xs select-none px-1">Skew</div>,
        description: '',
        active: type === 'skew'
      }
    ],
    [type]
  );

  const fieldSpecs = useMemo(() => {
    if (type === 'rotate' || type === 'skew') {
      return {
        type: 'inputMetric',
        inputProps: { emptyValue: '0deg', defaultMetric: 'deg', typeMetric: 'unit' }
      };
    }

    if (type === 'scale3d') {
      return {
        type: 'inputMetric',
        inputProps: { emptyValue: '0', defaultMetric: '', typeMetric: 'number' }
      };
    }

    return {
      type: 'inputMetric',
      inputProps: { emptyValue: '0px', defaultMetric: 'px', typeMetric: 'unit' }
    };
  }, [type]);

  const itemsPosition = useMemo(
    () => [
      { value: posX, extraValue: { type: 'posX' }, label: 'X', ...fieldSpecs },
      { value: posY, extraValue: { type: 'posY' }, label: 'Y', ...fieldSpecs },
      { value: posZ, extraValue: { type: 'posZ' }, label: 'Z', isVisible: type !== 'skew', ...fieldSpecs }
    ],
    [value, fieldSpecs]
  );

  return (
    <Dropdown
      showIcon={false}
      className="w-full border bg-white rounded-sm border-gray-300 [&:not(:first-child)]:mt-2 hover:bg-gray-100"
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
        <div className="flex flex-col gap-2 p-2">
          <GroupButtons
            className="w-full"
            classNameContainer="w-[200px]"
            items={itemsType}
            label="Type"
            onChange={handleChange}
          />
          <GroupButtons
            className="w-full"
            classNameContainer="w-[200px]"
            items={itemsPosition}
            label="Position"
            onChange={handleChange}
          />
        </div>
      </Dropdown.Container>
    </Dropdown>
  );
};

export default TransformItem;
