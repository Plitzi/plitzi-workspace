import ArrowReverse from '@plitzi/plitzi-ui/icons/ArrowReverse';
import { useCallback, useMemo } from 'react';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const keyValues: StyleCategory[] = ['flex-wrap'];

export type DisplayFlexProps = {
  value?: StyleValue;
  isReverse: boolean;
  onChange?: (type: StyleCategory, value: StyleValue) => void;
};

const DisplayFlex = ({ value, isReverse = false, onChange }: DisplayFlexProps) => {
  const handleChange = useCallback(
    (newValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
      if (typeof newValue === 'boolean') {
        if (newValue) {
          onChange?.('flex-wrap', `${value as string}-reverse`);
        } else {
          onChange?.('flex-wrap', (value as string).replace('-reverse', ''));
        }
      } else {
        onChange?.('flex-wrap', newValue as StyleValue);
      }
    },
    [onChange, value]
  );

  const items = useMemo(
    () => [
      {
        value: isReverse ? 'nowrap-reverse' : 'nowrap',
        icon: <div className="px-1 text-xs whitespace-nowrap select-none">Don&apos;t Wrap</div>,
        description: '',
        active: value === 'nowrap' || value === 'nowrap-reverse',
        size: 'custom' as const
      },
      {
        value: isReverse ? 'wrap-reverse' : 'wrap',
        icon: <div className="px-1 text-xs select-none">Wrap</div>,
        description: '',
        active: value === 'wrap' || value === 'wrap-reverse',
        size: 'custom' as const
      },
      {
        value: !isReverse,
        icon: <ArrowReverse />,
        description: 'Reverse Wrap',
        active: isReverse
      }
    ],
    [value, isReverse]
  );

  return (
    <CategorySection label="Children" keys={keyValues}>
      <CategoryOption onChange={handleChange} type="iconGroup" items={items} />
    </CategorySection>
  );
};

export default DisplayFlex;
