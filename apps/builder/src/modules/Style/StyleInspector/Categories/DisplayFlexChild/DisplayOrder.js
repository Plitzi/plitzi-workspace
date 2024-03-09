// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Monorepo
import { ORDER } from '@plitzi/sdk-style/StyleConstants';

// Alias
import Icons from '@pcomponents/Icons/Icons';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

const DisplayOrder = props => {
  const { partialValue, onChange = noop } = props;

  const handleChange = useCallback(itemValue => onChange(itemValue.type, itemValue.value), [onChange]);

  const items = useMemo(
    () => [
      {
        value: { value: '0', type: ORDER },
        children: <Icons width={16} height={16} type="XMark" />,
        description: 'Order Auto',
        active: partialValue === '0'
      },
      {
        value: { value: '-1', type: ORDER },
        children: <div className="text-xs select-none">First</div>,
        description: 'Order First',
        active: partialValue === '-1'
      },
      {
        value: { value: '1', type: ORDER },
        children: <div className="text-xs select-none">Last</div>,
        description: 'Order Last',
        active: partialValue === '1'
      },
      { type: 'input', value: partialValue, extraValue: { type: ORDER } }
    ],
    [partialValue]
  );

  return (
    <GroupButtons classNameContainer="w-[180px]" items={items} label="Order" keyValue={ORDER} onChange={handleChange} />
  );
};

DisplayOrder.propTypes = {
  partialValue: PropTypes.string,
  onChange: PropTypes.func
};

export default DisplayOrder;
