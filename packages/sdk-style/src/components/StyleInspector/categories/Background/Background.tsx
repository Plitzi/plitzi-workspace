import useDidUpdateEffect from '@plitzi/plitzi-ui/hooks/useDidUpdateEffect';
import { memo, useCallback, use, useState, useMemo } from 'react';

import { styleConstants } from '@plitzi/sdk-shared';
import { processTwig, hasTokens } from '@plitzi/sdk-shared/helpers/twigWrapper';

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
  styleConstants.BACKGROUND_COLOR,
  styleConstants.BACKGROUND_IMAGE,
  styleConstants.BACKGROUND_ATTACHMENT,
  styleConstants.BACKGROUND_POSITION,
  styleConstants.BACKGROUND_REPEAT,
  styleConstants.BACKGROUND_CLIP,
  styleConstants.BACKGROUND_SIZE,
  styleConstants.MASK_IMAGE
] as StyleCategory[];

export type BackgroundProps = {
  replaceTokens?: boolean;
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const Background = ({ replaceTokens = false, isCollapsed = true, onCollapse }: BackgroundProps) => {
  const { setValue, variables } = use(StyleInspectorContext);
  const {
    [styleConstants.BACKGROUND_COLOR]: bgColor,
    [styleConstants.BACKGROUND_CLIP]: bgClip,
    [styleConstants.MASK_IMAGE]: maskImage
  } = useInspectorValues({
    keys: [
      styleConstants.BACKGROUND_COLOR,
      styleConstants.BACKGROUND_IMAGE,
      styleConstants.BACKGROUND_ATTACHMENT,
      styleConstants.BACKGROUND_POSITION,
      styleConstants.BACKGROUND_REPEAT,
      styleConstants.BACKGROUND_CLIP,
      styleConstants.MASK_IMAGE
    ],
    asValue: true,
    replaceTokens
  });
  const { [styleConstants.BACKGROUND_IMAGE]: bgImage } = useInspectorValues({
    keys: [styleConstants.BACKGROUND_IMAGE],
    asValue: true,
    strictMode: true,
    replaceTokens
  });
  const bgImagePreview = useMemo(
    () => (hasTokens(bgImage as string) ? (processTwig(bgImage as string, variables, true) as string) : bgImage),
    [bgImage, variables]
  );
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
      if (type === styleConstants.BACKGROUND_IMAGE) {
        switch (imgType) {
          case 'image':
            setValue(styleConstants.BACKGROUND_IMAGE, `url("${value as string}")`);

            break;
          case 'linear-gradient':
            setValue(styleConstants.BACKGROUND_IMAGE, `linear-gradient(${value as string})`);

            break;
          case 'radial-gradient':
            setValue(styleConstants.BACKGROUND_IMAGE, `radial-gradient(${value as string})`);

            break;
          default:
            setValue(styleConstants.BACKGROUND_IMAGE, value as StyleValue);
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
              styleConstants.BACKGROUND_IMAGE,
              styleConstants.BACKGROUND_POSITION,
              styleConstants.BACKGROUND_SIZE,
              styleConstants.BACKGROUND_REPEAT,
              styleConstants.BACKGROUND_ATTACHMENT,
              styleConstants.BACKGROUND_CLIP
            ],
            {
              [styleConstants.BACKGROUND_IMAGE]: undefined,
              [styleConstants.BACKGROUND_POSITION]: undefined,
              [styleConstants.BACKGROUND_SIZE]: undefined,
              [styleConstants.BACKGROUND_REPEAT]: undefined,
              [styleConstants.BACKGROUND_ATTACHMENT]: undefined,
              [styleConstants.BACKGROUND_CLIP]: undefined
            } as Record<StyleCategory, StyleValue | undefined>
          );

          break;
        case 'image':
          setValue([styleConstants.BACKGROUND_COLOR, styleConstants.BACKGROUND_IMAGE], {
            [styleConstants.BACKGROUND_COLOR]: undefined,
            [styleConstants.BACKGROUND_IMAGE]: 'url("https://cdn.plitzi.com/resources/img/background-image.svg")'
          } as Record<StyleCategory, StyleValue | undefined>);

          break;
        case 'linear-gradient':
          setValue([styleConstants.BACKGROUND_COLOR, styleConstants.BACKGROUND_IMAGE], {
            [styleConstants.BACKGROUND_COLOR]: undefined,
            [styleConstants.BACKGROUND_IMAGE]: 'linear-gradient(black, white)'
          } as Record<StyleCategory, StyleValue | undefined>);

          break;
        case 'radial-gradient':
          setValue([styleConstants.BACKGROUND_COLOR, styleConstants.BACKGROUND_IMAGE], {
            [styleConstants.BACKGROUND_COLOR]: undefined,
            [styleConstants.BACKGROUND_IMAGE]: 'radial-gradient(circle at 50% 50%, black, white)'
          } as Record<StyleCategory, StyleValue | undefined>);

          break;
        default:
          setValue([styleConstants.BACKGROUND_COLOR, styleConstants.BACKGROUND_IMAGE], {
            [styleConstants.BACKGROUND_COLOR]: undefined,
            [styleConstants.BACKGROUND_IMAGE]: undefined
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
            style={{ backgroundImage: bgImagePreview as string }}
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
        <CategorySection label="Mask Img" keys={[styleConstants.MASK_IMAGE]}>
          <CategoryOption value={maskImage} onChange={handleChange(styleConstants.MASK_IMAGE)} />
        </CategorySection>
        <CategorySection label="Clip" keys={[styleConstants.BACKGROUND_CLIP]}>
          <CategoryOption value={bgClip} onChange={handleChange(styleConstants.BACKGROUND_CLIP)} type="select">
            <option value="border-box">Border Box</option>
            <option value="padding-box">Padding Box</option>
            <option value="content-box">Content Box</option>
            <option value="text">Text</option>
            <option value="border-area">Border Area</option>
          </CategoryOption>
        </CategorySection>
        {imgType === 'image' && <ImageMode replaceTokens={replaceTokens} onChange={handleChange} />}
        {/* {imgType === 'linear-gradient' && <LinearGradientMode partialValue={bgImage} />}
        {imgType === 'radial-gradient' && <RadialGradientMode partialValue={bgImage} />} */}
        {imgType === 'color' && (
          <CategorySection label="Color" keys={[styleConstants.BACKGROUND_COLOR]}>
            <CategoryOption type="color" value={bgColor} onChange={handleChange(styleConstants.BACKGROUND_COLOR)} />
          </CategorySection>
        )}
      </div>
    </CategoryContainer>
  );
};

export default memo(Background);
