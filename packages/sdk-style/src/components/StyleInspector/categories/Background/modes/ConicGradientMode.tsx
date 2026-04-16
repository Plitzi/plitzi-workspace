import { useCallback } from 'react';

import CategoryOption from '../../../components/CategoryOption';
import CategorySection from '../../../components/CategorySection';
import GradientStopBar from '../components/GradientStopBar';

import type { BackgroundLayer, GradientStop } from '../helpers/backgroundParser';

export type ConicGradientModeProps = {
  layer: BackgroundLayer;
  onChange?: (layer: BackgroundLayer) => void;
};

const ConicGradientMode = ({ layer, onChange }: ConicGradientModeProps) => {
  const handleAngleChange = useCallback(
    (value: unknown) => onChange?.({ ...layer, conicAngle: String(value) }),
    [layer, onChange]
  );

  const handlePositionXChange = useCallback(
    (value: unknown) => {
      const parts = layer.conicPosition.split(' ');
      onChange?.({ ...layer, conicPosition: `${String(value as string | number)} ${parts[1] ?? '50%'}` });
    },
    [layer, onChange]
  );

  const handlePositionYChange = useCallback(
    (value: unknown) => {
      const parts = layer.conicPosition.split(' ');
      onChange?.({ ...layer, conicPosition: `${parts[0] ?? '50%'} ${String(value as string | number)}` });
    },
    [layer, onChange]
  );

  const handleStopsChange = useCallback((stops: GradientStop[]) => onChange?.({ ...layer, stops }), [layer, onChange]);

  return (
    <>
      <CategorySection label="Start Angle">
        <CategoryOption
          type="metric"
          value={layer.conicAngle}
          units={[
            { label: 'deg', value: 'deg' },
            { label: 'rad', value: 'rad' },
            { label: 'turn', value: 'turn' }
          ]}
          min={0}
          max={360}
          onChange={handleAngleChange}
        />
      </CategorySection>
      <CategorySection label="Position">
        <CategoryOption
          type="metric"
          value={layer.conicPosition.split(' ')[0] ?? '50%'}
          allowedWords={['center', 'left', 'right']}
          onChange={handlePositionXChange}
        />
        <CategoryOption
          type="metric"
          value={layer.conicPosition.split(' ')[1] ?? '50%'}
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

export default ConicGradientMode;
