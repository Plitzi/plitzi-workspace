import { useCallback } from 'react';

import CategoryOption from '../../../../components/CategoryOption';
import CategorySection from '../../../../components/CategorySection';
import { asText } from '../../../../cssValues';

import type { BackgroundLayer } from '../../helpers/backgroundParser';
import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type BackgroundPositionProps = { layer: BackgroundLayer; onChange?: (layer: BackgroundLayer) => void };

const positionAllowedWords = ['center', 'top', 'right', 'bottom', 'left', 'auto'];

const BackgroundPosition = ({ layer, onChange }: BackgroundPositionProps) => {
  const handlePositionXChange = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.({ ...layer, positionX: asText(value) }),
    [layer, onChange]
  );

  const handlePositionYChange = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.({ ...layer, positionY: asText(value) }),
    [layer, onChange]
  );

  return (
    <CategorySection label="Position">
      <CategoryOption
        label="X"
        type="metric"
        value={layer.positionX}
        allowedWords={positionAllowedWords}
        min={-Infinity}
        onChange={handlePositionXChange}
      />
      <CategoryOption
        label="Y"
        type="metric"
        value={layer.positionY}
        allowedWords={positionAllowedWords}
        min={-Infinity}
        onChange={handlePositionYChange}
      />
    </CategorySection>
  );
};

export default BackgroundPosition;
