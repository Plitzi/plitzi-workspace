// Packages
import React, { memo, useCallback, use, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import {
  BACKGROUND_COLOR,
  BACKGROUND_IMAGE,
  BACKGROUND_POSITION,
  BACKGROUND_SIZE,
  BACKGROUND_REPEAT,
  BACKGROUND_ATTACHMENT
} from '@plitzi/sdk-shared/style/styleConstants';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import ImageMode from './modes/ImageMode';
import LinearGradientMode from './modes/LinearGradientMode';
import RadialGradientMode from './modes/RadialGradientMode';
import StyleInspectorContext from '../../StyleInspectorContext';
import CategoryContainer from '../../../components/CategoryContainer';
import GroupButtons from '../../../components/GroupButtons';
import useInspectorValues from '../../hooks/useInspectorValues';

const dotKeys = [
  BACKGROUND_COLOR,
  BACKGROUND_IMAGE,
  BACKGROUND_POSITION,
  BACKGROUND_SIZE,
  BACKGROUND_REPEAT,
  BACKGROUND_ATTACHMENT
];

/**
 * @param {{
 *   isCollapsed?: boolean;
 *   onCollapse?: (category: string, collapsed: boolean) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Background = props => {
  const { isCollapsed = true, onCollapse = noop } = props;
  const { setValue } = use(StyleInspectorContext);
  const values = useInspectorValues({
    keys: [BACKGROUND_COLOR, BACKGROUND_SIZE, BACKGROUND_ATTACHMENT, BACKGROUND_POSITION, BACKGROUND_REPEAT],
    asValue: true
  });
  const bgImage = useInspectorValues({
    keys: [BACKGROUND_IMAGE],
    asValue: true,
    strictMode: true
  });

  const bgColor = values[BACKGROUND_COLOR];

  const handleCollapse = useCallback(isCollapsed => onCollapse('background', isCollapsed), [onCollapse]);

  let imgType = 'none';
  if (bgImage && bgImage.includes('url')) {
    imgType = 'image';
  } else if (bgImage && bgImage.includes('linear-gradient')) {
    imgType = 'linear-gradient';
  } else if (bgImage && bgImage.includes('radial-gradient')) {
    imgType = 'radial-gradient';
  }

  const keyValueMemo = useMemo(
    () => [BACKGROUND_IMAGE, BACKGROUND_POSITION, BACKGROUND_SIZE, BACKGROUND_REPEAT, BACKGROUND_ATTACHMENT],
    []
  );

  const handleChange = useCallback(
    itemValue => {
      const { type, value } = itemValue;
      if (type === 'bgType' && value === 'none') {
        setValue([BACKGROUND_IMAGE, BACKGROUND_POSITION, BACKGROUND_SIZE, BACKGROUND_REPEAT, BACKGROUND_ATTACHMENT], {
          [BACKGROUND_IMAGE]: undefined,
          [BACKGROUND_POSITION]: undefined,
          [BACKGROUND_SIZE]: undefined,
          [BACKGROUND_REPEAT]: undefined,
          [BACKGROUND_ATTACHMENT]: undefined
        });
      } else if (type === 'bgType') {
        setValue([BACKGROUND_COLOR, BACKGROUND_IMAGE], { [BACKGROUND_COLOR]: undefined, [BACKGROUND_IMAGE]: value });
      } else if (type === BACKGROUND_IMAGE) {
        switch (imgType) {
          case 'image':
            setValue(BACKGROUND_IMAGE, `url("${value}")`);

            break;
          case 'linear-gradient':
            setValue(BACKGROUND_IMAGE, `linear-gradient(${value})`);

            break;
          case 'radial-gradient':
            setValue(BACKGROUND_IMAGE, `radial-gradient(${value})`);

            break;
          default:
            setValue(BACKGROUND_IMAGE, value);
        }
      } else {
        setValue(type, value);
      }
    },
    [setValue, imgType]
  );

  const items = useMemo(
    () => [
      {
        value: { value: 'none', type: 'bgType' },
        children: <Icons width={16} height={16} type="XMark" />,
        description: 'None',
        active: imgType === 'none'
      },
      {
        value: { value: 'url("https://cdn.plitzi.com/resources/img/background-image.svg")', type: 'bgType' },
        children: <Icons width={16} height={16} type="BackgroundModeImage" />,
        description: 'Image',
        active: imgType === 'image'
      },
      {
        value: { value: 'linear-gradient(black, white)', type: 'bgType' },
        children: <Icons width={16} height={16} type="BackgroundModeLinearGradient" />,
        description: 'Linear Gradient',
        active: imgType === 'linear-gradient'
      },
      {
        value: { value: 'radial-gradient(circle at 50% 50%, black, white)', type: 'bgType' },
        children: <Icons width={16} height={16} type="BackgroundModeRadialGradient" />,
        description: 'Radial Gradient',
        active: imgType === 'radial-gradient'
      }
    ],
    [imgType]
  );

  const itemsColor = useMemo(
    () => [{ type: 'color', value: bgColor, extraValue: { type: BACKGROUND_COLOR } }],
    [bgColor]
  );

  return (
    <CategoryContainer title="Background" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <div className="inspector__background flex flex-col p-2 gap-2">
        <div className="mx-auto border border-gray-300 rounded-sm p-1 w-16 h-16 bg-white">
          <div className="h-full w-full bg-no-repeat bg-contain bg-center" style={{ backgroundImage: bgImage }} />
        </div>
        <GroupButtons
          classNameContainer="w-[180px]"
          items={items}
          label="Image & Gradient"
          keyValue={keyValueMemo}
          onChange={handleChange}
        />
        {imgType === 'image' && <ImageMode onChange={handleChange} />}
        {imgType === 'linear-gradient' && <LinearGradientMode partialValue={bgImage} />}
        {imgType === 'radial-gradient' && <RadialGradientMode partialValue={bgImage} />}
        {imgType === 'none' && (
          <GroupButtons
            classNameContainer="w-[180px]"
            keyValue={BACKGROUND_COLOR}
            items={itemsColor}
            label="Color"
            onChange={handleChange}
          />
        )}
      </div>
    </CategoryContainer>
  );
};

export default memo(Background);
