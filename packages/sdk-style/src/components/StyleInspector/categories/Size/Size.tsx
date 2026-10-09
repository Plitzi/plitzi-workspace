import { memo, useCallback } from 'react';

import SizeContainer from './SizeContainer';
import SizeFit from './SizeFit';
import SizeOverflow from './SizeOverflow';
import SizePosition from './SizePosition';
import { SIZE_KEYS } from '../../categoryKeys';
import CategoryAdvanced from '../../components/CategoryAdvanced';
import CategoryContainer from '../../components/CategoryContainer';
import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';
import useInspectorValues from '../../hooks/useInspectorValues';
import usePropertyChange from '../../hooks/usePropertyChange';

import type { StyleCategory } from '@plitzi/sdk-shared';

const keyValueSize = ['width', 'height'] as StyleCategory[];
const keyValueSizeMin = ['min-width', 'min-height'] as StyleCategory[];
const keyValueSizeMax = ['max-width', 'max-height'] as StyleCategory[];

export type SizeProps = {
  replaceTokens?: boolean;
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const Size = ({ replaceTokens = false, isCollapsed = true, onCollapse }: SizeProps) => {
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
    'object-fit': objectFit,
    'container-type': containerType,
    'container-name': containerName
  } = useInspectorValues({ keys: SIZE_KEYS.dot, asValue: true, replaceTokens });

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('size', isCollapsed), [onCollapse]);

  const handleChange = usePropertyChange();

  return (
    <CategoryContainer
      title={SIZE_KEYS.title}
      dotKeys={SIZE_KEYS.dot}
      advancedKeys={SIZE_KEYS.advanced}
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
        <SizeContainer containerType={containerType} containerName={containerName} onChange={handleChange} />
      </CategoryAdvanced>
    </CategoryContainer>
  );
};

export default memo(Size);
