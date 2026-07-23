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
        icon: <div className="px-1 text-xs select-none">Outside</div>,
        description: '',
        active: type === '',
        size: 'custom' as const
      },
      {
        value: 'inset',
        icon: <div className="px-1 text-xs select-none">Inside</div>,
        description: '',
        active: type === 'inset',
        size: 'custom' as const
      }
    ],
    [type]
  );

  return (
    <ContainerFloating className="w-full" closeOnClick={false} containerTopOffset={5}>
      <ContainerFloating.Trigger className="flex w-full cursor-pointer items-center justify-between rounded-sm border border-gray-300 bg-white px-2 py-0.5 select-none hover:bg-gray-100 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700/60">
        <div className="flex items-center">
          <div className="mr-1 h-5 w-5 rounded-sm" style={{ backgroundColor: color }} />
          <div className="flex">{value}</div>
        </div>
        <div className="flex">
          <Icon size="xs" icon="fas fa-trash-alt" onClick={onRemove} intent="danger" title="Remove" />
        </div>
      </ContainerFloating.Trigger>
      <ContainerFloating.Content className="w-[260px]">
        <div className="flex w-full flex-col gap-2 p-2">
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
