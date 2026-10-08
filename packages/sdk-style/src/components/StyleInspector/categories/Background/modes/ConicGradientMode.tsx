import { useCallback } from 'react';

import { ANGLE_UNITS, CENTER_X_WORDS, CENTER_Y_WORDS, centerParts, joinCenter } from './helpers';
import CategoryOption from '../../../components/CategoryOption';
import CategorySection from '../../../components/CategorySection';
import { asText } from '../../../cssValues';
import GradientStopBar from '../components/GradientStopBar';

import type { BackgroundLayer, GradientStop } from '../helpers/backgroundParser';
import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type ConicGradientModeProps = {
  layer: BackgroundLayer;
  onChange?: (layer: BackgroundLayer) => void;
};

type OptionValue = StyleValue | Record<StyleCategory, StyleValue> | boolean;

const ConicGradientMode = ({ layer, onChange }: ConicGradientModeProps) => {
  const [centerX, centerY] = centerParts(layer.conicPosition);

  const handleAngleChange = useCallback(
    (value: OptionValue) => onChange?.({ ...layer, conicAngle: asText(value) }),
    [layer, onChange]
  );

  const handleCenterXChange = useCallback(
    (value: OptionValue) => onChange?.({ ...layer, conicPosition: joinCenter(asText(value), centerY) }),
    [centerY, layer, onChange]
  );

  const handleCenterYChange = useCallback(
    (value: OptionValue) => onChange?.({ ...layer, conicPosition: joinCenter(centerX, asText(value)) }),
    [centerX, layer, onChange]
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
      <CategorySection label="Center">
        <CategoryOption
          type="metric"
          value={centerX}
          allowedWords={CENTER_X_WORDS}
          min={-Infinity}
          onChange={handleCenterXChange}
        />
        <CategoryOption
          type="metric"
          value={centerY}
          allowedWords={CENTER_Y_WORDS}
          min={-Infinity}
          onChange={handleCenterYChange}
        />
      </CategorySection>
      <GradientStopBar stops={layer.stops} onChange={handleStopsChange} />
    </>
  );
};

export default ConicGradientMode;
