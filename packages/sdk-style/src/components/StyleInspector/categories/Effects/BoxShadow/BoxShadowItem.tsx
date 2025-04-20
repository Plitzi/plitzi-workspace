import ContainerFloating from '@plitzi/plitzi-ui/ContainerFloating';
import Icon from '@plitzi/plitzi-ui/Icon';
import { useCallback, useMemo, useRef } from 'react';

import CategoryOption from '../../../components/CategoryOption';
import CategorySection from '../../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type BoxShadowItemProps = {
  value?: string;
  onChange?: (value: string) => void;
  onRemove?: (e: MouseEvent) => void;
};

const BoxShadowItem = ({ value = '1px 1px 3px 1px black', onChange, onRemove }: BoxShadowItemProps) => {
  const valueParts = value.split(/ (?![^(]*\))/gim);
  let { type = '', posX = '1px', posY = '1px', blur = '3px', size = '1px', color = 'black' } = {};
  if (valueParts.length === 6) {
    [type, posX, posY, blur, size, color] = valueParts;
  } else if (valueParts.length === 5) {
    type = '';
    [posX, posY, blur, size, color] = valueParts;
  }

  const valueRef = useRef({ type, posX, posY, blur, size, color });
  valueRef.current = { type, posX, posY, blur, size, color };

  const handleChange = useCallback(
    (inputType: 'type' | 'posX' | 'posY' | 'blur' | 'size' | 'color') =>
      (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
        const valueAux = { ...valueRef.current };
        valueAux[inputType] = itemValue as string;
        const { type, posX, posY, blur, size, color } = valueAux;
        if (type) {
          onChange?.(`${type} ${posX} ${posY} ${blur} ${size} ${color}`);
        } else {
          onChange?.(`${posX} ${posY} ${blur} ${size} ${color}`);
        }
      },
    [onChange]
  );

  const itemsType = useMemo(
    () => [
      {
        value: '',
        icon: <div className="text-xs select-none px-1">Outside</div>,
        description: '',
        active: type === '',
        size: 'custom' as const
      },
      {
        value: 'inset',
        icon: <div className="text-xs select-none px-1">Inside</div>,
        description: '',
        active: type === 'inset',
        size: 'custom' as const
      }
    ],
    [type]
  );

  return (
    <ContainerFloating className="w-full" closeOnClick={false}>
      <ContainerFloating.Trigger className="py-0.5 px-2 flex justify-between items-center border border-gray-300 cursor-pointer hover:bg-gray-100 rounded-sm w-full select-none">
        <div className="flex items-center">
          <div className="h-5 w-5 mr-1 rounded-sm" style={{ backgroundColor: color }} />
          <div className="flex">{value}</div>
        </div>
        <div className="flex">
          <Icon size="xs" icon="fas fa-trash-alt" onClick={onRemove} intent="danger" title="Remove" />
        </div>
      </ContainerFloating.Trigger>
      <ContainerFloating.Content className="w-[260px]">
        <div className="p-2 flex flex-col w-full gap-2">
          <CategorySection label="Type">
            <CategoryOption onChange={handleChange('type')} type="iconGroup" items={itemsType} />
          </CategorySection>
          <CategorySection label="Position">
            <CategoryOption label="Pos X" value={posX} onChange={handleChange('posX')} type="metric" />
            <CategoryOption label="Pos Y" value={posY} onChange={handleChange('posY')} type="metric" />
          </CategorySection>
          <CategorySection label="Style">
            <CategoryOption label="Blur" value={blur} onChange={handleChange('blur')} type="metric" />
            <CategoryOption label="Size" value={size} onChange={handleChange('size')} type="metric" />
          </CategorySection>
          <CategorySection label="Color">
            <CategoryOption value={color} onChange={handleChange('color')} type="color" />
          </CategorySection>
        </div>
      </ContainerFloating.Content>
    </ContainerFloating>
  );
};

export default BoxShadowItem;
