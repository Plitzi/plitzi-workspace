// Packages
import React, { memo, useCallback, useContext } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Alias
import {
  DISPLAY,
  FLEX_WRAP,
  FLEX_DIRECTION,
  ALIGN_ITEMS,
  JUSTIFY_CONTENT,
  ALIGN_CONTENT,
  GAP,
  GRID_ROW_GAP,
  GRID_COLUMN_GAP,
  GRID_TEMPLATE_AREAS,
  GRID_TEMPLATE_COLUMNS,
  GRID_TEMPLATE_ROWS,
  GRID_AUTO_FLOW,
  GRID_AUTO_ROWS,
  GRID_AUTO_COLUMNS
} from '@pmodules/Style/StyleConstants';

// Relatives
import DisplayElements from './DisplayElements';
import DisplayFlexDirection from './DisplayFlexDirection';
import DisplayFlexAlignItems from './DisplayFlexAlignItems';
import DisplayFlexJustify from './DisplayFlexJustify';
import DisplayFlex from './DisplayFlex';
import DisplayFlexAlignContent from './DisplayFlexAlignContent';
import StyleInspectorContext from '../../StyleInspectorContext';
import withStyleInspector from '../../withStyleInspector';
import DisplayGap from './DIsplayGap';
import CategoryContainer from '../../../components/CategoryContainer';
import DisplayGridTemplate from './DisplayGridTemplate';
import DisplayGridGap from './DisplayGridGap';

const dotKeys = [DISPLAY, FLEX_WRAP, FLEX_DIRECTION, ALIGN_ITEMS, JUSTIFY_CONTENT, ALIGN_CONTENT];

const Display = props => {
  const { isCollapsed = true, onCollapse = noop } = props;
  const { getValue, setValue } = useContext(StyleInspectorContext);
  const handleChange = (type, partialValue) => {
    setValue(type, partialValue);
  };

  const handleCollapse = useCallback(isCollapsed => onCollapse('display', isCollapsed), [onCollapse]);

  const directionValue = getValue(FLEX_DIRECTION);
  const wrapValue = getValue(FLEX_WRAP);
  const isReverse = directionValue.includes('reverse');
  const isRow = directionValue.includes('row');
  const isReverseWrap = wrapValue.includes('reverse');
  const displayValue = getValue(DISPLAY);

  return (
    <CategoryContainer title="Layout" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <div className="p-2 flex flex-col gap-2">
        <DisplayElements partialValue={displayValue} directionValue={directionValue} onChange={handleChange} />
        {displayValue === 'flex' && (
          <>
            <DisplayFlexDirection
              partialValue={getValue(FLEX_DIRECTION)}
              directionValue={directionValue}
              wrapValue={wrapValue}
              onChange={handleChange}
              isReverse={isReverse}
            />
            <DisplayFlexAlignItems
              partialValue={getValue(ALIGN_ITEMS)}
              onChange={handleChange}
              isReverse={isReverse}
              isRow={isRow}
            />
            <DisplayFlexJustify
              partialValue={getValue(JUSTIFY_CONTENT)}
              onChange={handleChange}
              isReverse={isReverse}
              isRow={isRow}
            />
            <DisplayFlex
              partialValue={wrapValue}
              wrapValue={wrapValue}
              onChange={handleChange}
              isReverse={isReverseWrap}
            />
            <DisplayGap partialValue={getValue(GAP)} onChange={handleChange} />
          </>
        )}
        {displayValue === 'grid' && (
          <>
            <DisplayGridGap
              rowGap={getValue(GRID_ROW_GAP)}
              columnGap={getValue(GRID_COLUMN_GAP)}
              onChange={handleChange}
            />
            <DisplayGridTemplate
              templateAreas={getValue(GRID_TEMPLATE_AREAS)}
              templateColumns={getValue(GRID_TEMPLATE_COLUMNS)}
              templateRows={getValue(GRID_TEMPLATE_ROWS)}
              templateAutoFlow={getValue(GRID_AUTO_FLOW)}
              templateAutoRows={getValue(GRID_AUTO_ROWS)}
              templateAutoColumns={getValue(GRID_AUTO_COLUMNS)}
              onChange={handleChange}
            />
          </>
        )}
        {displayValue === 'flex' && (wrapValue === 'wrap' || wrapValue === 'wrap-reverse') && (
          <DisplayFlexAlignContent
            partialValue={getValue(ALIGN_CONTENT)}
            onChange={handleChange}
            isReverse={isReverseWrap}
            isRow={isRow}
          />
        )}
      </div>
    </CategoryContainer>
  );
};

Display.propTypes = {
  isCollapsed: PropTypes.bool,
  onCollapse: PropTypes.func
};

export default memo(withStyleInspector(Display));
