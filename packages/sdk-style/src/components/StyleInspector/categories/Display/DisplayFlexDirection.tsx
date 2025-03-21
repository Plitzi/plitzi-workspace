import ArrowReverse from '@plitzi/plitzi-ui/icons/ArrowReverse';
import { useCallback, useMemo } from 'react';

import { FLEX_DIRECTION } from '@plitzi/sdk-shared/style';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type DisplayFlexDirectionProps = {
  value?: StyleValue;
  isReverse: boolean;
  onChange?: (type: string, value: StyleValue) => void;
};

const keyValues: StyleCategory[] = [FLEX_DIRECTION];

const DisplayFlexDirection = ({ value = 'row', isReverse = false, onChange }: DisplayFlexDirectionProps) => {
  const handleChange = useCallback(
    (newValue: StyleValue | boolean) => {
      if (typeof newValue === 'boolean') {
        if (newValue) {
          onChange?.(FLEX_DIRECTION, `${value as string}-reverse`);
        } else {
          onChange?.(FLEX_DIRECTION, (value as string).replace('-reverse', ''));
        }
      } else {
        onChange?.(FLEX_DIRECTION, newValue as string);
      }
    },
    [onChange, value]
  );

  const items = useMemo(
    () => [
      {
        value: isReverse ? 'row-reverse' : 'row',
        icon: <div className="text-xs select-none px-1">Horizontal</div>,
        description: '',
        active: value === 'row' || value === 'row-reverse',
        size: 'custom' as const
      },
      {
        value: isReverse ? 'column-reverse' : 'column',
        icon: <div className="text-xs select-none px-1">Vertical</div>,
        description: '',
        active: value === 'column' || value === 'column-reverse',
        size: 'custom' as const
      },
      {
        value: !isReverse,
        icon: <ArrowReverse />,
        description: 'Reverse Direction',
        active: isReverse
      }
    ],
    [value, isReverse]
  );

  return (
    <CategorySection keys={keyValues} label="Direction">
      <CategoryOption onChange={handleChange} type="iconGroup" items={items} />
    </CategorySection>
  );
};

export default DisplayFlexDirection;
