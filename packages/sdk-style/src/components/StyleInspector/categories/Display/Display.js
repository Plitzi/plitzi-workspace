// Packages
import React, { memo, useCallback, use } from 'react';
import noop from 'lodash/noop';

// Monorepo
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
} from '@plitzi/sdk-style/StyleConstants';

// Relatives
import DisplayElements from './DisplayElements';
import DisplayFlexDirection from './DisplayFlexDirection';
import DisplayFlexAlignItems from './DisplayFlexAlignItems';
import DisplayFlexJustify from './DisplayFlexJustify';
import DisplayFlex from './DisplayFlex';
import DisplayFlexAlignContent from './DisplayFlexAlignContent';
import StyleInspectorContext from '../../StyleInspectorContext';
import DisplayGap from './DisplayGap';
import CategoryContainer from '../../../components/CategoryContainer';
import DisplayGridTemplate from './DisplayGridTemplate';
import DisplayGridGap from './DisplayGridGap';
import useInspectorValues from '../../hooks/useInspectorValues';

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
];

/**
 * @param {{
 *   isCollapsed?: boolean;
 *   onCollapse?: (category: string, collapsed: boolean) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Display = props => {
  const { isCollapsed = true, onCollapse = noop } = props;
  const { setValue } = use(StyleInspectorContext);
  const {
    [DISPLAY]: display,
    [FLEX_DIRECTION]: flexDirection,
    [FLEX_WRAP]: flexWrap,
    [ALIGN_ITEMS]: alignItems,
    [JUSTIFY_CONTENT]: justifyContent,
    [ROW_GAP]: rowGap,
    [COLUMN_GAP]: columnGap,
    [GRID_TEMPLATE_AREAS]: gridTemplateAreas,
    [GRID_TEMPLATE_COLUMNS]: gridTemplateColumns,
    [GRID_TEMPLATE_ROWS]: gridTemplateRows,
    [GRID_AUTO_FLOW]: gridAutoFlow,
    [GRID_AUTO_ROWS]: gridAutoRows,
    [GRID_AUTO_COLUMNS]: gridAutoColumns,
    [GRID_ROW_GAP]: gridRowGap,
    [GRID_COLUMN_GAP]: gridColumnGap,
    [ALIGN_CONTENT]: alignContent
  } = useInspectorValues({ keys: dotKeys, asValue: true });
  const handleChange = useCallback(
    (type, partialValue) => {
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

  const handleCollapse = useCallback(isCollapsed => onCollapse('display', isCollapsed), [onCollapse]);

  const isReverse = flexDirection.includes('reverse');
  const isRow = flexDirection.includes('row');
  const isReverseWrap = flexWrap.includes('reverse');

  return (
    <CategoryContainer title="Layout" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <div className="p-2 flex flex-col gap-2">
        <DisplayElements value={display} directionValue={flexDirection} onChange={handleChange} />
        {display === 'flex' && (
          <>
            <DisplayFlexDirection value={flexDirection} onChange={handleChange} isReverse={isReverse} />
            <DisplayFlexAlignItems value={alignItems} onChange={handleChange} isReverse={isReverse} isRow={isRow} />
            <DisplayFlexJustify value={justifyContent} onChange={handleChange} isReverse={isReverse} isRow={isRow} />
            <DisplayFlex value={flexWrap} onChange={handleChange} isReverse={isReverseWrap} />
            <DisplayGap rowGap={rowGap} columnGap={columnGap} onChange={handleChange} />
          </>
        )}
        {display === 'grid' && (
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
          <DisplayFlexAlignContent
            value={alignContent}
            onChange={handleChange}
            isReverse={isReverseWrap}
            isRow={isRow}
          />
        )}
      </div>
    </CategoryContainer>
  );
};

export default memo(Display);
