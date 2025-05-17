import { useCallback } from 'react';

import { OBJECT_POSITION } from '@plitzi/sdk-shared/style/StyleConstants';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type SizePositionProps = {
  value?: StyleValue;
  onChange?: (type: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const SizePosition = ({ value, onChange }: SizePositionProps) => {
  const valueParts = (value as string).split(' ');

  const handleChange = useCallback(
    (type: string) => (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
      const valueAux = [...valueParts];
      if (type === 'left') {
        valueAux[0] = itemValue as string;
      } else if (type === 'top') {
        valueAux[1] = itemValue as string;
      }

      onChange?.(OBJECT_POSITION)(valueAux.join(' ') as StyleValue);
    },
    [onChange, valueParts]
  );

  return (
    <CategorySection label="Object Pos" keys={[OBJECT_POSITION]}>
      <CategoryOption
        label="Left"
        direction="column"
        value={valueParts[0]}
        onChange={handleChange('left')}
        type="metric"
      />
      <CategoryOption
        label="Top"
        direction="column"
        value={valueParts[1]}
        onChange={handleChange('top')}
        type="metric"
      />
    </CategorySection>
  );
};

export default SizePosition;
