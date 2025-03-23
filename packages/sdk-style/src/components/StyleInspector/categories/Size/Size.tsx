import { memo, useCallback, use } from 'react';

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
} from '@plitzi/sdk-shared/style';

import SizeFit from './SizeFit';
import SizeOverflow from './SizeOverflow';
import SizePosition from './SizePosition';
import CategoryContainer from '../../components/CategoryContainer';
import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const dotKeys = [
  WIDTH,
  HEIGHT,
  MIN_WIDTH,
  MIN_HEIGHT,
  MAX_WIDTH,
  MAX_HEIGHT,
  OVERFLOW,
  OBJECT_FIT,
  OBJECT_POSITION
] as StyleCategory[];

const keyValueSize = [WIDTH, HEIGHT] as StyleCategory[];
const keyValueSizeMin = [MIN_WIDTH, MIN_HEIGHT] as StyleCategory[];
const keyValueSizeMax = [MAX_WIDTH, MAX_HEIGHT] as StyleCategory[];

export type SizeProps = {
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const Size = ({ isCollapsed = true, onCollapse }: SizeProps) => {
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

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('size', isCollapsed), [onCollapse]);

  const handleChange = useCallback(
    (type: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      setValue(type, value as StyleValue),
    [setValue]
  );

  return (
    <CategoryContainer title="Size" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <CategorySection label="Size" keys={keyValueSize}>
        <CategoryOption keys={[WIDTH]} label="Width" value={width} onChange={handleChange(WIDTH)} type="metric" />
        <CategoryOption keys={[HEIGHT]} label="Height" value={height} onChange={handleChange(HEIGHT)} type="metric" />
      </CategorySection>
      <CategorySection label="Min Size" keys={keyValueSizeMin}>
        <CategoryOption
          keys={[MIN_WIDTH]}
          label="Width"
          value={minWidth}
          onChange={handleChange(MIN_WIDTH)}
          type="metric"
        />
        <CategoryOption
          keys={[MIN_HEIGHT]}
          label="Height"
          value={minHeight}
          onChange={handleChange(MIN_HEIGHT)}
          type="metric"
        />
      </CategorySection>
      <CategorySection label="Max Size" keys={keyValueSizeMax}>
        <CategoryOption
          keys={[MAX_WIDTH]}
          label="Width"
          value={maxWidth}
          onChange={handleChange(MAX_WIDTH)}
          type="metric"
        />
        <CategoryOption
          keys={[MAX_HEIGHT]}
          label="Height"
          value={maxHeight}
          onChange={handleChange(MAX_HEIGHT)}
          type="metric"
        />
      </CategorySection>
      <SizeOverflow value={overflow} onChange={handleChange} />
      <SizePosition value={objectPosition} onChange={handleChange} />
      <SizeFit value={objectFit} onChange={handleChange} />
    </CategoryContainer>
  );
};

export default memo(Size);
