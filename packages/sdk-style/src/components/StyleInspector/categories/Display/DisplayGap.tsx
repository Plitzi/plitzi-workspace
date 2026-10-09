import { useCallback, useMemo } from 'react';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

/** The two gaps each layout writes. */
const GAPS = {
  flex: { row: 'row-gap', column: 'column-gap' },
  grid: { row: 'grid-row-gap', column: 'grid-column-gap' }
} as const satisfies Record<string, { row: StyleCategory; column: StyleCategory }>;

export type DisplayGapProps = {
  /** Whose gaps: a flex container's, or a grid's. */
  layout: keyof typeof GAPS;
  rowGap?: StyleValue;
  columnGap?: StyleValue;
  onChange?: (type: StyleCategory, value: StyleValue) => void;
};

const DisplayGap = ({ layout, rowGap = '0px', columnGap = '0px', onChange }: DisplayGapProps) => {
  const { row, column } = GAPS[layout];
  // What the section and each control are marked by, as the same lists while the layout is the same.
  const keys = useMemo<Record<'both' | 'row' | 'column', StyleCategory[]>>(
    () => ({ both: [row, column], row: [row], column: [column] }),
    [column, row]
  );

  const handleChangeRow = useCallback(
    (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) => onChange?.(row, itemValue as StyleValue),
    [onChange, row]
  );

  const handleChangeColumn = useCallback(
    (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.(column, itemValue as StyleValue),
    [column, onChange]
  );

  return (
    <CategorySection label="Gap" keys={keys.both}>
      <CategoryOption keys={keys.row} label="Row" value={rowGap} onChange={handleChangeRow} type="metric" />
      <CategoryOption keys={keys.column} label="Column" value={columnGap} onChange={handleChangeColumn} type="metric" />
    </CategorySection>
  );
};

export default DisplayGap;
