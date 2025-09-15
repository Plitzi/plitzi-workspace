import XMark from '@plitzi/plitzi-ui/icons/XMark';
import { useCallback, useMemo } from 'react';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type DisplayOrderProps = {
  value?: StyleValue;
  onChange?: (type: StyleCategory, value: StyleValue) => void;
};

const keyValues: StyleCategory[] = ['order'];

const DisplayOrder = ({ value, onChange }: DisplayOrderProps) => {
  const handleChange = useCallback(
    (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.('order', itemValue as StyleValue),
    [onChange]
  );

  const items = useMemo(
    () => [
      {
        value: '0',
        icon: <XMark />,
        description: 'Order Auto',
        active: value === '0'
      },
      {
        value: '-1',
        icon: <div className="text-xs select-none">First</div>,
        description: 'Order First',
        active: value === '-1',
        size: 'custom' as const
      },
      {
        value: '1',
        icon: <div className="text-xs select-none">Last</div>,
        description: 'Order Last',
        active: value === '1',
        size: 'custom' as const
      }
      // { type: 'input', value, extraValue: { type: ORDER } }
    ],
    [value]
  );

  // return (
  //   <GroupButtons classNameContainer="w-[180px]" items={items} label="Order" keyValue={ORDER} onChange={handleChange} />
  // );

  return (
    <CategorySection label="Align" keys={keyValues}>
      <CategoryOption onChange={handleChange} type="iconGroup" items={items} />
      <CategoryOption onChange={handleChange} type="input" value={value} />
    </CategorySection>
  );
};

export default DisplayOrder;
