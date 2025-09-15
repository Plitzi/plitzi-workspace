import { useMemo } from 'react';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type BorderWidthProps = {
  values: Record<StyleCategory, StyleValue | undefined>;
  currentPlacement: string;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const BorderWidth = ({ values, currentPlacement, onChange }: BorderWidthProps) => {
  const value = useMemo(() => {
    const {
      'border-top-width': borderTop,
      'border-bottom-width': borderBottom,
      'border-left-width': borderLeft,
      'border-right-width': borderRight
    } = values;
    switch (true) {
      case currentPlacement === 'all':
        if (borderTop === borderBottom && borderTop === borderLeft && borderTop === borderRight) {
          return borderTop;
        }

        return '0px';
      case currentPlacement === 'top':
        return borderTop;

      case currentPlacement === 'bottom':
        return borderBottom;

      case currentPlacement === 'left':
        return borderLeft;

      case currentPlacement === 'right':
        return borderRight;

      default:
        return '0px';
    }
  }, [values, currentPlacement]);
  const keyValues = useMemo(() => {
    if (currentPlacement === 'all') {
      return ['border-top-width', 'border-bottom-width', 'border-left-width', 'border-right-width'] as StyleCategory[];
    }

    return [`border-${currentPlacement}-width`] as StyleCategory[];
  }, [currentPlacement]);
  return (
    <CategorySection label="Width" keys={keyValues}>
      <CategoryOption value={value} onChange={onChange} type="metric" />
    </CategorySection>
  );
};

export default BorderWidth;
