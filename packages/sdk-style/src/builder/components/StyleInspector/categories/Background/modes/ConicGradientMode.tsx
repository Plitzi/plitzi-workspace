import { useCallback } from 'react';

import { ANGLE_UNITS } from './helpers';
import CategoryOption from '../../../components/CategoryOption';
import CategorySection from '../../../components/CategorySection';
import { asText } from '../../../cssValues';
import GradientCenter from '../components/GradientCenter';
import GradientStopBar from '../components/GradientStopBar';

import type { BackgroundLayer, GradientStop } from '../helpers/backgroundParser';
import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type ConicGradientModeProps = {
  layer: BackgroundLayer;
  onChange?: (layer: BackgroundLayer) => void;
};

type OptionValue = StyleValue | Record<StyleCategory, StyleValue> | boolean;

const ConicGradientMode = ({ layer, onChange }: ConicGradientModeProps) => {
  const handleAngleChange = useCallback(
    (value: OptionValue) => onChange?.({ ...layer, conicAngle: asText(value) }),
    [layer, onChange]
  );

  const handleCenterChange = useCallback(
    (position: string) => onChange?.({ ...layer, conicPosition: position }),
    [layer, onChange]
  );

  const handleStopsChange = useCallback((stops: GradientStop[]) => onChange?.({ ...layer, stops }), [layer, onChange]);

  return (
    <>
      <CategorySection label="Start angle">
        <CategoryOption
          type="metric"
          value={layer.conicAngle}
          units={ANGLE_UNITS}
          min={-Infinity}
          onChange={handleAngleChange}
        />
      </CategorySection>
      <GradientCenter position={layer.conicPosition} onChange={handleCenterChange} />
      <GradientStopBar stops={layer.stops} onChange={handleStopsChange} />
    </>
  );
};

export default ConicGradientMode;
