import { useMemo } from 'react';

import { TEXT_ALIGN } from '@plitzi/sdk-shared/style';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type TypographyAlignProps = {
  partialValue?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const TypographyAlign = ({ partialValue, onChange }: TypographyAlignProps) => {
  const items = useMemo(
    () => [
      {
        value: 'left',
        icon: 'fa-solid fa-align-left',
        description: 'Left',
        active: partialValue === 'left'
      },
      {
        value: 'center',
        icon: 'fa-solid fa-align-center',
        description: 'Center',
        active: partialValue === 'center'
      },
      {
        value: 'right',
        icon: 'fa-solid fa-align-right',
        description: 'Right',
        active: partialValue === 'right'
      },
      {
        value: 'justify',
        icon: 'fa-solid fa-align-justify',
        description: 'Justify',
        active: partialValue === 'justify'
      }
    ],
    [partialValue]
  );

  return (
    <CategorySection label="Align" keys={[TEXT_ALIGN]}>
      <CategoryOption onChange={onChange} type="iconGroup" items={items} />
    </CategorySection>
  );
};

export default TypographyAlign;
