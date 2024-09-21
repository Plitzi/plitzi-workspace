// Packages
import React, { memo, useCallback, use, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import {
  WIDTH,
  HEIGHT,
  MIN_WIDTH,
  MIN_HEIGHT,
  MAX_WIDTH,
  MAX_HEIGHT,
  OVERFLOW,
  OBJECT_FIT,
  OBJECT_POSITION
} from '@plitzi/sdk-style/StyleConstants';

// Relatives
import SizeOverflow from './SizeOverflow';
import SizePosition from './SizePosition';
import SizeFit from './SizeFit';
import StyleInspectorContext from '../../StyleInspectorContext';
import CategoryContainer from '../../../components/CategoryContainer';
import GroupButtons from '../../../components/GroupButtons';
import useInspectorValues from '../../hooks/useInspectorValues';

const dotKeys = [WIDTH, HEIGHT, MIN_WIDTH, MIN_HEIGHT, MAX_WIDTH, MAX_HEIGHT, OVERFLOW, OBJECT_FIT, OBJECT_POSITION];

const keyValueSize = [WIDTH, HEIGHT];
const keyValueSizeMin = [MIN_WIDTH, MIN_HEIGHT];
const keyValueSizeMax = [MAX_WIDTH, MAX_HEIGHT];

/**
 * @param {{
 *   isCollapsed?: boolean;
 *   onCollapse?: (category: string, isCollapsed: boolean) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Size = props => {
  const { isCollapsed = true, onCollapse = noop } = props;
  const { setValue } = use(StyleInspectorContext);
  const {
    [WIDTH]: width,
    [HEIGHT]: height,
    [MIN_WIDTH]: minWidth,
    [MIN_HEIGHT]: minHeight,
    [MAX_WIDTH]: maxWidth,
    [MAX_HEIGHT]: maxHeight,
    [OVERFLOW]: overflow,
    [OBJECT_POSITION]: objectPosition,
    [OBJECT_FIT]: objectFit
  } = useInspectorValues({ keys: dotKeys, asValue: true });

  const handleCollapse = useCallback(isCollapsed => onCollapse('size', isCollapsed), [onCollapse]);

  const handleChange = useCallback(itemValue => setValue(itemValue.type, itemValue.value), [setValue]);

  const itemsSize = useMemo(
    () => [
      { type: 'inputMetric', value: width, extraValue: { type: WIDTH }, keyValue: WIDTH, label: 'Width' },
      { type: 'inputMetric', value: height, extraValue: { type: HEIGHT }, keyValue: HEIGHT, label: 'Height' }
    ],
    [width]
  );

  const itemsMinSize = useMemo(
    () => [
      { type: 'inputMetric', value: minWidth, extraValue: { type: MIN_WIDTH }, keyValue: MIN_WIDTH, label: 'Width' },
      { type: 'inputMetric', value: minHeight, extraValue: { type: MIN_HEIGHT }, keyValue: MIN_HEIGHT, label: 'Height' }
    ],
    [minWidth, minHeight]
  );

  const itemsMaxSize = useMemo(
    () => [
      { type: 'inputMetric', value: maxWidth, extraValue: { type: MAX_WIDTH }, keyValue: MAX_WIDTH, label: 'Width' },
      { type: 'inputMetric', value: maxHeight, extraValue: { type: MAX_HEIGHT }, keyValue: MAX_HEIGHT, label: 'Height' }
    ],
    [maxWidth, maxHeight]
  );

  return (
    <CategoryContainer title="Size" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <div className="flex flex-wrap p-2 gap-2">
        <GroupButtons
          className="w-full"
          classNameContainer="w-[180px]"
          items={itemsSize}
          keyValue={keyValueSize}
          label="Size"
          onChange={handleChange}
        />
        <GroupButtons
          className="w-full"
          classNameContainer="w-[180px]"
          items={itemsMinSize}
          keyValue={keyValueSizeMin}
          label="Min Size"
          onChange={handleChange}
        />
        <GroupButtons
          className="w-full"
          classNameContainer="w-[180px]"
          items={itemsMaxSize}
          keyValue={keyValueSizeMax}
          label="Max Size"
          onChange={handleChange}
        />
        <SizeOverflow value={overflow} onChange={handleChange} />
        <SizePosition value={objectPosition} onChange={handleChange} />
        <SizeFit value={objectFit} onChange={handleChange} />
      </div>
    </CategoryContainer>
  );
};

export default memo(Size);
