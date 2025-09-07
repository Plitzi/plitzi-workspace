import ClearBoth from '@plitzi/plitzi-ui/icons/ClearBoth';
import ClearLeft from '@plitzi/plitzi-ui/icons/ClearLeft';
import ClearRight from '@plitzi/plitzi-ui/icons/ClearRight';
import XMark from '@plitzi/plitzi-ui/icons/XMark';
import { useMemo } from 'react';

import { CLEAR } from '@plitzi/sdk-shared/style/styleConstants';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type PositionClearProps = {
  value?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const PositionClear = ({ value, onChange }: PositionClearProps) => {
  const items = useMemo(
    () => [
      {
        value: 'none',
        icon: <XMark />,
        description: 'Static',
        active: value === 'none'
      },
      {
        value: 'left',
        icon: <ClearLeft />,
        description: 'Clear Left',
        active: value === 'left'
      },
      {
        value: 'right',
        icon: <ClearRight />,
        description: 'Clear Right',
        active: value === 'right'
      },
      {
        value: 'both',
        icon: <ClearBoth />,
        description: 'Clear Both',
        active: value === 'both'
      }
    ],
    [value]
  );

  return (
    <CategorySection label="Clear" keys={[CLEAR]}>
      <CategoryOption onChange={onChange} type="iconGroup" items={items} />
    </CategorySection>
  );
};

export default PositionClear;
