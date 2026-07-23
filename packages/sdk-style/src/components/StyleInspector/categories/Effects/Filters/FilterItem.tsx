import ContainerFloating from '@plitzi/plitzi-ui/ContainerFloating';
import Icon from '@plitzi/plitzi-ui/Icon';
import { useCallback, useMemo, useRef } from 'react';

import CategoryOption from '../../../components/CategoryOption';
import CategorySection from '../../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type FilterItemProps = {
  value?: string;
  onChange?: (value: string) => void;
  onRemove?: (e: MouseEvent) => void;
};

const FilterItem = ({ value = 'blur(5px)', onRemove, onChange }: FilterItemProps) => {
  const valueParts = value.match(/[a-z-]+|[0-9.-]+(px|%|deg|)/gim);
  let { propType = 'blur', amount = '5px' } = {};
  if (valueParts?.length === 2) {
    [propType, amount] = valueParts;
  }

  const valueRef = useRef({ propType, amount });
  valueRef.current = { propType, amount };

  const handleChange = useCallback(
    (type: 'propType' | 'amount') => (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
      const valueAux = { ...valueRef.current };
      valueAux[type] = itemValue as string;
      const { propType } = valueAux;
      let { amount } = valueAux;
      if (type === 'propType' && valueRef.current.amount !== itemValue) {
        if (itemValue === 'blur') {
          amount = '5px';
        } else if (itemValue === 'hue-rotate') {
          amount = '0deg';
        } else {
          amount = '0.5';
        }
      }

      onChange?.(`${propType}(${amount})`);
    },
    [onChange]
  );

  const fieldSpecs = useMemo(() => {
    if (propType === 'hue-rotate') {
      return { units: [{ label: 'DEG', value: 'deg' }] };
    }

    if (propType === 'blur') {
      return { units: [{ label: 'PX', value: 'px' }] };
    }

    return { units: undefined, max: 1, step: 0.1 };
  }, [propType]);

  return (
    <ContainerFloating className="w-full" closeOnClick={false} containerTopOffset={5}>
      <ContainerFloating.Trigger className="flex w-full cursor-pointer items-center justify-between rounded-sm border border-gray-300 bg-white px-2 py-0.5 select-none hover:bg-gray-100 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700/60">
        <div className="flex items-center">
          <div className="flex">{value}</div>
        </div>
        <div className="flex">
          <Icon size="xs" icon="fas fa-trash-alt" onClick={onRemove} intent="danger" title="Remove" />
        </div>
      </ContainerFloating.Trigger>
      <ContainerFloating.Content className="w-[260px]">
        <div className="flex w-full flex-col gap-2 p-2">
          <CategorySection label="Type">
            <CategoryOption label="Property" onChange={handleChange('propType')} type="select" value={propType}>
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
            </CategoryOption>
            <CategoryOption
              label="Amount"
              value={amount}
              onChange={handleChange('amount')}
              type="metric"
              units={fieldSpecs.units}
              step={fieldSpecs.step}
              max={fieldSpecs.max}
            />
          </CategorySection>
        </div>
      </ContainerFloating.Content>
    </ContainerFloating>
  );
};

export default FilterItem;
