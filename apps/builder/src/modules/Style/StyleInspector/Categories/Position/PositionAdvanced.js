// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { TOP, BOTTOM, LEFT, RIGHT } from '@plitzi/sdk-style/StyleConstants';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

const keyValueX = [LEFT, RIGHT];
const keyValueY = [TOP, BOTTOM];

/**
 * @param {{
 *   value: object;
 *   onChange?: (value: { type: string; value: string }) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const PositionAdvanced = props => {
  const { value, onChange = noop } = props;

  const handleChange = useCallback(itemValue => onChange(itemValue), [onChange]);

  const { [TOP]: top, [BOTTOM]: bottom, [LEFT]: left, [RIGHT]: right } = value;

  const itemsTB = useMemo(
    () => [
      { type: 'inputMetric', value: top, extraValue: { type: TOP }, keyValue: TOP, label: 'Top' },
      { type: 'inputMetric', value: bottom, extraValue: { type: BOTTOM }, keyValue: BOTTOM, label: 'Bottom' }
    ],
    [top, bottom, handleChange]
  );

  const itemsLR = useMemo(
    () => [
      { type: 'inputMetric', value: left, extraValue: { type: LEFT }, keyValue: LEFT, label: 'Left' },
      { type: 'inputMetric', value: right, extraValue: { type: RIGHT }, keyValue: RIGHT, label: 'Right' }
    ],
    [left, right, handleChange]
  );

  return (
    <>
      <GroupButtons
        className="w-full"
        classNameContainer="w-[180px]"
        items={itemsLR}
        keyValue={keyValueX}
        label="X"
        onChange={handleChange}
      />
      <GroupButtons
        className="w-full"
        classNameContainer="w-[180px]"
        items={itemsTB}
        keyValue={keyValueY}
        label="Y"
        onChange={handleChange}
      />
    </>
  );
};

export default PositionAdvanced;
