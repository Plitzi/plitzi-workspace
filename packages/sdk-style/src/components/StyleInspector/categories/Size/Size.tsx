import { memo, useCallback, use } from 'react';

import SizeFit from './SizeFit';
import SizeOverflow from './SizeOverflow';
import SizePosition from './SizePosition';
import CategoryAdvanced from '../../components/CategoryAdvanced';
import CategoryContainer from '../../components/CategoryContainer';
import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const dotKeys = [
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'aspect-ratio',
  'box-sizing',
  'overflow',
  'object-fit',
  'object-position'
] as StyleCategory[];

const advancedKeys = ['aspect-ratio', 'box-sizing', 'object-position', 'object-fit'] as StyleCategory[];

const keyValueSize = ['width', 'height'] as StyleCategory[];
const keyValueSizeMin = ['min-width', 'min-height'] as StyleCategory[];
const keyValueSizeMax = ['max-width', 'max-height'] as StyleCategory[];

export type SizeProps = {
  replaceTokens?: boolean;
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const Size = ({ replaceTokens = false, isCollapsed = true, onCollapse }: SizeProps) => {
  const { setValue } = use(StyleInspectorContext);
  const {
    width,
    height,
    'min-width': minWidth,
    'min-height': minHeight,
    'max-width': maxWidth,
    'max-height': maxHeight,
    'aspect-ratio': aspectRatio,
    'box-sizing': boxSizing,
    overflow,
    'object-position': objectPosition,
    'object-fit': objectFit
  } = useInspectorValues({ keys: dotKeys, asValue: true, replaceTokens });

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('size', isCollapsed), [onCollapse]);

  const handleChange = useCallback(
    (type: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      setValue(type, value as StyleValue),
    [setValue]
  );

  return (
    <CategoryContainer
      title="Size"
      dotKeys={dotKeys}
      advancedKeys={advancedKeys}
      isCollapsed={isCollapsed}
      onCollapse={handleCollapse}
    >
      <CategorySection label="Size" keys={keyValueSize}>
        <CategoryOption keys={['width']} preffix="W" value={width} onChange={handleChange('width')} type="metric" />
        <CategoryOption keys={['height']} preffix="H" value={height} onChange={handleChange('height')} type="metric" />
      </CategorySection>
      <CategorySection label="Min Size" keys={keyValueSizeMin}>
        <CategoryOption
          keys={['min-width']}
          preffix="W"
          value={minWidth}
          onChange={handleChange('min-width')}
          type="metric"
        />
        <CategoryOption
          keys={['min-height']}
          preffix="H"
          value={minHeight}
          onChange={handleChange('min-height')}
          type="metric"
        />
      </CategorySection>
      <CategorySection label="Max Size" keys={keyValueSizeMax}>
        <CategoryOption
          keys={['max-width']}
          preffix="W"
          value={maxWidth}
          onChange={handleChange('max-width')}
          type="metric"
        />
        <CategoryOption
          keys={['max-height']}
          preffix="H"
          value={maxHeight}
          onChange={handleChange('max-height')}
          type="metric"
        />
      </CategorySection>
      <CategoryAdvanced>
        <CategorySection label="">
          <CategoryOption
            keys={['aspect-ratio']}
            label="Ratio"
            value={aspectRatio}
            onChange={handleChange('aspect-ratio')}
          />
          <CategoryOption
            keys={['box-sizing']}
            label="Box Sizing"
            value={boxSizing}
            onChange={handleChange('box-sizing')}
            type="select"
          >
            <option value="border-box">Border Box</option>
            <option value="content-box">Content Box</option>
          </CategoryOption>
        </CategorySection>
      </CategoryAdvanced>
      <SizeOverflow value={overflow} onChange={handleChange} />
      <CategoryAdvanced>
        <SizePosition value={objectPosition} onChange={handleChange} />
        <SizeFit value={objectFit} onChange={handleChange} />
      </CategoryAdvanced>
    </CategoryContainer>
  );
};

export default memo(Size);
