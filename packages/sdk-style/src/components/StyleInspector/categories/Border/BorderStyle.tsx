import BorderStyleDashed from '@plitzi/plitzi-ui/icons/BorderStyleDashed';
import BorderStyleDotted from '@plitzi/plitzi-ui/icons/BorderStyleDotted';
import BorderStyleSolid from '@plitzi/plitzi-ui/icons/BorderStyleSolid';
import XMark from '@plitzi/plitzi-ui/icons/XMark';
import { useMemo } from 'react';

import {
  BORDER_TOP_STYLE,
  BORDER_BOTTOM_STYLE,
  BORDER_LEFT_STYLE,
  BORDER_RIGHT_STYLE
} from '@plitzi/sdk-shared/style/styleConstants';

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
      [BORDER_TOP_STYLE]: borderTop,
      [BORDER_BOTTOM_STYLE]: borderBottom,
      [BORDER_LEFT_STYLE]: borderLeft,
      [BORDER_RIGHT_STYLE]: borderRight
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
      return [BORDER_TOP_STYLE, BORDER_BOTTOM_STYLE, BORDER_LEFT_STYLE, BORDER_RIGHT_STYLE] as StyleCategory[];
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
