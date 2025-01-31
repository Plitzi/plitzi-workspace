// Packages
import React, { useCallback, useMemo, useRef } from 'react';
import noop from 'lodash/noop';
import Dropdown from '@plitzi/plitzi-ui-components/Dropdown';

// ALias
import InspectorButton from '@pmodules/Style/components/InspectorButton';

// Relatives
import GroupButtons from '../../../../components/GroupButtons';

/**
 * @param {{
 *   value: string;
 *   onChange?: (value: string) => void;
 *   onRemove?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const BoxShadowItem = props => {
  const { value = '1px 1px 3px 1px black', onChange = noop, onRemove = noop } = props;
  const valueParts = value.split(/ (?![^(]*\))/gim);
  let { type = '', posX = '1px', posY = '1px', blur = '3px', size = '1px', color = 'black' } = {};
  if (valueParts.length === 6) {
    [type, posX, posY, blur, size, color] = valueParts;
  } else if (valueParts.length === 5) {
    type = '';
    [posX, posY, blur, size, color] = valueParts;
  }

  const valueRef = useRef(value);
  valueRef.current = { type, posX, posY, blur, size, color };

  const handleChange = useCallback(
    itemValue => {
      const { type: inputType, value } = itemValue;
      const valueAux = { ...valueRef.current };
      valueAux[inputType] = value;
      const { type, posX, posY, blur, size, color } = valueAux;
      if (type) {
        onChange(`${type} ${posX} ${posY} ${blur} ${size} ${color}`);
      } else {
        onChange(`${posX} ${posY} ${blur} ${size} ${color}`);
      }
    },
    [onChange]
  );

  const itemsType = useMemo(
    () => [
      {
        value: { value: '', type: 'type' },
        children: <div className="text-xs select-none px-1">Outside</div>,
        description: '',
        active: type === ''
      },
      {
        value: { value: 'inset', type: 'type' },
        children: <div className="text-xs select-none px-1">Inside</div>,
        description: '',
        active: type === 'inset'
      }
    ],
    [type]
  );

  const itemsPosition = useMemo(
    () => [
      { type: 'inputMetric', value: posX, extraValue: { type: 'posX' }, label: 'Pos X' },
      { type: 'inputMetric', value: posY, extraValue: { type: 'posY' }, label: 'Pos Y' }
    ],
    [value]
  );

  const itemsStyle = useMemo(
    () => [
      { type: 'inputMetric', value: blur, extraValue: { type: 'blur' }, label: 'Blur' },
      { type: 'inputMetric', value: size, extraValue: { type: 'size' }, label: 'Size' }
    ],
    [value]
  );

  const itemsColor = useMemo(() => [{ type: 'color', value: color, extraValue: { type: 'color' } }], [value]);

  return (
    <Dropdown
      showIcon={false}
      className="w-full border bg-white rounded-sm border-gray-300 [&:not(:first-child)]:mt-2 hover:bg-gray-100"
      backgroundDisabled
      closeOnClick={false}
    >
      <Dropdown.Content className="w-full px-2 py-1 flex justify-between">
        <div className="flex items-center">
          <div className="h-5 w-5 mr-1 rounded-sm" style={{ backgroundColor: color }} />
          <div className="flex">{value}</div>
        </div>
        <div className="flex">
          <InspectorButton onClick={onRemove} intent="danger" title="Remove">
            <i className="fas fa-trash-alt" />
          </InspectorButton>
        </div>
      </Dropdown.Content>
      <Dropdown.Container className="w-[260px]">
        <div className="p-2 flex flex-col gap-2">
          <GroupButtons
            className="w-full"
            classNameContainer="w-[180px]"
            items={itemsType}
            label="Type"
            onChange={handleChange}
          />
          <GroupButtons
            className="w-full"
            classNameContainer="w-[180px]"
            items={itemsPosition}
            label="Position"
            onChange={handleChange}
          />
          <GroupButtons
            className="w-full"
            classNameContainer="w-[180px]"
            items={itemsStyle}
            label="Style"
            onChange={handleChange}
          />
          <GroupButtons
            className="w-full"
            classNameContainer="w-[180px]"
            items={itemsColor}
            label="Color"
            onChange={handleChange}
          />
        </div>
      </Dropdown.Container>
    </Dropdown>
  );
};

export default BoxShadowItem;
