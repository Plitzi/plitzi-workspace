import { useCallback, useMemo } from 'react';

import CategoryOption from '../../../../components/CategoryOption';
import CategorySection from '../../../../components/CategorySection';

import type { BackgroundLayer } from '../../helpers/backgroundParser';

export type BackgroundSizeProps = { layer: BackgroundLayer; onChange?: (layer: BackgroundLayer) => void };

const BackgroundSize = ({ layer, onChange }: BackgroundSizeProps) => {
  const isCustomSize = layer.size === 'auto' || layer.size.includes(' ') || /^\d/.test(layer.size);

  const sizeParts = useMemo(() => (layer.size.includes(' ') ? layer.size.split(' ') : ['auto', 'auto']), [layer.size]);

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

  const sizePreset = layer.size === 'cover' ? 'cover' : layer.size === 'contain' ? 'contain' : 'auto';

  const handleSizeWidthChange = useCallback(
    (value: unknown) => onChange?.({ ...layer, size: `${String(value)} ${sizeParts[1] ?? 'auto'}` }),
    [layer, onChange, sizeParts]
  );

  const handleSizeHeightChange = useCallback(
    (value: unknown) => onChange?.({ ...layer, size: `${sizeParts[0] ?? 'auto'} ${String(value)}` }),
    [layer, onChange, sizeParts]
  );

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

  return (
    <>
      <CategorySection label="Size">
        <CategoryOption type="iconGroup" items={itemsSize} onChange={handleSizePresetChange} />
      </CategorySection>
      {isCustomSize && (
        <CategorySection>
          <CategoryOption label="W" type="metric" value={sizeParts[0]} onChange={handleSizeWidthChange} />
          <CategoryOption label="H" type="metric" value={sizeParts[1]} onChange={handleSizeHeightChange} />
        </CategorySection>
      )}
    </>
  );
};

export default BackgroundSize;
