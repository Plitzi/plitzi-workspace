import { useCallback } from 'react';

import CategoryOption from '../../../components/CategoryOption';
import CategorySection from '../../../components/CategorySection';
import BackgroundSize from '../components/BackgroundSize';
import GradientStopBar from '../components/GradientStopBar';

import type { BackgroundLayer, GradientStop } from '../helpers/backgroundParser';

export type LinearGradientModeProps = {
  layer: BackgroundLayer;
  onChange?: (layer: BackgroundLayer) => void;
};

const LinearGradientMode = ({ layer, onChange }: LinearGradientModeProps) => {
  const handleAngleChange = useCallback(
    (value: unknown) => onChange?.({ ...layer, angle: String(value) }),
    [layer, onChange]
  );

  const handleStopsChange = useCallback((stops: GradientStop[]) => onChange?.({ ...layer, stops }), [layer, onChange]);

  return (
    <>
      <CategorySection label="Angle">
        <CategoryOption
          type="metric"
          value={layer.angle}
          units={[
            { label: 'deg', value: 'deg' },
            { label: 'rad', value: 'rad' },
            { label: 'turn', value: 'turn' }
          ]}
          allowedWords={[
            'to top',
            'to right',
            'to bottom',
            'to left',
            'to top right',
            'to bottom right',
            'to bottom left',
            'to top left'
          ]}
          min={0}
          max={360}
          onChange={handleAngleChange}
        />
      </CategorySection>
      <CategorySection label="Gradient" direction="column">
        <GradientStopBar stops={layer.stops} onChange={handleStopsChange} />
      </CategorySection>
      <BackgroundSize layer={layer} onChange={onChange} />
    </>
  );
};

export default LinearGradientMode;
