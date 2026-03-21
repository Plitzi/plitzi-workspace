import ListNumbers from '@plitzi/plitzi-ui/icons/ListNumbers';
import PositionAbsolute from '@plitzi/plitzi-ui/icons/PositionAbsolute';
import PositionFixed from '@plitzi/plitzi-ui/icons/PositionFixed';
import PositionRelative from '@plitzi/plitzi-ui/icons/PositionRelative';
import XMark from '@plitzi/plitzi-ui/icons/XMark';
import { memo, useCallback, use, useMemo } from 'react';

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

const dotKeys = ['position', 'top', 'bottom', 'z-index', 'float', 'clear', 'left', 'right'] as StyleCategory[];
const keyValue = ['position', 'top', 'bottom', 'left', 'right'] as StyleCategory[];

export type PositionProps = {
  replaceTokens?: boolean;
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const Position = ({ replaceTokens = false, isCollapsed = true, onCollapse }: PositionProps) => {
  const { setValue } = use(StyleInspectorContext);
  const {
    position,
    top,
    bottom,
    left,
    right,
    float,
    clear,
    'z-index': zIndex
  } = useInspectorValues({ keys: dotKeys, asValue: true, replaceTokens });
  const advancedbuttons = useMemo(
    () => ({ top, bottom, left, right }) as Record<StyleCategory, StyleValue>,
    [top, bottom, left, right]
  );

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('position', isCollapsed), [onCollapse]);

  const handleChange = useCallback(
    (category: StyleCategory | 'position-path') =>
      (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
        if (category === 'position-path') {
          setValue(undefined, itemValue as Record<StyleCategory, StyleValue>);
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
        active: position === 'static'
      },
      {
        value: 'relative',
        icon: <PositionRelative />,
        description: 'Relative',
        active: position === 'relative'
      },
      {
        value: 'absolute',
        icon: <PositionAbsolute />,
        description: 'Absolute',
        active: position === 'absolute'
      },
      {
        value: 'fixed',
        icon: <PositionFixed />,
        description: 'Fixed',
        active: position === 'fixed'
      },
      {
        value: 'sticky',
        icon: <ListNumbers />,
        description: 'Sticky',
        active: position === 'sticky'
      }
    ],
    [position]
  );

  return (
    <CategoryContainer title="Position" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <div className="flex flex-col gap-2">
        <CategorySection keys={keyValue} label="Position">
          <CategoryOption onChange={handleChange('position')} type="iconGroup" items={items} />
        </CategorySection>
        {(position === 'fixed' || position === 'absolute') && (
          <PositionAdvancedButtons value={advancedbuttons} onChange={handleChange('position-path')} />
        )}
        <PositionAdvanced value={advancedbuttons} onChange={handleChange} />
        <PositionFloat value={float} onChange={handleChange('float')} />
        <PositionClear value={clear} onChange={handleChange('clear')} />
        <CategorySection keys={['z-index']} label="Z-Index">
          <CategoryOption onChange={handleChange('z-index')} type="input" value={zIndex as string} />
        </CategorySection>
      </div>
    </CategoryContainer>
  );
};

export default memo(Position);
