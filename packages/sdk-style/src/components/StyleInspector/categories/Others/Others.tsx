import { memo, use, useCallback } from 'react';

import OthersForm from './OthersForm';
import OthersInteraction from './OthersInteraction';
import OthersOutline from './OthersOutline';
import OthersScrollbar from './OthersScrollbar';
import OthersScrollSnap from './OthersScrollSnap';
import OthersSvg from './OthersSvg';
import OthersTable from './OthersTable';
import { OTHERS_KEYS } from '../../categoryKeys';
import CategoryAdvanced from '../../components/CategoryAdvanced';
import CategoryContainer from '../../components/CategoryContainer';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

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
    'scroll-snap-type': scrollSnapType,
    'scroll-snap-align': scrollSnapAlign,
    'scroll-snap-stop': scrollSnapStop,
    'scroll-padding-top': scrollPaddingTop,
    'scroll-margin-top': scrollMarginTop,
    'accent-color': accentColor,
    'caret-color': caretColor,
    'color-scheme': colorScheme,
    'scrollbar-width': scrollbarWidth,
    'scrollbar-color': scrollbarColor,
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
  } = useInspectorValues({ keys: OTHERS_KEYS.dot, asValue: true, replaceTokens });

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('others', isCollapsed), [onCollapse]);

  const handleChange = useCallback(
    (type: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      setValue(type, value as StyleValue),
    [setValue]
  );

  return (
    <CategoryContainer
      title={OTHERS_KEYS.title}
      dotKeys={OTHERS_KEYS.dot}
      advancedKeys={OTHERS_KEYS.advanced}
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
        <OthersScrollbar scrollbarWidth={scrollbarWidth} scrollbarColor={scrollbarColor} onChange={handleChange} />
        <OthersScrollSnap
          scrollSnapType={scrollSnapType}
          scrollSnapAlign={scrollSnapAlign}
          scrollSnapStop={scrollSnapStop}
          scrollPaddingTop={scrollPaddingTop}
          scrollMarginTop={scrollMarginTop}
          onChange={handleChange}
        />
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
