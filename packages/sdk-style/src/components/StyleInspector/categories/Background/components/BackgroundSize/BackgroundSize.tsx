import { useCallback, useMemo } from 'react';

import { sizeParts, sizePreset } from './helpers';
import CategoryOption from '../../../../components/CategoryOption';
import CategorySection from '../../../../components/CategorySection';
import { asText } from '../../../../cssValues';

import type { BackgroundLayer } from '../../helpers/backgroundParser';
import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type BackgroundSizeProps = { layer: BackgroundLayer; onChange?: (layer: BackgroundLayer) => void };

type OptionValue = StyleValue | Record<StyleCategory, StyleValue> | boolean;

const BackgroundSize = ({ layer, onChange }: BackgroundSizeProps) => {
  const preset = sizePreset(layer.size);
  const [width, height] = sizeParts(layer.size);

  const handlePresetChange = useCallback(
    (value: OptionValue) => {
      const next = asText(value);
      if (next !== 'custom') {
        onChange?.({ ...layer, size: next });

        return;
      }

      // Leaving cover or contain for a size of its own starts from the natural size, not from a word it cannot read.
      onChange?.({ ...layer, size: preset === 'custom' ? layer.size : 'auto' });
    },
    [layer, onChange, preset]
  );

  const handleWidthChange = useCallback(
    (value: OptionValue) => onChange?.({ ...layer, size: `${asText(value)} ${height}` }),
    [height, layer, onChange]
  );

  const handleHeightChange = useCallback(
    (value: OptionValue) => onChange?.({ ...layer, size: `${width} ${asText(value)}` }),
    [layer, onChange, width]
  );

  const items = useMemo(
    () => [
      {
        value: 'custom',
        icon: <span className="px-1.5 text-xs select-none">Custom</span>,
        description: 'A width and a height of its own',
        active: preset === 'custom',
        size: 'custom' as const
      },
      {
        value: 'cover',
        icon: <span className="px-1.5 text-xs select-none">Cover</span>,
        description: 'Fill the element, cropping what overflows',
        active: preset === 'cover',
        size: 'custom' as const
      },
      {
        value: 'contain',
        icon: <span className="px-1.5 text-xs select-none">Contain</span>,
        description: 'Fit inside the element, whole',
        active: preset === 'contain',
        size: 'custom' as const
      }
    ],
    [preset]
  );

  return (
    <>
      <CategorySection label="Size">
        <CategoryOption type="iconGroup" items={items} onChange={handlePresetChange} />
      </CategorySection>
      {preset === 'custom' && (
        <CategorySection label="">
          <CategoryOption label="Width" type="metric" value={width} onChange={handleWidthChange} />
          <CategoryOption label="Height" type="metric" value={height} onChange={handleHeightChange} />
        </CategorySection>
      )}
    </>
  );
};

export default BackgroundSize;
