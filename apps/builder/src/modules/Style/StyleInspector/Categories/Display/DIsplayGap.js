// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Alias
import { GAP } from '@pmodules/Style/StyleConstants';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

const DisplayGap = props => {
  const { partialValue = '', onChange = noop } = props;

  const handleChange = useCallback(itemValue => onChange(itemValue.type, itemValue.value), [onChange]);

  const items = useMemo(
    () => [{ type: 'inputMetric', value: partialValue, extraValue: { type: GAP } }],
    [partialValue]
  );

  return (
    <GroupButtons
      className="w-full"
      classNameContainer="w-[180px]"
      items={items}
      label="Gap"
      keyValue={GAP}
      onChange={handleChange}
    />
  );
};

DisplayGap.propTypes = {
  partialValue: PropTypes.string,
  onChange: PropTypes.func
};

export default DisplayGap;
