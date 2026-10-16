import { useCallback } from 'react';

import CategoryOption from '../../../../components/CategoryOption';
import CategorySection from '../../../../components/CategorySection';
import { asText } from '../../../../cssValues';
import { CENTER_X_WORDS, CENTER_Y_WORDS, centerParts, joinCenter } from '../../modes/helpers';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type GradientCenterProps = {
  /** The gradient's `at …`: `''` is the centre. */
  position: string;
  onChange: (position: string) => void;
};

type OptionValue = StyleValue | Record<StyleCategory, StyleValue> | boolean;

/** Where a radial or conic gradient is centred, as its two halves. */
const GradientCenter = ({ position, onChange }: GradientCenterProps) => {
  const [centerX, centerY] = centerParts(position);

  const handleCenterXChange = useCallback(
    (value: OptionValue) => onChange(joinCenter(asText(value), centerY)),
    [centerY, onChange]
  );

  const handleCenterYChange = useCallback(
    (value: OptionValue) => onChange(joinCenter(centerX, asText(value))),
    [centerX, onChange]
  );

  return (
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
  );
};

export default GradientCenter;
