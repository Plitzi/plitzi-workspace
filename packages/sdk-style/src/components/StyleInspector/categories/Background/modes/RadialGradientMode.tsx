import { useCallback } from 'react';

import {
  CENTER_X_WORDS,
  CENTER_Y_WORDS,
  centerParts,
  customExtentFor,
  isExtentKeyword,
  joinCenter,
  RADIAL_EXTENTS
} from './helpers';
import CategoryOption from '../../../components/CategoryOption';
import CategorySection from '../../../components/CategorySection';
import { asText } from '../../../cssValues';
import GradientStopBar from '../components/GradientStopBar';

import type { BackgroundLayer, GradientStop } from '../helpers/backgroundParser';
import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type RadialGradientModeProps = {
  layer: BackgroundLayer;
  onChange?: (layer: BackgroundLayer) => void;
};

type OptionValue = StyleValue | Record<StyleCategory, StyleValue> | boolean;

const CUSTOM = 'custom';

const RadialGradientMode = ({ layer, onChange }: RadialGradientModeProps) => {
  const [centerX, centerY] = centerParts(layer.radialPosition);
  const customExtent = !isExtentKeyword(layer.radialExtent);

  const handleShapeChange = useCallback(
    (value: OptionValue) => onChange?.({ ...layer, radialShape: asText(value) === 'circle' ? 'circle' : 'ellipse' }),
    [layer, onChange]
  );

  const handleExtentKindChange = useCallback(
    (value: OptionValue) => {
      const kind = asText(value);
      onChange?.({ ...layer, radialExtent: kind === CUSTOM ? customExtentFor(layer.radialShape) : kind });
    },
    [layer, onChange]
  );

  const handleExtentChange = useCallback(
    (value: OptionValue) => onChange?.({ ...layer, radialExtent: asText(value) }),
    [layer, onChange]
  );

  const handleCenterXChange = useCallback(
    (value: OptionValue) => onChange?.({ ...layer, radialPosition: joinCenter(asText(value), centerY) }),
    [centerY, layer, onChange]
  );

  const handleCenterYChange = useCallback(
    (value: OptionValue) => onChange?.({ ...layer, radialPosition: joinCenter(centerX, asText(value)) }),
    [centerX, layer, onChange]
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
      <CategorySection label="Extent">
        <CategoryOption
          type="select"
          value={customExtent ? CUSTOM : layer.radialExtent}
          onChange={handleExtentKindChange}
        >
          {RADIAL_EXTENTS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          <option value={CUSTOM}>Custom size</option>
        </CategoryOption>
      </CategorySection>
      {customExtent && (
        <CategorySection label="Radius">
          <CategoryOption type="input" value={layer.radialExtent} onChange={handleExtentChange} />
        </CategorySection>
      )}
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

export default RadialGradientMode;
