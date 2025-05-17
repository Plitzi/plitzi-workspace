// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { TEXT_ALIGN } from '@plitzi/sdk-shared/style/StyleConstants';

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

export default TypographyAlign;
