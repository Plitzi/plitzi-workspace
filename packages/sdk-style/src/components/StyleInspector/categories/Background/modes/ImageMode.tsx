import { useCallback, useMemo } from 'react';

import CategoryOption from '../../../components/CategoryOption';
import CategorySection from '../../../components/CategorySection';
import BackgroundPosition from '../components/BackgroundPosition';
import BackgroundSize from '../components/BackgroundSize';
import BackgroundTile from '../components/BackgroundTile';

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

  const handleAttachmentChange = useCallback(
    (value: unknown) => onChange?.({ ...layer, attachment: String(value) }),
    [layer, onChange]
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

  return (
    <>
      <CategorySection label="URL">
        <CategoryOption type="input" value={layer.url} onChange={handleUrlChange} />
      </CategorySection>
      <BackgroundSize layer={layer} onChange={onChange} />
      <BackgroundPosition layer={layer} onChange={onChange} />
      <BackgroundTile layer={layer} onChange={onChange} />
      <CategorySection label="Attachment">
        <CategoryOption type="iconGroup" items={itemsAttachment} onChange={handleAttachmentChange} />
      </CategorySection>
    </>
  );
};

export default ImageMode;
