// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { ORDER } from '@plitzi/sdk-shared/style';

// Alias
import Icons from '@pcomponents/Icons/Icons';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

/**
 * @param {{
 *   value: string;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const DisplayOrder = props => {
  const { value, onChange = noop } = props;

  const handleChange = useCallback(itemValue => onChange(itemValue.type, itemValue.value), [onChange]);

  const items = useMemo(
    () => [
      {
        value: { value: '0', type: ORDER },
        children: <Icons width={16} height={16} type="XMark" />,
        description: 'Order Auto',
        active: value === '0'
      },
      {
        value: { value: '-1', type: ORDER },
        children: <div className="text-xs select-none">First</div>,
        description: 'Order First',
        active: value === '-1'
      },
      {
        value: { value: '1', type: ORDER },
        children: <div className="text-xs select-none">Last</div>,
        description: 'Order Last',
        active: value === '1'
      },
      { type: 'input', value, extraValue: { type: ORDER } }
    ],
    [value]
  );

  return (
    <GroupButtons classNameContainer="w-[180px]" items={items} label="Order" keyValue={ORDER} onChange={handleChange} />
  );
};

export default DisplayOrder;
