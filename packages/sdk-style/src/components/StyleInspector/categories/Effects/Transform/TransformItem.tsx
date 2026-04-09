import ContainerFloating from '@plitzi/plitzi-ui/ContainerFloating';
import Icon from '@plitzi/plitzi-ui/Icon';
import { useCallback, useMemo, useRef } from 'react';

import CategoryOption from '../../../components/CategoryOption';
import CategorySection from '../../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type TransformItemProps = {
  value?: string;
  onChange?: (value: string) => void;
  onRemove?: (e: MouseEvent) => void;
};

const TransformItem = ({ value = 'translate3d(0px, 0px, 0px)', onRemove, onChange }: TransformItemProps) => {
  const valueParts = value.match(/[a-x0-9-.%]+/gim);
  let { type = 'translate3d', posX = '0px', posY = '0px', posZ = '0px' } = {};
  if (valueParts?.length === 6) {
    [, posX, type, posY, , posZ] = valueParts;
  } else if (valueParts?.length === 4) {
    [type, posX, posY, posZ] = valueParts;
  } else if (valueParts?.length === 3) {
    [type, posX, posY] = valueParts;
  }

  const valueRef = useRef({ type, posX, posY, posZ });
  valueRef.current = { type, posX, posY, posZ };

  const handleChange = useCallback(
    (inputType: 'type' | 'posX' | 'posY' | 'posZ') =>
      (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
        const valueAux = { ...valueRef.current };
        valueAux[inputType] = itemValue as string;
        const { type } = valueAux;
        let { posX, posY, posZ } = valueAux;
        if (inputType === 'type' && valueRef.current.type !== itemValue) {
          if (itemValue === 'rotate' || itemValue === 'skew') {
            ({ posX, posY, posZ } = { posX: '0deg', posY: '0deg', posZ: '0deg' });
          } else if (itemValue === 'scale3d') {
            ({ posX, posY, posZ } = { posX: '1', posY: '1', posZ: '1' });
          } else {
            ({ posX, posY, posZ } = { posX: '0px', posY: '0px', posZ: '0px' });
          }
        }

        if (type === 'rotate') {
          onChange?.(`${type}X(${posX}) ${type}Y(${posY}) ${type}Z(${posZ})`);
        } else if (type === 'skew') {
          onChange?.(`${type}(${posX}, ${posY})`);
        } else {
          onChange?.(`${type}(${posX}, ${posY}, ${posZ})`);
        }
      },
    [onChange]
  );

  const itemsType = useMemo(
    () => [
      {
        value: 'translate3d',
        icon: <div className="px-1 text-xs select-none">Move</div>,
        description: '',
        active: type === 'translate3d',
        size: 'custom' as const
      },
      {
        value: 'scale3d',
        icon: <div className="px-1 text-xs select-none">Scale</div>,
        description: '',
        active: type === 'scale3d',
        size: 'custom' as const
      },
      {
        value: 'rotate',
        icon: <div className="px-1 text-xs select-none">Rotate</div>,
        description: '',
        active: type === 'rotate',
        size: 'custom' as const
      },
      {
        value: 'skew',
        icon: <div className="px-1 text-xs select-none">Skew</div>,
        description: '',
        active: type === 'skew',
        size: 'custom' as const
      }
    ],
    [type]
  );

  const fieldSpecs = useMemo(() => {
    if (type === 'rotate' || type === 'skew') {
      return { units: [{ label: 'DEG', value: 'deg' }] };
    }

    if (type === 'scale3d') {
      return { units: undefined };
    }

    return { units: [{ label: 'PX', value: 'px' }] };
  }, [type]);

  return (
    <ContainerFloating className="w-full" closeOnClick={false}>
      <ContainerFloating.Trigger className="flex w-full cursor-pointer items-center justify-between rounded-sm border border-gray-300 bg-white px-2 py-0.5 select-none hover:bg-gray-100 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700/60">
        <div className="flex items-center">{value}</div>
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
            <CategoryOption label="X" value={posX} onChange={handleChange('posX')} type="metric" {...fieldSpecs} />
            <CategoryOption label="Y" value={posX} onChange={handleChange('posY')} type="metric" {...fieldSpecs} />
            {type !== 'skew' && (
              <CategoryOption label="Z" value={posX} onChange={handleChange('posZ')} type="metric" {...fieldSpecs} />
            )}
          </CategorySection>
        </div>
      </ContainerFloating.Content>
    </ContainerFloating>
  );
};

export default TransformItem;
