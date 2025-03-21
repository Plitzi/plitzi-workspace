// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { OVERFLOW } from '@plitzi/sdk-shared/style';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

/**
 * @param {{
 *   value: string;
 *   onChange?: (value: { type: string; value: string }) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const SizeOverflow = props => {
  const { value, onChange = noop } = props;

  const handleChange = useCallback(itemValue => onChange(itemValue), [onChange]);

  const items = useMemo(
    () => [
      {
        value: { value: 'visible', type: OVERFLOW },
        children: <Icons width={16} height={16} type="Eye" />,
        description: 'Visible',
        active: value === 'visible'
      },
      {
        value: { value: 'hidden', type: OVERFLOW },
        children: <Icons width={16} height={16} type="EyeOff" />,
        description: 'Hidden',
        active: value === 'hidden'
      },
      {
        value: { value: 'scroll', type: OVERFLOW },
        children: <Icons width={16} height={16} type="SizeOverflowScroll" />,
        description: 'Scroll',
        active: value === 'scroll'
      },
      {
        value: { value: 'auto', type: OVERFLOW },
        children: <div className="text-xs select-none px-1">Auto</div>,
        description: '',
        active: value === 'auto'
      }
    ],
    [value]
  );

  return (
    <GroupButtons
      className="w-full"
      classNameContainer="w-[180px]"
      items={items}
      label="Overflow"
      keyValue={OVERFLOW}
      onChange={handleChange}
    />
  );
};

export default SizeOverflow;
