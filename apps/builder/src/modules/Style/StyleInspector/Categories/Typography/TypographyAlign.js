// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Alias
import { TEXT_ALIGN } from '@pmodules/Style/StyleConstants';
import Icons from '@pcomponents/Icons';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

const TypographyAlign = props => {
  const { partialValue, onChange = noop } = props;

  const handleChange = useCallback(itemValue => onChange(itemValue), [onChange]);

  const items = useMemo(
    () => [
      {
        value: { value: 'left', type: TEXT_ALIGN },
        children: <Icons width={16} height={16} type="TextAlignLeft" />,
        description: 'Left',
        active: partialValue === 'left'
      },
      {
        value: { value: 'center', type: TEXT_ALIGN },
        children: <Icons width={16} height={16} type="TextAlignCenter" />,
        description: 'Center',
        active: partialValue === 'center'
      },
      {
        value: { value: 'right', type: TEXT_ALIGN },
        children: <Icons width={16} height={16} type="TextAlignRight" />,
        description: 'Right',
        active: partialValue === 'right'
      },
      {
        value: { value: 'justify', type: TEXT_ALIGN },
        children: <Icons width={16} height={16} type="TextAlignJustify" />,
        description: 'Justify',
        active: partialValue === 'justify'
      }
    ],
    [partialValue]
  );

  return (
    <GroupButtons
      className="w-full"
      classNameContainer="w-[180px]"
      items={items}
      label="Align"
      keyValue={TEXT_ALIGN}
      onChange={handleChange}
    />
  );
};

TypographyAlign.propTypes = {
  partialValue: PropTypes.string,
  onChange: PropTypes.func
};

export default TypographyAlign;
