// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { GRID_COLUMN_GAP, GRID_ROW_GAP } from '@plitzi/sdk-shared/style/styleConstants';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

/**
 * @param {{
 *   rowGap: string;
 *   columnGap: string;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const DisplayGridGap = props => {
  const { rowGap = '0px', columnGap = '0px', onChange = noop } = props;

  const handleChange = useCallback(itemValue => onChange(itemValue.type, itemValue.value), [onChange]);

  const items = useMemo(
    () => [
      {
        type: 'inputMetric',
        value: rowGap,
        extraValue: { type: GRID_ROW_GAP },
        keyValue: GRID_ROW_GAP,
        label: 'Row'
      },
      {
        type: 'inputMetric',
        value: columnGap,
        extraValue: { type: GRID_COLUMN_GAP },
        keyValue: GRID_COLUMN_GAP,
        label: 'Column'
      }
    ],
    [rowGap, columnGap]
  );

  const keyValue = useMemo(() => [GRID_ROW_GAP, GRID_COLUMN_GAP], []);

  return (
    <GroupButtons
      className="w-full"
      classNameContainer="w-[180px]"
      items={items}
      keyValue={keyValue}
      label="Gap"
      onChange={handleChange}
    />
  );
};

export default DisplayGridGap;
