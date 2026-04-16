import { useCallback } from 'react';

import CategoryOption from '../../../components/CategoryOption';
import CategorySection from '../../../components/CategorySection';
import GradientStopBar from '../components/GradientStopBar';

import type { BackgroundLayer, GradientStop } from '../helpers/backgroundParser';

export type RadialGradientModeProps = {
  layer: BackgroundLayer;
  onChange?: (layer: BackgroundLayer) => void;
};

const RadialGradientMode = ({ layer, onChange }: RadialGradientModeProps) => {
  const handleShapeChange = useCallback(
    (value: unknown) => onChange?.({ ...layer, radialShape: value as BackgroundLayer['radialShape'] }),
    [layer, onChange]
  );

  const handleExtentChange = useCallback(
    (value: unknown) => onChange?.({ ...layer, radialExtent: String(value) }),
    [layer, onChange]
  );

  const handlePositionXChange = useCallback(
    (value: unknown) => {
      const parts = layer.radialPosition.split(' ');
      onChange?.({ ...layer, radialPosition: `${String(value as string | number)} ${parts[1] ?? '50%'}` });
    },
    [layer, onChange]
  );

  const handlePositionYChange = useCallback(
    (value: unknown) => {
      const parts = layer.radialPosition.split(' ');
      onChange?.({ ...layer, radialPosition: `${parts[0] ?? '50%'} ${String(value as string | number)}` });
    },
    [layer, onChange]
  );

  const handleStopsChange = useCallback((stops: GradientStop[]) => onChange?.({ ...layer, stops }), [layer, onChange]);

  return (
    <>
      <CategorySection label="Shape">
        <CategoryOption type="select" value={layer.radialShape} onChange={handleShapeChange}>
          <option value="ellipse">Ellipse</option>
          <option value="circle">Circle</option>
        </CategoryOption>
      </CategorySection>
      <CategorySection label="Size">
        <CategoryOption type="select" value={layer.radialExtent} onChange={handleExtentChange}>
          <option value="farthest-corner">Farthest Corner</option>
          <option value="farthest-side">Farthest Side</option>
          <option value="closest-corner">Closest Corner</option>
          <option value="closest-side">Closest Side</option>
        </CategoryOption>
      </CategorySection>
      <CategorySection label="Position">
        <CategoryOption
          type="metric"
          value={layer.radialPosition.split(' ')[0] ?? '50%'}
          allowedWords={['center', 'left', 'right']}
          onChange={handlePositionXChange}
        />
        <CategoryOption
          type="metric"
          value={layer.radialPosition.split(' ')[1] ?? '50%'}
          allowedWords={['center', 'top', 'bottom']}
          onChange={handlePositionYChange}
        />
      </CategorySection>
      <CategorySection label="Gradient" direction="column">
        <GradientStopBar stops={layer.stops} onChange={handleStopsChange} />
      </CategorySection>
    </>
  );
};

export default RadialGradientMode;
