// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { FLEX_WRAP } from '@plitzi/sdk-style/StyleConstants';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

/**
 * @param {{
 *   partialValue: string;
 *   wrapValue: string;
 *   isReverse: boolean;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const DisplayFlex = props => {
  const { partialValue, wrapValue, isReverse = false, onChange = noop } = props;

  const handleChange = useCallback(
    itemValue => {
      const { value, type } = itemValue;
      switch (type) {
        case 'reverseWrap': {
          if (value) {
            onChange(FLEX_WRAP, `${wrapValue}-reverse`);
          } else {
            onChange(FLEX_WRAP, wrapValue.replace('-reverse', ''));
          }

          break;
        }
        default:
          onChange(type, value);
          break;
      }
    },
    [onChange, partialValue, wrapValue]
  );

  const items = useMemo(
    () => [
      {
        value: { value: isReverse ? 'nowrap-reverse' : 'nowrap', type: FLEX_WRAP },
        children: <div className="text-xs whitespace-nowrap select-none px-1">Don&apos;t Wrap</div>,
        description: '',
        active: partialValue === 'nowrap' || partialValue === 'nowrap-reverse'
      },
      {
        value: { value: isReverse ? 'wrap-reverse' : 'wrap', type: FLEX_WRAP },
        children: <div className="text-xs select-none px-1">Wrap</div>,
        description: '',
        active: partialValue === 'wrap' || partialValue === 'wrap-reverse'
      },
      {
        value: { value: !isReverse, type: 'reverseWrap' },
        children: <Icons type="ArrowReverse" width={16} height={16} />,
        description: 'Reverse Wrap',
        active: isReverse
      }
    ],
    [partialValue, isReverse]
  );

  return (
    <GroupButtons
      classNameContainer="w-[180px]"
      items={items}
      label="Children"
      keyValue={FLEX_WRAP}
      onChange={handleChange}
    />
  );
};

export default DisplayFlex;
