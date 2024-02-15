// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Alias
import { OBJECT_POSITION } from '@pmodules/Style/StyleConstants';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

const SizePosition = props => {
  const { onChange = noop } = props;
  let { partialValue } = props;

  partialValue = partialValue.split(' ');

  const handleChange = useCallback(
    itemValue => {
      const { subType, type, value } = itemValue;
      if (subType === 'left') {
        partialValue[0] = value;
      } else if (subType === 'top') {
        partialValue[1] = value;
      }

      onChange({ type, value: partialValue.join(' ') });
    },
    [onChange, partialValue]
  );

  const itemsSize = useMemo(
    () => [
      {
        type: 'inputMetric',
        value: partialValue[0],
        extraValue: { type: OBJECT_POSITION, subType: 'left' },
        label: 'Left'
      },
      {
        type: 'inputMetric',
        value: partialValue[1],
        extraValue: { type: OBJECT_POSITION, subType: 'top' },
        label: 'Top'
      }
    ],
    [partialValue[0], partialValue[1]]
  );

  return (
    <GroupButtons
      className="w-full"
      classNameContainer="w-[180px]"
      keyValue={OBJECT_POSITION}
      items={itemsSize}
      label="Object Position"
      onChange={handleChange}
    />
  );
};

SizePosition.propTypes = {
  partialValue: PropTypes.string,
  onChange: PropTypes.func
};

export default SizePosition;
