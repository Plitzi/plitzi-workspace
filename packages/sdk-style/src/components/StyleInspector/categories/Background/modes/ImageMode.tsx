/* eslint-disable quotes */

import BackgroundTileX from '@plitzi/plitzi-ui/icons/BackgroundTileX';
import BackgroundTileXY from '@plitzi/plitzi-ui/icons/BackgroundTileXY';
import BackgroundTileY from '@plitzi/plitzi-ui/icons/BackgroundTileY';
import XMark from '@plitzi/plitzi-ui/icons/XMark';
import { useCallback, useMemo } from 'react';

import CategoryOption from '../../../components/CategoryOption';
import CategorySection from '../../../components/CategorySection';
import BackgroundSize from '../components/BackgroundSize';

import type { BackgroundLayer } from '../helpers/backgroundParser';

export type ImageModeProps = {
  layer: BackgroundLayer;
  onChange?: (layer: BackgroundLayer) => void;
};

const ImageMode = ({ layer, onChange }: ImageModeProps) => {
  const handleUrlChange = useCallback(
    (value: unknown) => onChange?.({ ...layer, url: String(value) }),
    [layer, onChange]
  );

  const handlePositionXChange = useCallback(
    (value: unknown) => onChange?.({ ...layer, positionX: String(value) }),
    [layer, onChange]
  );

  const handlePositionYChange = useCallback(
    (value: unknown) => onChange?.({ ...layer, positionY: String(value) }),
    [layer, onChange]
  );

  const handleRepeatChange = useCallback(
    (value: unknown) => onChange?.({ ...layer, repeat: String(value) }),
    [layer, onChange]
  );

  const handleAttachmentChange = useCallback(
    (value: unknown) => onChange?.({ ...layer, attachment: String(value) }),
    [layer, onChange]
  );

  const itemsRepeat = useMemo(
    () => [
      {
        value: 'repeat',
        icon: <BackgroundTileXY />,
        description: 'Horizontally and Vertically',
        active: layer.repeat === 'repeat'
      },
      {
        value: 'repeat-x',
        icon: <BackgroundTileX />,
        description: 'Horizontally',
        active: layer.repeat === 'repeat-x'
      },
      {
        value: 'repeat-y',
        icon: <BackgroundTileY />,
        description: 'Vertically',
        active: layer.repeat === 'repeat-y'
      },
      {
        value: 'no-repeat',
        icon: <XMark />,
        description: "Don't tile",
        active: layer.repeat === 'no-repeat'
      }
    ],
    [layer.repeat]
  );

  const itemsAttachment = useMemo(
    () => [
      {
        value: 'fixed',
        icon: <div className="px-1 text-xs select-none">Fixed</div>,
        description: 'Fixed to viewport',
        active: layer.attachment === 'fixed',
        size: 'custom' as const
      },
      {
        value: 'local',
        icon: <div className="px-1 text-xs select-none">Local</div>,
        description: 'Scrolls with content',
        active: layer.attachment === 'local',
        size: 'custom' as const
      },
      {
        value: 'scroll',
        icon: <div className="px-1 text-xs select-none">Scroll</div>,
        description: 'Scrolls with element',
        active: layer.attachment === 'scroll',
        size: 'custom' as const
      }
    ],
    [layer.attachment]
  );

  const positionAllowedWords = ['center', 'top', 'right', 'bottom', 'left', 'auto'];

  return (
    <>
      <CategorySection label="URL">
        <CategoryOption type="input" value={layer.url} onChange={handleUrlChange} />
      </CategorySection>
      <BackgroundSize layer={layer} onChange={onChange} />
      <CategorySection label="Position">
        <CategoryOption
          label="X"
          type="metric"
          value={layer.positionX}
          allowedWords={positionAllowedWords}
          onChange={handlePositionXChange}
        />
        <CategoryOption
          label="Y"
          type="metric"
          value={layer.positionY}
          allowedWords={positionAllowedWords}
          onChange={handlePositionYChange}
        />
      </CategorySection>
      <CategorySection label="Tile">
        <CategoryOption type="iconGroup" items={itemsRepeat} onChange={handleRepeatChange} />
      </CategorySection>
      <CategorySection label="Attachment">
        <CategoryOption type="iconGroup" items={itemsAttachment} onChange={handleAttachmentChange} />
      </CategorySection>
    </>
  );
};

export default ImageMode;
