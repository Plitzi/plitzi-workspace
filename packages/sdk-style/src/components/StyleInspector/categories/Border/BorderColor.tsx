import { useMemo } from 'react';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type BorderColorProps = {
  values: Record<StyleCategory, StyleValue | undefined>;
  currentPlacement: string;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const BorderColor = ({ values, currentPlacement, onChange }: BorderColorProps) => {
  const value = useMemo(() => {
    const {
      'border-top-color': borderTop,
      'border-bottom-color': borderBottom,
      'border-left-color': borderLeft,
      'border-right-color': borderRight
    } = values;
    switch (true) {
      case currentPlacement === 'all':
        if (borderTop === borderBottom && borderTop === borderLeft && borderTop === borderRight) {
          return borderTop;
        }

        return '#000000';
      case currentPlacement === 'top':
        return borderTop;

      case currentPlacement === 'bottom':
        return borderBottom;

      case currentPlacement === 'left':
        return borderLeft;

      case currentPlacement === 'right':
        return borderRight;

      default:
        return '#000000';
    }
  }, [values, currentPlacement]);
  const keyValues = useMemo(() => {
    if (currentPlacement === 'all') {
      return ['border-top-color', 'border-bottom-color', 'border-left-color', 'border-right-color'] as StyleCategory[];
    }

    return [`border-${currentPlacement}-color`] as StyleCategory[];
  }, [currentPlacement]);

  return (
    <CategorySection label="Color" keys={keyValues}>
      <CategoryOption value={value} onChange={onChange} type="color" />
    </CategorySection>
  );
};

export default BorderColor;
