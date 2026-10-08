import { useCallback } from 'react';

import { ANGLE_UNITS, LINEAR_DIRECTIONS } from './helpers';
import CategoryOption from '../../../components/CategoryOption';
import CategorySection from '../../../components/CategorySection';
import { asText } from '../../../cssValues';
import GradientStopBar from '../components/GradientStopBar';

import type { BackgroundLayer, GradientStop } from '../helpers/backgroundParser';
import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type LinearGradientModeProps = {
  layer: BackgroundLayer;
  onChange?: (layer: BackgroundLayer) => void;
};

const LinearGradientMode = ({ layer, onChange }: LinearGradientModeProps) => {
  const handleAngleChange = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => onChange?.({ ...layer, angle: asText(value) }),
    [layer, onChange]
  );

  const handleStopsChange = useCallback((stops: GradientStop[]) => onChange?.({ ...layer, stops }), [layer, onChange]);

  return (
    <>
      <CategorySection label="Direction">
        <CategoryOption
          type="metric"
          value={layer.angle || 'to bottom'}
          units={ANGLE_UNITS}
          allowedWords={LINEAR_DIRECTIONS}
          min={-Infinity}
          onChange={handleAngleChange}
        />
      </CategorySection>
      <GradientStopBar stops={layer.stops} onChange={handleStopsChange} />
    </>
  );
};

export default LinearGradientMode;
