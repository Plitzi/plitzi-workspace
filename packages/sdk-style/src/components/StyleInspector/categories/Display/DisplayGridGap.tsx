import { useCallback } from 'react';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type DisplayGridGapProps = {
  rowGap?: StyleValue;
  columnGap?: StyleValue;
  onChange?: (type: StyleCategory, value: StyleValue) => void;
};

const keyValues: StyleCategory[] = ['grid-row-gap', 'grid-column-gap'];
const keyValues1: StyleCategory[] = ['grid-row-gap'];
const keyValues2: StyleCategory[] = ['grid-column-gap'];

const DisplayGridGap = ({ rowGap = '0px', columnGap = '0px', onChange }: DisplayGridGapProps) => {
  const handleChangeRow = useCallback(
    (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.('grid-row-gap', itemValue as StyleValue),
    [onChange]
  );

  const handleChangeColumn = useCallback(
    (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.('grid-column-gap', itemValue as StyleValue),
    [onChange]
  );

  return (
    <CategorySection label="Gap" keys={keyValues}>
      <CategoryOption keys={keyValues1} label="Row" value={rowGap} onChange={handleChangeRow} type="metric" />
      <CategoryOption keys={keyValues2} label="Column" value={columnGap} onChange={handleChangeColumn} type="metric" />
    </CategorySection>
  );
};

export default DisplayGridGap;
