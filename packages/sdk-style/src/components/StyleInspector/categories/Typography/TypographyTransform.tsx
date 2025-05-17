import TextDirectionLtr from '@plitzi/plitzi-ui/icons/TextDirectionLtr';
import TextDirectionRtl from '@plitzi/plitzi-ui/icons/TextDirectionRtl';
import XMark from '@plitzi/plitzi-ui/icons/XMark';
import { useMemo } from 'react';

import { TEXT_TRANSFORM, DIRECTION } from '@plitzi/sdk-shared/style/StyleConstants';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type TypographyTransformProps = {
  textTransform?: StyleValue;
  direction?: StyleValue;
  onChange?: (category: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const TypographyTransform = ({ textTransform, direction, onChange }: TypographyTransformProps) => {
  const itemsTransform = useMemo(
    () => [
      {
        value: 'none',
        icon: <XMark />,
        description: 'None',
        active: textTransform === 'none'
      },
      {
        value: 'uppercase',
        icon: <span>AA</span>,
        size: 'custom' as const,
        description: 'All Caps',
        active: textTransform === 'uppercase'
      },
      {
        value: 'capitalize',
        icon: <span>Aa</span>,
        size: 'custom' as const,
        description: 'Capitalize Every Word',
        active: textTransform === 'capitalize'
      },
      {
        value: 'lowercase',
        icon: <span>aa</span>,
        size: 'custom' as const,
        description: 'Lower Case',
        active: textTransform === 'lowercase'
      }
    ],
    [textTransform]
  );

  const itemsDirection = useMemo(
    () => [
      {
        value: 'ltr',
        icon: <TextDirectionLtr />,
        description: 'Left To Right',
        active: direction === 'ltr'
      },
      {
        value: 'rtl',
        icon: <TextDirectionRtl />,
        description: 'Right To Left',
        active: direction === 'rtl'
      }
    ],
    [direction]
  );

  return (
    <>
      <CategorySection label="Capitalize" keys={[TEXT_TRANSFORM]}>
        <CategoryOption onChange={onChange?.(TEXT_TRANSFORM)} type="iconGroup" items={itemsTransform} />
      </CategorySection>
      <CategorySection label="Direction" keys={[DIRECTION]}>
        <CategoryOption onChange={onChange?.(DIRECTION)} type="iconGroup" items={itemsDirection} />
      </CategorySection>
    </>
  );
};

export default TypographyTransform;
