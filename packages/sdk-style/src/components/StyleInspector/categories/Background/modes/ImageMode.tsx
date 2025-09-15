/* eslint-disable quotes */
import BackgroundTileX from '@plitzi/plitzi-ui/icons/BackgroundTileX';
import BackgroundTileXY from '@plitzi/plitzi-ui/icons/BackgroundTileXY';
import BackgroundTileY from '@plitzi/plitzi-ui/icons/BackgroundTileY';
import XMark from '@plitzi/plitzi-ui/icons/XMark';
import get from 'lodash/get';
import { useCallback, useMemo } from 'react';

import CategoryOption from '../../../components/CategoryOption';
import CategorySection from '../../../components/CategorySection';
import useInspectorValues from '../../../hooks/useInspectorValues';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type ImageModeProps = {
  replaceTokens?: boolean;
  onChange?: (type: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const ImageMode = ({ replaceTokens = false, onChange }: ImageModeProps) => {
  const {
    'background-image': bgImage,
    'background-size': backgroundSize,
    'background-attachment': backgroundAttachment,
    'background-position': backgroundPosition,
    'background-repeat': backgroundRepeat
  } = useInspectorValues({
    keys: ['background-image', 'background-size', 'background-attachment', 'background-position', 'background-repeat'],
    asValue: true,
    replaceTokens
  });

  const backgroundImage = useMemo(
    () => get((bgImage as string).match(/\("(?<content>.*)"\)/im), 'groups.content', ''),
    [bgImage]
  );

  const position = (backgroundPosition as string).split(' ');
  let size = (backgroundSize as string).split(' ');
  if (backgroundSize === 'auto') {
    size = ['auto', 'auto'];
  } else if (backgroundSize === 'cover' || backgroundSize === 'contain') {
    size = ['auto', 'auto'];
  }

  let customSize = false;
  if (backgroundSize === 'auto' || (backgroundSize as string).includes(' ')) {
    customSize = true;
  }

  const handleChange = useCallback(
    (type: StyleCategory, subType?: 'height' | 'width' | 'top' | 'left') =>
      (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
        if (type === 'background-size') {
          if (['auto', 'cover', 'contain'].includes(value as string)) {
            onChange?.(type)(value as string);
          } else {
            let size = (backgroundSize as string).split(' ');
            if (size.length === 1) {
              size = ['0px', '0px'];
            }

            if (subType === 'width') {
              onChange?.('background-size')(`${value as string} ${size[1]}`);
            } else {
              onChange?.('background-size')(`${size[0]} ${value as string}`);
            }
          }
        } else if (type === 'background-position') {
          let position = (backgroundPosition as string).split(' ');
          if (position.length === 1) {
            position = ['0px', '0px'];
          }

          if (subType === 'left') {
            onChange?.('background-position')(`${value as string} ${position[1]}`);
          } else {
            onChange?.('background-position')(`${position[0]} ${value as string}`);
          }
        } else {
          onChange?.(type)(value);
        }
      },
    [backgroundSize, onChange, backgroundPosition]
  );

  const itemsSize = useMemo(
    () => [
      {
        value: 'auto',
        icon: <div className="px-1 text-xs select-none">Custom</div>,
        description: '',
        active: customSize,
        size: 'custom' as const
      },
      {
        value: 'cover',
        icon: <div className="px-1 text-xs select-none">Cover</div>,
        description: '',
        active: backgroundSize === 'cover',
        size: 'custom' as const
      },
      {
        value: 'contain',
        icon: <div className="px-1 text-xs select-none">Contain</div>,
        description: 'Reverse Direction',
        active: backgroundSize === 'contain',
        size: 'custom' as const
      }
    ],
    [backgroundSize, customSize]
  );

  const itemsRepeat = useMemo(
    () => [
      {
        value: 'repeat',
        icon: <BackgroundTileXY />,
        description: 'Horizontally and Vertically',
        active: backgroundRepeat === 'repeat'
      },
      {
        value: 'repeat-x',
        icon: <BackgroundTileX />,
        description: 'Horizontally',
        active: backgroundRepeat === 'repeat-x'
      },
      {
        value: 'repeat-y',
        icon: <BackgroundTileY />,
        description: 'Vertically',
        active: backgroundRepeat === 'repeat-y'
      },
      {
        value: 'no-repeat',
        icon: <XMark />,
        description: "Don't tile",
        active: backgroundRepeat === 'no-repeat'
      }
    ],
    [backgroundRepeat]
  );

  const itemsAttachment = useMemo(
    () => [
      {
        value: 'fixed',
        icon: <div className="px-1 text-xs select-none">Fixed</div>,
        description: '',
        active: backgroundAttachment === 'fixed',
        size: 'custom' as const
      },
      {
        value: 'scroll',
        icon: <div className="px-1 text-xs select-none">Not Fixed</div>,
        description: '',
        active: backgroundAttachment === 'scroll',
        size: 'custom' as const
      }
    ],
    [backgroundAttachment]
  );

  return (
    <>
      <CategorySection label="Image" keys={['background-image']}>
        <CategoryOption value={backgroundImage} onChange={onChange?.('background-image')} type="input" />
      </CategorySection>
      <CategorySection label="Size" keys={['background-size']}>
        <CategoryOption onChange={onChange?.('background-size')} type="iconGroup" items={itemsSize} />
      </CategorySection>
      {customSize && (
        <CategorySection>
          <CategoryOption
            keys={['background-size']}
            label="Width"
            value={size[0]}
            onChange={handleChange('background-size', 'width')}
            type="metric"
          />
          <CategoryOption
            keys={['background-size']}
            label="Height"
            value={size[1]}
            onChange={handleChange('background-size', 'height')}
            type="metric"
          />
        </CategorySection>
      )}
      <CategorySection label="Image Position" keys={['background-position']}>
        <CategoryOption
          keys={['background-position']}
          label="Top"
          value={position[0]}
          onChange={handleChange('background-position', 'top')}
          type="metric"
        />
        <CategoryOption
          keys={['background-position']}
          label="Left"
          value={position[1]}
          onChange={handleChange('background-position', 'left')}
          type="metric"
        />
      </CategorySection>
      <CategorySection label="Tile" keys={['background-repeat']}>
        <CategoryOption onChange={onChange?.('background-repeat')} type="iconGroup" items={itemsRepeat} />
      </CategorySection>
      <CategorySection label="Fixed" keys={['background-attachment']}>
        <CategoryOption onChange={onChange?.('background-attachment')} type="iconGroup" items={itemsAttachment} />
      </CategorySection>
    </>
  );
};

export default ImageMode;
