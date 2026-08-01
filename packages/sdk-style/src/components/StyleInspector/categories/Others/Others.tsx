import { memo, use, useCallback } from 'react';

import OthersForm from './OthersForm';
import OthersInteraction from './OthersInteraction';
import OthersOutline from './OthersOutline';
import OthersSvg from './OthersSvg';
import OthersTable from './OthersTable';
import CategoryAdvanced from '../../components/CategoryAdvanced';
import CategoryContainer from '../../components/CategoryContainer';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const dotKeys = [
  'pointer-events',
  'user-select',
  'touch-action',
  'resize',
  'appearance',
  'scroll-behavior',
  'overscroll-behavior',
  'accent-color',
  'caret-color',
  'color-scheme',
  'outline-width',
  'outline-style',
  'outline-color',
  'outline-offset',
  'border-collapse',
  'border-spacing',
  'table-layout',
  'fill',
  'stroke',
  'stroke-width'
] as StyleCategory[];

const advancedKeys = [
  'touch-action',
  'resize',
  'appearance',
  'scroll-behavior',
  'overscroll-behavior',
  'accent-color',
  'caret-color',
  'color-scheme',
  'border-collapse',
  'border-spacing',
  'table-layout',
  'fill',
  'stroke',
  'stroke-width'
] as StyleCategory[];

export type OthersProps = {
  replaceTokens?: boolean;
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const Others = ({ replaceTokens = false, isCollapsed = true, onCollapse }: OthersProps) => {
  const { setValue } = use(StyleInspectorContext);
  const {
    'pointer-events': pointerEvents,
    'user-select': userSelect,
    'touch-action': touchAction,
    resize,
    appearance,
    'scroll-behavior': scrollBehavior,
    'overscroll-behavior': overscrollBehavior,
    'accent-color': accentColor,
    'caret-color': caretColor,
    'color-scheme': colorScheme,
    'outline-width': outlineWidth,
    'outline-style': outlineStyle,
    'outline-color': outlineColor,
    'outline-offset': outlineOffset,
    'border-collapse': borderCollapse,
    'border-spacing': borderSpacing,
    'table-layout': tableLayout,
    fill,
    stroke,
    'stroke-width': strokeWidth
  } = useInspectorValues({ keys: dotKeys, asValue: true, replaceTokens });

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('others', isCollapsed), [onCollapse]);

  const handleChange = useCallback(
    (type: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      setValue(type, value as StyleValue),
    [setValue]
  );

  return (
    <CategoryContainer
      title="Others"
      dotKeys={dotKeys}
      advancedKeys={advancedKeys}
      isCollapsed={isCollapsed}
      onCollapse={handleCollapse}
    >
      <OthersInteraction
        pointerEvents={pointerEvents}
        userSelect={userSelect}
        touchAction={touchAction}
        resize={resize}
        appearance={appearance}
        scrollBehavior={scrollBehavior}
        overscrollBehavior={overscrollBehavior}
        onChange={handleChange}
      />
      <OthersOutline
        outlineWidth={outlineWidth}
        outlineStyle={outlineStyle}
        outlineColor={outlineColor}
        outlineOffset={outlineOffset}
        onChange={handleChange}
      />
      <CategoryAdvanced>
        <OthersForm
          accentColor={accentColor}
          caretColor={caretColor}
          colorScheme={colorScheme}
          onChange={handleChange}
        />
        <OthersTable
          borderCollapse={borderCollapse}
          borderSpacing={borderSpacing}
          tableLayout={tableLayout}
          onChange={handleChange}
        />
        <OthersSvg fill={fill} stroke={stroke} strokeWidth={strokeWidth} onChange={handleChange} />
      </CategoryAdvanced>
    </CategoryContainer>
  );
};

export default memo(Others);
