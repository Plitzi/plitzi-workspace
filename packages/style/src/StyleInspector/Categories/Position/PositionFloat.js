// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Alias
import Icons from '@pcomponents/Icons';
import { FLOAT, LEFT, RIGHT } from '@pmodules/Style/StyleConstants';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

const PositionFloat = props => {
  const { partialValue, onChange = noop } = props;

  const handleChange = useCallback(itemValue => onChange(itemValue), [onChange]);

  const items = useMemo(
    () => [
      {
        value: { value: 'none', type: FLOAT },
        children: <Icons width={16} height={16} type="XMark" />,
        description: 'Static',
        active: partialValue === 'none'
      },
      {
        value: { value: LEFT, type: FLOAT },
        children: <Icons width={16} height={16} type="FloatLeft" />,
        description: 'Float Left',
        active: partialValue === LEFT
      },
      {
        value: { value: RIGHT, type: FLOAT },
        children: <Icons width={16} height={16} type="FloatRight" />,
        description: 'Float Right',
        active: partialValue === RIGHT
      }
    ],
    [partialValue]
  );

  return (
    <GroupButtons
      className="w-full"
      classNameContainer="w-[180px]"
      items={items}
      label="Float"
      keyValue={FLOAT}
      onChange={handleChange}
    />
  );
};

PositionFloat.propTypes = {
  partialValue: PropTypes.string,
  onChange: PropTypes.func
};

export default PositionFloat;
