import ListNumbers from '@plitzi/plitzi-ui/icons/ListNumbers';
import PositionAbsolute from '@plitzi/plitzi-ui/icons/PositionAbsolute';
import PositionFixed from '@plitzi/plitzi-ui/icons/PositionFixed';
import PositionRelative from '@plitzi/plitzi-ui/icons/PositionRelative';
import XMark from '@plitzi/plitzi-ui/icons/XMark';
import { memo, useCallback, use, useMemo } from 'react';

import { POSITION, TOP, BOTTOM, ZINDEX, FLOAT, CLEAR, LEFT, RIGHT } from '@plitzi/sdk-shared/style/styleConstants';

import PositionAdvanced from './PositionAdvanced';
import PositionAdvancedButtons from './PositionAdvancedButtons';
import PositionClear from './PositionClear';
import PositionFloat from './PositionFloat';
import CategoryContainer from '../../components/CategoryContainer';
import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const STATIC = 'static';
const RELATIVE = 'relative';
const ABSOLUTE = 'absolute';
const FIXED = 'fixed';
const STICKY = 'sticky';

const dotKeys = [POSITION, TOP, BOTTOM, ZINDEX, FLOAT, CLEAR, LEFT, RIGHT] as StyleCategory[];
const keyValue = [POSITION, TOP, BOTTOM, LEFT, RIGHT] as StyleCategory[];

export type PositionProps = {
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const Position = ({ isCollapsed = true, onCollapse }: PositionProps) => {
  const { setValue } = use(StyleInspectorContext);
  const {
    [POSITION]: position,
    [TOP]: top,
    [BOTTOM]: bottom,
    [LEFT]: left,
    [RIGHT]: right,
    [FLOAT]: float,
    [CLEAR]: clear,
    [ZINDEX]: zIndex
  } = useInspectorValues({ keys: dotKeys, asValue: true });
  const advancedbuttons = useMemo(
    () => ({ top, bottom, left, right }) as Record<StyleCategory, StyleValue>,
    [top, bottom, left, right]
  );

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('position', isCollapsed), [onCollapse]);

  const handleChange = useCallback(
    (category: StyleCategory | 'position-path') =>
      (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
        if (category === 'position-path') {
          setValue(Object.keys(itemValue) as StyleCategory[], itemValue as Record<StyleCategory, StyleValue>);
        } else {
          setValue(category, itemValue as StyleValue);
        }
      },
    [setValue]
  );

  const items = useMemo(
    () => [
      {
        value: 'static',
        icon: <XMark />,
        description: 'Static',
        active: position === STATIC
      },
      {
        value: 'relative',
        icon: <PositionRelative />,
        description: 'Relative',
        active: position === RELATIVE
      },
      {
        value: 'absolute',
        icon: <PositionAbsolute />,
        description: 'Absolute',
        active: position === ABSOLUTE
      },
      {
        value: 'fixed',
        icon: <PositionFixed />,
        description: 'Fixed',
        active: position === FIXED
      },
      {
        value: 'sticky',
        icon: <ListNumbers />,
        description: 'Sticky',
        active: position === STICKY
      }
    ],
    [position]
  );

  return (
    <CategoryContainer title="Position" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <div className="flex flex-col p-2 gap-2">
        <CategorySection keys={keyValue} label="Position">
          <CategoryOption onChange={handleChange(POSITION)} type="iconGroup" items={items} />
        </CategorySection>
        {(position === FIXED || position === ABSOLUTE) && (
          <PositionAdvancedButtons value={advancedbuttons} onChange={handleChange('position-path')} />
        )}
        <PositionAdvanced value={advancedbuttons} onChange={handleChange} />
        <PositionFloat value={float} onChange={handleChange(FLOAT)} />
        <PositionClear value={clear} onChange={handleChange(CLEAR)} />
        <CategorySection keys={[ZINDEX]} label="Z-Index">
          <CategoryOption onChange={handleChange(ZINDEX)} type="input" value={zIndex as string} />
        </CategorySection>
      </div>
    </CategoryContainer>
  );
};

export default memo(Position);
