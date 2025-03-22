import { useCallback } from 'react';

import { COLUMN_GAP, ROW_GAP } from '@plitzi/sdk-shared/style';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type DisplayGapProps = {
  rowGap?: StyleValue;
  columnGap?: StyleValue;
  onChange?: (type: StyleCategory, value: StyleValue) => void;
};

const keyValues: StyleCategory[] = [ROW_GAP, COLUMN_GAP];
const keyValues1: StyleCategory[] = [ROW_GAP];
const keyValues2: StyleCategory[] = [COLUMN_GAP];

const DisplayGap = ({ rowGap = '0px', columnGap = '0px', onChange }: DisplayGapProps) => {
  const handleChangeRow = useCallback(
    (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.(ROW_GAP, itemValue as StyleValue),
    [onChange]
  );

  const handleChangeColumn = useCallback(
    (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.(COLUMN_GAP, itemValue as StyleValue),
    [onChange]
  );

  return (
    <CategorySection label="Gap" keys={keyValues}>
      <CategoryOption keys={keyValues1} label="Row" value={rowGap} onChange={handleChangeRow} type="metric" />
      <CategoryOption keys={keyValues2} label="Column" value={columnGap} onChange={handleChangeColumn} type="metric" />
    </CategorySection>
  );
};

export default DisplayGap;
