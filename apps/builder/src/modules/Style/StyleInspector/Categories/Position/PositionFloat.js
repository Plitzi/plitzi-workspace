// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { FLOAT, LEFT, RIGHT } from '@plitzi/sdk-style/StyleConstants';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

/**
 * @param {{
 *   partialValue: string;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
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

export default PositionFloat;
