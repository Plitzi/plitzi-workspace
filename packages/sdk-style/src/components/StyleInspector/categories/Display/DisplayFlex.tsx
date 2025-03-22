import ArrowReverse from '@plitzi/plitzi-ui/icons/ArrowReverse';
import { useCallback, useMemo } from 'react';

import { FLEX_WRAP } from '@plitzi/sdk-shared/style';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const keyValues: StyleCategory[] = [FLEX_WRAP];

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
          onChange?.(FLEX_WRAP, `${value as string}-reverse`);
        } else {
          onChange?.(FLEX_WRAP, (value as string).replace('-reverse', ''));
        }
      } else {
        onChange?.(FLEX_WRAP, newValue as StyleValue);
      }
    },
    [onChange, value]
  );

  const items = useMemo(
    () => [
      {
        value: isReverse ? 'nowrap-reverse' : 'nowrap',
        icon: <div className="text-xs whitespace-nowrap select-none px-1">Don&apos;t Wrap</div>,
        description: '',
        active: value === 'nowrap' || value === 'nowrap-reverse',
        size: 'custom' as const
      },
      {
        value: isReverse ? 'wrap-reverse' : 'wrap',
        icon: <div className="text-xs select-none px-1">Wrap</div>,
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
