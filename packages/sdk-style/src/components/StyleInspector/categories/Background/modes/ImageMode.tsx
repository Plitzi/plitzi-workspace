/* eslint-disable quotes */

import BackgroundTileX from '@plitzi/plitzi-ui/icons/BackgroundTileX';
import BackgroundTileXY from '@plitzi/plitzi-ui/icons/BackgroundTileXY';
import BackgroundTileY from '@plitzi/plitzi-ui/icons/BackgroundTileY';
import XMark from '@plitzi/plitzi-ui/icons/XMark';
import { useCallback, useMemo } from 'react';

import CategoryOption from '../../../components/CategoryOption';
import CategorySection from '../../../components/CategorySection';

import type { BackgroundLayer } from '../helpers/backgroundParser';

export type ImageModeProps = {
  layer: BackgroundLayer;
  onChange?: (layer: BackgroundLayer) => void;
};

const ImageMode = ({ layer, onChange }: ImageModeProps) => {
  const isCustomSize = layer.size === 'auto' || layer.size.includes(' ') || /^\d/.test(layer.size);

  const sizeParts = useMemo(() => (layer.size.includes(' ') ? layer.size.split(' ') : ['auto', 'auto']), [layer.size]);

  const handleUrlChange = useCallback(
    (value: unknown) => onChange?.({ ...layer, url: String(value) }),
    [layer, onChange]
  );

  const handleSizePresetChange = useCallback(
    (value: unknown) => {
      const v = String(value);
      if (v === 'cover' || v === 'contain') {
        onChange?.({ ...layer, size: v });
      } else {
        // "auto" → custom mode with existing size
        const current = layer.size;
        onChange?.({ ...layer, size: current === 'cover' || current === 'contain' ? 'auto auto' : current });
      }
    },
    [layer, onChange]
  );

  const handleSizeWidthChange = useCallback(
    (value: unknown) => onChange?.({ ...layer, size: `${String(value)} ${sizeParts[1] ?? 'auto'}` }),
    [layer, onChange, sizeParts]
  );

  const handleSizeHeightChange = useCallback(
    (value: unknown) => onChange?.({ ...layer, size: `${sizeParts[0] ?? 'auto'} ${String(value)}` }),
    [layer, onChange, sizeParts]
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

  const sizePreset = layer.size === 'cover' ? 'cover' : layer.size === 'contain' ? 'contain' : 'auto';

  const itemsSize = useMemo(
    () => [
      {
        value: 'auto',
        icon: <div className="px-1 text-xs select-none">Custom</div>,
        description: 'Custom dimensions',
        active: sizePreset === 'auto',
        size: 'custom' as const
      },
      {
        value: 'cover',
        icon: <div className="px-1 text-xs select-none">Cover</div>,
        description: 'Cover the element',
        active: sizePreset === 'cover',
        size: 'custom' as const
      },
      {
        value: 'contain',
        icon: <div className="px-1 text-xs select-none">Contain</div>,
        description: 'Fit inside the element',
        active: sizePreset === 'contain',
        size: 'custom' as const
      }
    ],
    [sizePreset]
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
      <CategorySection label="Size">
        <CategoryOption type="iconGroup" items={itemsSize} onChange={handleSizePresetChange} />
      </CategorySection>
      {isCustomSize && (
        <CategorySection>
          <CategoryOption label="W" type="metric" value={sizeParts[0]} onChange={handleSizeWidthChange} />
          <CategoryOption label="H" type="metric" value={sizeParts[1]} onChange={handleSizeHeightChange} />
        </CategorySection>
      )}
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
