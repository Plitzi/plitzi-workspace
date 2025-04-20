import ContainerFloating from '@plitzi/plitzi-ui/ContainerFloating';
import Icon from '@plitzi/plitzi-ui/Icon';
import { useCallback, useRef } from 'react'; //  useCallback, useMemo,

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type TypographyTextShadowItemProps = {
  value?: string;
  onChange?: (value: string) => void;
  onRemove?: (e: MouseEvent) => void;
};

const TypographyTextShadowItem = ({ value = '', onRemove, onChange }: TypographyTextShadowItemProps) => {
  const [posX = '2px', posY = '2px', blur = '0px', color = 'black'] = value.split(' ');
  const valueRef = useRef<{ posX: string; posY: string; blur: string; color: string }>({ posX, posY, blur, color });
  valueRef.current = { posX, posY, blur, color };

  const handleChange = useCallback(
    (type: 'posX' | 'posY' | 'blur' | 'color') => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
      const valueAux = { ...valueRef.current };
      valueAux[type] = value as string;
      const { posX, posY, blur, color } = valueAux;
      onChange?.(`${posX} ${posY} ${blur} ${color}`);
    },
    [onChange]
  );

  return (
    <ContainerFloating className="w-full" closeOnClick={false}>
      <ContainerFloating.Trigger className="py-0.5 px-2 flex justify-between items-center border border-gray-300 cursor-pointer hover:bg-gray-100 rounded-sm w-full select-none">
        <div className="flex items-center">
          <div className="h-5 w-5 mr-1 rounded-sm" style={{ backgroundColor: color }} />
          <div>{value}</div>
        </div>
        <div className="flex">
          <Icon size="xs" icon="fas fa-trash-alt" onClick={onRemove} intent="danger" title="Remove" />
        </div>
      </ContainerFloating.Trigger>
      <ContainerFloating.Content className="w-[260px]">
        <div className="p-2 flex flex-col w-full gap-2">
          <CategorySection>
            <CategoryOption
              className="min-w-0"
              label="Pos X"
              value={posX}
              onChange={handleChange('posX')}
              type="metric"
            />
            <CategoryOption label="Pos Y" value={posY} onChange={handleChange('posY')} type="metric" />
            <CategoryOption label="Blur" value={blur} onChange={handleChange('blur')} type="metric" />
          </CategorySection>
          <CategorySection>
            <CategoryOption label="Color" value={color} onChange={handleChange('color')} type="color" />
          </CategorySection>
        </div>
      </ContainerFloating.Content>
    </ContainerFloating>
  );
};

export default TypographyTextShadowItem;
