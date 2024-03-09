// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Monorepo
import { OVERFLOW } from '@plitzi/sdk-style/StyleConstants';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

const SizeOverflow = props => {
  const { partialValue, onChange = noop } = props;

  const handleChange = useCallback(itemValue => onChange(itemValue), [onChange]);

  const items = useMemo(
    () => [
      {
        value: { value: 'visible', type: OVERFLOW },
        children: <Icons width={16} height={16} type="Eye" />,
        description: 'Visible',
        active: partialValue === 'visible'
      },
      {
        value: { value: 'hidden', type: OVERFLOW },
        children: <Icons width={16} height={16} type="EyeOff" />,
        description: 'Hidden',
        active: partialValue === 'hidden'
      },
      {
        value: { value: 'scroll', type: OVERFLOW },
        children: <Icons width={16} height={16} type="SizeOverflowScroll" />,
        description: 'Scroll',
        active: partialValue === 'scroll'
      },
      {
        value: { value: 'auto', type: OVERFLOW },
        children: <div className="text-xs select-none px-1">Auto</div>,
        description: '',
        active: partialValue === 'auto'
      }
    ],
    [partialValue]
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

SizeOverflow.propTypes = {
  partialValue: PropTypes.string,
  onChange: PropTypes.func
};

export default SizeOverflow;
