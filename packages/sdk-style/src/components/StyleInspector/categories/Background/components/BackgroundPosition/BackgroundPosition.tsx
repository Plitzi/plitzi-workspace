import { useCallback } from 'react';

import CategoryOption from '../../../../components/CategoryOption';
import CategorySection from '../../../../components/CategorySection';

import type { BackgroundLayer } from '../../helpers/backgroundParser';

export type BackgroundPositionProps = { layer: BackgroundLayer; onChange?: (layer: BackgroundLayer) => void };

const positionAllowedWords = ['center', 'top', 'right', 'bottom', 'left', 'auto'];

const BackgroundPosition = ({ layer, onChange }: BackgroundPositionProps) => {
  const handlePositionXChange = useCallback(
    (value: unknown) => onChange?.({ ...layer, positionX: String(value) }),
    [layer, onChange]
  );

  const handlePositionYChange = useCallback(
    (value: unknown) => onChange?.({ ...layer, positionY: String(value) }),
    [layer, onChange]
  );

  return (
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
  );
};

export default BackgroundPosition;
