// Packages
import React, { memo, useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Alias
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
} from '@pmodules/Style/StyleConstants';

// Relatives
import SizeOverflow from './SizeOverflow';
import SizePosition from './SizePosition';
import SizeFit from './SizeFit';
import StyleInspectorContext from '../../StyleInspectorContext';
import withStyleInspector from '../../withStyleInspector';
import CategoryContainer from '../../../components/CategoryContainer';
import GroupButtons from '../../../components/GroupButtons';

const dotKeys = [WIDTH, HEIGHT, MIN_WIDTH, MIN_HEIGHT, MAX_WIDTH, MAX_HEIGHT, OVERFLOW, OBJECT_FIT, OBJECT_POSITION];

const Size = props => {
  const { isCollapsed = true, onCollapse = noop } = props;
  const { getValue, setValue } = useContext(StyleInspectorContext);

  const handleCollapse = useCallback(isCollapsed => onCollapse('size', isCollapsed), [onCollapse]);

  const width = getValue(WIDTH);
  const height = getValue(HEIGHT);
  const minWidth = getValue(MIN_WIDTH);
  const minHeight = getValue(MIN_HEIGHT);
  const maxWidth = getValue(MAX_WIDTH);
  const maxHeight = getValue(MAX_HEIGHT);

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
          label="Size"
          onChange={handleChange}
        />
        <GroupButtons
          className="w-full"
          classNameContainer="w-[180px]"
          items={itemsMinSize}
          label="Min Size"
          onChange={handleChange}
        />
        <GroupButtons
          className="w-full"
          classNameContainer="w-[180px]"
          items={itemsMaxSize}
          label="Max Size"
          onChange={handleChange}
        />
        <SizeOverflow partialValue={getValue(OVERFLOW)} onChange={handleChange} />
        <SizePosition partialValue={getValue(OBJECT_POSITION)} onChange={handleChange} />
        <SizeFit partialValue={getValue(OBJECT_FIT)} onChange={handleChange} />
      </div>
    </CategoryContainer>
  );
};

Size.propTypes = {
  isCollapsed: PropTypes.bool,
  onCollapse: PropTypes.func
};

export default memo(withStyleInspector(Size));
