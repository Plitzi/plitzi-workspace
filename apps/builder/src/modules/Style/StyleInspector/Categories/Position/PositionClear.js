// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { CLEAR } from '@plitzi/sdk-style/StyleConstants';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

/**
 * @param {{
 *   partialValue: string;
 *   onChange?: (value: { type: string; value: string }) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const PositionClear = props => {
  const { partialValue, onChange = noop } = props;

  const handleChange = useCallback(itemValue => onChange(itemValue), [onChange]);

  const items = useMemo(
    () => [
      {
        value: { value: 'none', type: CLEAR },
        children: <Icons width={16} height={16} type="XMark" />,
        description: 'Static',
        active: partialValue === 'none'
      },
      {
        value: { value: 'left', type: CLEAR },
        children: <Icons width={16} height={16} type="ClearLeft" />,
        description: 'Clear Left',
        active: partialValue === 'left'
      },
      {
        value: { value: 'right', type: CLEAR },
        children: <Icons width={16} height={16} type="ClearRight" />,
        description: 'Clear Right',
        active: partialValue === 'right'
      },
      {
        value: { value: 'both', type: CLEAR },
        children: <Icons width={16} height={16} type="ClearBoth" />,
        description: 'Clear Both',
        active: partialValue === 'both'
      }
    ],
    [partialValue]
  );

  return (
    <GroupButtons
      className="w-full"
      classNameContainer="w-[180px]"
      items={items}
      label="Clear"
      keyValue={CLEAR}
      onChange={handleChange}
    />
  );
};

export default PositionClear;
