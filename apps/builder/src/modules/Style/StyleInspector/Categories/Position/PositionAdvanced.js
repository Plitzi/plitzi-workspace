// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Monorepo
import { TOP, BOTTOM, LEFT, RIGHT } from '@plitzi/sdk-style/StyleConstants';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

const PositionAdvanced = props => {
  const { partialValue, onChange = noop } = props;

  const handleChange = useCallback(itemValue => onChange(itemValue), [onChange]);

  const { [TOP]: top, [BOTTOM]: bottom, [LEFT]: left, [RIGHT]: right } = partialValue;

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
        items={itemsTB}
        label="X"
        onChange={handleChange}
      />
      <GroupButtons
        className="w-full"
        classNameContainer="w-[180px]"
        items={itemsLR}
        label="Y"
        onChange={handleChange}
      />
    </>
  );
};

PositionAdvanced.propTypes = {
  partialValue: PropTypes.object,
  onChange: PropTypes.func
};

export default PositionAdvanced;
