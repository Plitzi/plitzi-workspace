import FloatLeft from '@plitzi/plitzi-ui/icons/FloatLeft';
import FloatRight from '@plitzi/plitzi-ui/icons/FloatRight';
import XMark from '@plitzi/plitzi-ui/icons/XMark';
import { useMemo } from 'react';

import { FLOAT, LEFT, RIGHT } from '@plitzi/sdk-shared/style/styleConstants';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type PositionFloatProps = {
  value?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const PositionFloat = ({ value, onChange }: PositionFloatProps) => {
  const items = useMemo(
    () => [
      {
        value: 'none',
        icon: <XMark />,
        description: 'Static',
        active: value === 'none'
      },
      {
        value: LEFT,
        icon: <FloatLeft />,
        description: 'Float Left',
        active: value === LEFT
      },
      {
        value: RIGHT,
        icon: <FloatRight />,
        description: 'Float Right',
        active: value === RIGHT
      }
    ],
    [value]
  );

  return (
    <CategorySection label="Float" keys={[FLOAT]}>
      <CategoryOption onChange={onChange} type="iconGroup" items={items} />
    </CategorySection>
  );
};

export default PositionFloat;
