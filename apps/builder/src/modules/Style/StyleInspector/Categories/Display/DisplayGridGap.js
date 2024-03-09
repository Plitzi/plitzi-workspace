// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Monorepo
import { GRID_COLUMN_GAP, GRID_ROW_GAP } from '@plitzi/sdk-style/StyleConstants';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

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

DisplayGridGap.propTypes = {
  rowGap: PropTypes.string,
  columnGap: PropTypes.string,
  onChange: PropTypes.func
};

export default DisplayGridGap;
