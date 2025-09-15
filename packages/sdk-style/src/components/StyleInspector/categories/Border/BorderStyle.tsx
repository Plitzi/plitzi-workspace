import BorderStyleDashed from '@plitzi/plitzi-ui/icons/BorderStyleDashed';
import BorderStyleDotted from '@plitzi/plitzi-ui/icons/BorderStyleDotted';
import BorderStyleSolid from '@plitzi/plitzi-ui/icons/BorderStyleSolid';
import XMark from '@plitzi/plitzi-ui/icons/XMark';
import { useMemo } from 'react';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type BorderStyleProps = {
  values: Record<StyleCategory, StyleValue | undefined>;
  currentPlacement: string;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const BorderStyle = ({ values, currentPlacement, onChange }: BorderStyleProps) => {
  const value = useMemo(() => {
    const {
      'border-top-style': borderTop,
      'border-bottom-style': borderBottom,
      'border-left-style': borderLeft,
      'border-right-style': borderRight
    } = values;
    switch (true) {
      case currentPlacement === 'all':
        if (borderTop === borderBottom && borderTop === borderLeft && borderTop === borderRight) {
          return borderTop;
        }

        return 'solid';
      case currentPlacement === 'top':
        return borderTop;

      case currentPlacement === 'bottom':
        return borderBottom;

      case currentPlacement === 'left':
        return borderLeft;

      case currentPlacement === 'right':
        return borderRight;

      default:
        return 'solid';
    }
  }, [values, currentPlacement]);

  const items = useMemo(
    () => [
      {
        value: 'none',
        icon: <XMark />,
        description: '',
        active: value === 'none'
      },
      {
        value: 'solid',
        icon: <BorderStyleSolid />,
        description: '',
        active: value === 'solid'
      },
      {
        value: 'dashed',
        icon: <BorderStyleDashed />,
        description: '',
        active: value === 'dashed'
      },
      {
        value: 'dotted',
        icon: <BorderStyleDotted />,
        description: '',
        active: value === 'dotted'
      }
    ],
    [value]
  );

  const keyValues = useMemo(() => {
    if (currentPlacement === 'all') {
      return ['border-top-style', 'border-bottom-style', 'border-left-style', 'border-right-style'] as StyleCategory[];
    }

    return [`border-${currentPlacement}-style`] as StyleCategory[];
  }, [currentPlacement]);

  return (
    <CategorySection label="Style" keys={keyValues}>
      <CategoryOption onChange={onChange} items={items} type="iconGroup" />
    </CategorySection>
  );
};

export default BorderStyle;
