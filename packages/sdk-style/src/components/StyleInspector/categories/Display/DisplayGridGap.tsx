import { useCallback } from 'react';

import { GRID_COLUMN_GAP, GRID_ROW_GAP } from '@plitzi/sdk-shared/style';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type DisplayGridGapProps = {
  rowGap?: StyleValue;
  columnGap?: StyleValue;
  onChange?: (type: StyleCategory, value: StyleValue) => void;
};

const keyValues: StyleCategory[] = [GRID_ROW_GAP, GRID_COLUMN_GAP];
const keyValues1: StyleCategory[] = [GRID_ROW_GAP];
const keyValues2: StyleCategory[] = [GRID_COLUMN_GAP];

const DisplayGridGap = ({ rowGap = '0px', columnGap = '0px', onChange }: DisplayGridGapProps) => {
  const handleChangeRow = useCallback(
    (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.(GRID_ROW_GAP, itemValue as StyleValue),
    [onChange]
  );

  const handleChangeColumn = useCallback(
    (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.(GRID_COLUMN_GAP, itemValue as StyleValue),
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
