import useDidUpdateEffect from '@plitzi/plitzi-ui/hooks/useDidUpdateEffect';
import { memo, useCallback, use, useState } from 'react';

import ImageMode from './modes/ImageMode';
// import LinearGradientMode from './modes/LinearGradientMode';
// import RadialGradientMode from './modes/RadialGradientMode';
import CategoryContainer from '../../components/CategoryContainer';
import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const dotKeys = [
  'background-color',
  'background-image',
  'background-position',
  'background-size',
  'background-repeat',
  'background-attachment'
] as StyleCategory[];

export type BackgroundProps = {
  replaceTokens?: boolean;
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const Background = ({ replaceTokens = false, isCollapsed = true, onCollapse }: BackgroundProps) => {
  const { setValue } = use(StyleInspectorContext);
  const { 'background-color': bgColor } = useInspectorValues({
    keys: ['background-color', 'background-size', 'background-attachment', 'background-position', 'background-repeat'],
    asValue: true,
    replaceTokens
  });
  const { 'background-image': bgImage } = useInspectorValues({
    keys: ['background-image'],
    asValue: true,
    strictMode: true,
    replaceTokens
  });
  const [imgType, setImgType] = useState(() => {
    if (bgImage && (bgImage as string).includes('url')) {
      return 'image';
    }

    if (bgImage && (bgImage as string).includes('linear-gradient')) {
      return 'linear-gradient';
    }

    if (bgImage && (bgImage as string).includes('radial-gradient')) {
      return 'radial-gradient';
    }

    return 'color';
  });

  useDidUpdateEffect(() => {
    if (!bgImage) {
      setImgType('color');

      return;
    }

    if ((bgImage as string).includes('url')) {
      setImgType('image');
    } else if ((bgImage as string).includes('linear-gradient')) {
      setImgType('linear-gradient');
    } else if ((bgImage as string).includes('radial-gradient')) {
      setImgType('radial-gradient');
    } else {
      setImgType('color');
    }
  }, [bgImage]);

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('background', isCollapsed), [onCollapse]);

  const handleChange = useCallback(
    (type: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
      if (type === 'background-image') {
        switch (imgType) {
          case 'image':
            setValue('background-image', `url("${value as string}")`);

            break;
          case 'linear-gradient':
            setValue('background-image', `linear-gradient(${value as string})`);

            break;
          case 'radial-gradient':
            setValue('background-image', `radial-gradient(${value as string})`);

            break;
          default:
            setValue('background-image', value as StyleValue);
        }
      } else {
        setValue(type, value as StyleValue);
      }
    },
    [setValue, imgType]
  );

  const handleChangeFill = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
      switch (value) {
        case 'color':
          setValue(
            [
              'background-image',
              'background-position',
              'background-size',
              'background-repeat',
              'background-attachment'
            ],
            {
              'background-image': undefined,
              'background-position': undefined,
              'background-size': undefined,
              'background-repeat': undefined,
              'background-attachment': undefined
            } as Record<StyleCategory, StyleValue | undefined>
          );

          break;
        case 'image':
          setValue(['background-color', 'background-image'], {
            'background-color': undefined,
            'background-image': 'url("https://cdn.plitzi.com/resources/img/background-image.svg")'
          } as Record<StyleCategory, StyleValue | undefined>);

          break;
        case 'linear-gradient':
          setValue(['background-color', 'background-image'], {
            'background-color': undefined,
            'background-image': 'linear-gradient(black, white)'
          } as Record<StyleCategory, StyleValue | undefined>);

          break;
        case 'radial-gradient':
          setValue(['background-color', 'background-image'], {
            'background-color': undefined,
            'background-image': 'radial-gradient(circle at 50% 50%, black, white)'
          } as Record<StyleCategory, StyleValue | undefined>);

          break;
        default:
          setValue(['background-color', 'background-image'], {
            'background-color': undefined,
            'background-image': undefined
          } as Record<StyleCategory, StyleValue | undefined>);
      }
    },
    [setValue]
  );

  return (
    <CategoryContainer title="Background" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <div className="inspector__background flex flex-col gap-2">
        <div className="mx-auto h-16 w-16 rounded-sm border border-gray-300 bg-white p-1">
          <div
            className="h-full w-full bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: bgImage as string }}
          />
        </div>
        <CategorySection label="Fill" keys={dotKeys}>
          <CategoryOption value={imgType} onChange={handleChangeFill} type="select">
            <option value="color">Color</option>
            <option value="image">Image</option>
            <option value="linear-gradient">Linear Gradient</option>
            <option value="radial-gradient">Radial Gradient</option>
          </CategoryOption>
        </CategorySection>
        {imgType === 'image' && <ImageMode replaceTokens={replaceTokens} onChange={handleChange} />}
        {/* {imgType === 'linear-gradient' && <LinearGradientMode partialValue={bgImage} />}
        {imgType === 'radial-gradient' && <RadialGradientMode partialValue={bgImage} />} */}
        {imgType === 'color' && (
          <CategorySection label="Color" keys={['background-color']}>
            <CategoryOption type="color" value={bgColor} onChange={handleChange('background-color')} />
          </CategorySection>
        )}
      </div>
    </CategoryContainer>
  );
};

export default memo(Background);
