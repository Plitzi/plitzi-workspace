// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import get from 'lodash/get';

// Alias
import Icons from '@pcomponents/Icons';
import {
  BACKGROUND_ATTACHMENT,
  BACKGROUND_IMAGE,
  BACKGROUND_POSITION,
  BACKGROUND_REPEAT,
  BACKGROUND_SIZE
} from '@pmodules/Style/StyleConstants';

// Relatives
import GroupButtons from '../../../../components/GroupButtons';

const ImageMode = props => {
  const { partialValue, onChange = noop } = props;

  const {
    [BACKGROUND_IMAGE]: bgImage,
    [BACKGROUND_SIZE]: backgroundSize,
    [BACKGROUND_ATTACHMENT]: backgroundAttachment,
    [BACKGROUND_POSITION]: backgroundPosition,
    [BACKGROUND_REPEAT]: backgroundRepeat
  } = partialValue;

  const backgroundImage = useMemo(() => get(bgImage.match(/\("(?<content>.*)"\)/im), 'groups.content', ''), [bgImage]);

  const position = backgroundPosition.split(' ');
  let size = backgroundSize.split(' ');
  if (backgroundSize === 'auto') {
    size = ['auto', 'auto'];
  } else if (backgroundSize === 'cover' || backgroundSize === 'contain') {
    size = ['auto', 'auto'];
  }

  let customSize = false;
  if (backgroundSize === 'auto' || backgroundSize.includes(' ')) {
    customSize = true;
  }

  const handleChange = useCallback(
    itemValue => {
      const { type, value, subType } = itemValue;
      if (type === BACKGROUND_SIZE) {
        if (['auto', 'cover', 'contain'].includes(value)) {
          onChange({ type: BACKGROUND_SIZE, value });
        } else {
          let size = backgroundSize.split(' ');
          if (size.length === 1) {
            size = ['0px', '0px'];
          }

          if (subType === 'width') {
            onChange({ type: BACKGROUND_SIZE, value: `${value} ${size[1]}` });
          } else {
            onChange({ type: BACKGROUND_SIZE, value: `${size[0]} ${value}` });
          }
        }
      } else if (type === BACKGROUND_POSITION) {
        let position = backgroundPosition.split(' ');
        if (position.length === 1) {
          position = ['0px', '0px'];
        }

        if (subType === 'left') {
          onChange({ type: BACKGROUND_POSITION, value: `${value} ${position[1]}` });
        } else {
          onChange({ type: BACKGROUND_POSITION, value: `${position[0]} ${value}` });
        }
      } else {
        onChange({ type, value });
      }
    },
    [backgroundSize, onChange, backgroundPosition]
  );

  const itemsImage = useMemo(
    () => [
      { type: 'input', value: backgroundImage, extraValue: { type: BACKGROUND_IMAGE }, inputProps: { type: 'text' } }
    ],
    [backgroundImage]
  );

  const itemsSizeBtn = useMemo(
    () => [
      {
        value: { value: 'auto', type: BACKGROUND_SIZE },
        children: <div className="text-xs select-none px-1">Custom</div>,
        description: '',
        active: customSize
      },
      {
        value: { value: 'cover', type: BACKGROUND_SIZE },
        children: <div className="text-xs select-none px-1">Cover</div>,
        description: '',
        active: backgroundSize === 'cover'
      },
      {
        value: { value: 'contain', type: BACKGROUND_SIZE },
        children: <div className="text-xs select-none px-1">Contain</div>,
        description: 'Reverse Direction',
        active: backgroundSize === 'contain'
      }
    ],
    [backgroundSize, customSize]
  );

  const itemsSize = useMemo(
    () => [
      { type: 'inputMetric', value: size[0], extraValue: { type: BACKGROUND_SIZE, subType: 'width' }, label: 'Width' },
      { type: 'inputMetric', value: size[1], extraValue: { type: BACKGROUND_SIZE, subType: 'height' }, label: 'Height' }
    ],
    [size]
  );

  const itemsPosition = useMemo(
    () => [
      {
        type: 'inputMetric',
        value: position[0],
        extraValue: { type: BACKGROUND_POSITION, subType: 'left' },
        label: 'Left'
      },
      {
        type: 'inputMetric',
        value: position[1],
        extraValue: { type: BACKGROUND_POSITION, subType: 'top' },
        label: 'Top'
      }
    ],
    [position]
  );

  const itemsRepeat = useMemo(
    () => [
      {
        value: { value: 'repeat', type: BACKGROUND_REPEAT },
        children: <Icons width={16} height={16} type="BackgroundTileXY" />,
        description: 'Horizontally and Vertically',
        active: backgroundRepeat === 'repeat'
      },
      {
        value: { value: 'repeat-x', type: BACKGROUND_REPEAT },
        children: <Icons width={16} height={16} type="BackgroundTileX" />,
        description: 'Horizontally',
        active: backgroundRepeat === 'repeat-x'
      },
      {
        value: { value: 'repeat-y', type: BACKGROUND_REPEAT },
        children: <Icons width={16} height={16} type="BackgroundTileY" />,
        description: 'Vertically',
        active: backgroundRepeat === 'repeat-y'
      },
      {
        value: { value: 'no-repeat', type: BACKGROUND_REPEAT },
        children: <Icons width={16} height={16} type="XMark" />,
        description: "Don't tile",
        active: backgroundRepeat === 'no-repeat'
      }
    ],
    [backgroundRepeat]
  );

  const itemsAttachment = useMemo(
    () => [
      {
        value: { value: 'fixed', type: BACKGROUND_ATTACHMENT },
        children: <div className="text-xs select-none px-1">Fixed</div>,
        description: '',
        active: backgroundAttachment === 'fixed'
      },
      {
        value: { value: 'scroll', type: BACKGROUND_ATTACHMENT },
        children: <div className="text-xs select-none px-1">Not Fixed</div>,
        description: '',
        active: backgroundAttachment === 'scroll'
      }
    ],
    [backgroundAttachment]
  );

  return (
    <>
      <GroupButtons
        classNameContainer="w-[180px]"
        items={itemsImage}
        label="Image"
        keyValue={BACKGROUND_IMAGE}
        onChange={handleChange}
      />
      <GroupButtons
        classNameContainer="w-[180px]"
        items={itemsSizeBtn}
        label="Size"
        keyValue={BACKGROUND_SIZE}
        onChange={handleChange}
      />
      {customSize && (
        <GroupButtons
          className="w-full !justify-end"
          classNameContainer="w-[180px]"
          items={itemsSize}
          label=""
          onChange={handleChange}
        />
      )}
      <GroupButtons
        className="w-full"
        classNameContainer="w-[180px]"
        items={itemsPosition}
        keyValue={BACKGROUND_POSITION}
        label="Image Position"
        onChange={handleChange}
      />
      <GroupButtons
        classNameContainer="w-[180px]"
        items={itemsRepeat}
        label="Tile"
        keyValue={BACKGROUND_REPEAT}
        onChange={handleChange}
      />
      <GroupButtons
        classNameContainer="w-[180px]"
        items={itemsAttachment}
        label="Fixed"
        keyValue={BACKGROUND_ATTACHMENT}
        onChange={handleChange}
      />
    </>
  );
};

ImageMode.propTypes = {
  partialValue: PropTypes.object,
  onChange: PropTypes.func
};

export default ImageMode;
