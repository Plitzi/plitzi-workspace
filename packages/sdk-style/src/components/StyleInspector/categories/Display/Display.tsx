import { memo, useCallback, use } from 'react';

import {
  DISPLAY,
  FLEX_WRAP,
  FLEX_DIRECTION,
  ALIGN_ITEMS,
  JUSTIFY_CONTENT,
  ALIGN_CONTENT,
  COLUMN_GAP,
  ROW_GAP,
  GRID_ROW_GAP,
  GRID_COLUMN_GAP,
  GRID_TEMPLATE_AREAS,
  GRID_TEMPLATE_COLUMNS,
  GRID_TEMPLATE_ROWS,
  GRID_AUTO_FLOW,
  GRID_AUTO_ROWS,
  GRID_AUTO_COLUMNS
} from '@plitzi/sdk-shared/style';

import DisplayElements from './DisplayElements';
import DisplayFlex from './DisplayFlex';
// import DisplayFlexAlignContent from './DisplayFlexAlignContent';
import DisplayFlexAlignItems from './DisplayFlexAlignItems';
import DisplayFlexDirection from './DisplayFlexDirection';
import DisplayFlexJustify from './DisplayFlexJustify';
// import DisplayGap from './DisplayGap';
// import DisplayGridGap from './DisplayGridGap';
// import DisplayGridTemplate from './DisplayGridTemplate';
import CategoryContainer from '../../components/CategoryContainer';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const dotKeys = [
  FLEX_DIRECTION,
  FLEX_WRAP,
  ALIGN_ITEMS,
  JUSTIFY_CONTENT,
  ALIGN_CONTENT,
  COLUMN_GAP,
  ROW_GAP,
  GRID_ROW_GAP,
  GRID_COLUMN_GAP,
  GRID_TEMPLATE_AREAS,
  GRID_TEMPLATE_COLUMNS,
  GRID_TEMPLATE_ROWS,
  GRID_AUTO_FLOW,
  GRID_AUTO_ROWS,
  GRID_AUTO_COLUMNS,
  DISPLAY
] as StyleCategory[];

export type DisplayProps = {
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const Display = ({ isCollapsed = true, onCollapse }: DisplayProps) => {
  const { setValue } = use(StyleInspectorContext);
  const {
    [DISPLAY]: display,
    [FLEX_DIRECTION]: flexDirection,
    [FLEX_WRAP]: flexWrap,
    [ALIGN_ITEMS]: alignItems,
    [JUSTIFY_CONTENT]: justifyContent
    // [ROW_GAP]: rowGap,
    // [COLUMN_GAP]: columnGap,
    // [GRID_TEMPLATE_AREAS]: gridTemplateAreas,
    // [GRID_TEMPLATE_COLUMNS]: gridTemplateColumns,
    // [GRID_TEMPLATE_ROWS]: gridTemplateRows,
    // [GRID_AUTO_FLOW]: gridAutoFlow,
    // [GRID_AUTO_ROWS]: gridAutoRows,
    // [GRID_AUTO_COLUMNS]: gridAutoColumns,
    // [GRID_ROW_GAP]: gridRowGap,
    // [GRID_COLUMN_GAP]: gridColumnGap,
    // [ALIGN_CONTENT]: alignContent
  } = useInspectorValues({ keys: dotKeys, asValue: true });

  const handleChange = useCallback(
    (type: string, partialValue: StyleValue) => {
      if (type === 'display') {
        setValue(
          [
            FLEX_DIRECTION,
            FLEX_WRAP,
            ALIGN_ITEMS,
            JUSTIFY_CONTENT,
            ALIGN_CONTENT,
            COLUMN_GAP,
            ROW_GAP,
            GRID_ROW_GAP,
            GRID_COLUMN_GAP,
            GRID_TEMPLATE_AREAS,
            GRID_TEMPLATE_COLUMNS,
            GRID_TEMPLATE_ROWS,
            GRID_AUTO_FLOW,
            GRID_AUTO_ROWS,
            GRID_AUTO_COLUMNS,
            DISPLAY
          ],
          {
            [FLEX_DIRECTION]: undefined,
            [FLEX_WRAP]: undefined,
            [ALIGN_ITEMS]: undefined,
            [JUSTIFY_CONTENT]: undefined,
            [ALIGN_CONTENT]: undefined,
            [ROW_GAP]: undefined,
            [COLUMN_GAP]: undefined,
            [GRID_ROW_GAP]: undefined,
            [GRID_COLUMN_GAP]: undefined,
            [GRID_TEMPLATE_AREAS]: undefined,
            [GRID_TEMPLATE_COLUMNS]: undefined,
            [GRID_TEMPLATE_ROWS]: undefined,
            [GRID_AUTO_FLOW]: undefined,
            [GRID_AUTO_ROWS]: undefined,
            [GRID_AUTO_COLUMNS]: undefined,
            [DISPLAY]: partialValue
          }
        );
      } else {
        setValue(type, partialValue);
      }
    },
    [setValue]
  );

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('display', isCollapsed), [onCollapse]);

  const isReverse = typeof flexDirection === 'string' && flexDirection.includes('reverse');
  const isRow = typeof flexDirection === 'string' && flexDirection.includes('row');
  const isReverseWrap = typeof flexWrap === 'string' && flexWrap.includes('reverse');

  return (
    <CategoryContainer title="Layout" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <DisplayElements value={display} onChange={handleChange} />
      {display === 'flex' && (
        <>
          <DisplayFlexDirection value={flexDirection} onChange={handleChange} isReverse={isReverse} />
          <DisplayFlexAlignItems value={alignItems} onChange={handleChange} isReverse={isReverse} isRow={isRow} />
          <DisplayFlexJustify value={justifyContent} onChange={handleChange} isReverse={isReverse} isRow={isRow} />
          <DisplayFlex value={flexWrap} onChange={handleChange} isReverse={isReverseWrap} />
          {/* <DisplayGap rowGap={rowGap} columnGap={columnGap} onChange={handleChange} /> */}
        </>
      )}
      {/* {display === 'grid' && (
        <>
          <DisplayGridTemplate
            templateAreas={gridTemplateAreas}
            templateColumns={gridTemplateColumns}
            templateRows={gridTemplateRows}
            templateAutoFlow={gridAutoFlow}
            templateAutoRows={gridAutoRows}
            templateAutoColumns={gridAutoColumns}
            onChange={handleChange}
          />
          <DisplayGridGap rowGap={gridRowGap} columnGap={gridColumnGap} onChange={handleChange} />
        </>
      )}
      {display === 'flex' && (flexWrap === 'wrap' || flexWrap === 'wrap-reverse') && (
        <DisplayFlexAlignContent value={alignContent} onChange={handleChange} isReverse={isReverseWrap} isRow={isRow} />
      )} */}
    </CategoryContainer>
  );
};

export default memo(Display);
