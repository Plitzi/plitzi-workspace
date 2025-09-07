import PositionAll from '@plitzi/plitzi-ui/icons/PositionAll';
import PositionBottom from '@plitzi/plitzi-ui/icons/PositionBottom';
import PositionBottomLeft from '@plitzi/plitzi-ui/icons/PositionBottomLeft';
import PositionBottomRight from '@plitzi/plitzi-ui/icons/PositionBottomRight';
import PositionLeft from '@plitzi/plitzi-ui/icons/PositionLeft';
import PositionRight from '@plitzi/plitzi-ui/icons/PositionRight';
import PositionTop from '@plitzi/plitzi-ui/icons/PositionTop';
import PositionTopLeft from '@plitzi/plitzi-ui/icons/PositionTopLeft';
import PositionTopRight from '@plitzi/plitzi-ui/icons/PositionTopRight';
import { useMemo } from 'react';

import { TOP, BOTTOM, LEFT, RIGHT } from '@plitzi/sdk-shared/style/styleConstants';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type PositionAdvancedButtonsProps = {
  value?: Record<StyleCategory, StyleValue | undefined>;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const PositionAdvancedButtons = ({ value, onChange }: PositionAdvancedButtonsProps) => {
  const { [TOP]: top, [BOTTOM]: bottom, [LEFT]: left, [RIGHT]: right } = value ?? {};

  const items = useMemo(
    () => [
      {
        value: { top: '0%', left: '0%', bottom: 'auto', right: 'auto' } as Record<StyleCategory, StyleValue>,
        icon: <PositionTopLeft />,
        description: 'Top Left',
        active: top === '0%' && left === '0%' && bottom === 'auto' && right === 'auto'
      },
      {
        value: { top: '0%', left: 'auto', bottom: 'auto', right: '0%' } as Record<StyleCategory, StyleValue>,
        icon: <PositionTopRight />,
        description: 'Top Right',
        active: top === '0%' && left === 'auto' && bottom === 'auto' && right === '0%'
      },
      {
        value: { top: 'auto', left: '0%', bottom: '0%', right: 'auto' } as Record<StyleCategory, StyleValue>,
        icon: <PositionBottomLeft />,
        description: 'Bottom Left',
        active: top === 'auto' && left === '0%' && bottom === '0%' && right === 'auto'
      },
      {
        value: { top: 'auto', left: 'auto', bottom: '0%', right: '0%' } as Record<StyleCategory, StyleValue>,
        icon: <PositionBottomRight />,
        description: 'Bottom Right',
        active: top === '0%' && left === '0%' && bottom === '0%' && right === 'auto'
      },
      {
        value: { top: '0%', left: '0%', bottom: '0%', right: 'auto' } as Record<StyleCategory, StyleValue>,
        icon: <PositionLeft />,
        description: 'Left',
        active: top === '0%' && left === '0%' && bottom === '0%' && right === 'auto'
      },
      {
        value: { top: '0%', left: 'auto', bottom: '0%', right: '0%' } as Record<StyleCategory, StyleValue>,
        icon: <PositionRight />,
        description: 'Right',
        active: top === '0%' && left === 'auto' && bottom === '0%' && right === '0%'
      },
      {
        value: { top: 'auto', left: '0%', bottom: '0%', right: '0%' } as Record<StyleCategory, StyleValue>,
        icon: <PositionBottom />,
        description: 'Bottom',
        active: top === 'auto' && left === '0%' && bottom === '0%' && right === '0%'
      },
      {
        value: { top: '0%', left: '0%', bottom: 'auto', right: '0%' } as Record<StyleCategory, StyleValue>,
        icon: <PositionTop />,
        description: 'Top',
        active: top === '0%' && left === '0%' && bottom === 'auto' && right === '0%'
      },
      {
        value: { top: '0%', left: '0%', bottom: '0%', right: '0%' } as Record<StyleCategory, StyleValue>,
        icon: <PositionAll />,
        description: 'Full',
        active: top === '0%' && left === '0%' && bottom === '0%' && right === '0%'
      }
    ],
    [top, left, bottom, right]
  );

  return (
    <CategorySection label="">
      <CategoryOption onChange={onChange} type="iconGroup" items={items} />
    </CategorySection>
  );
};

export default PositionAdvancedButtons;
