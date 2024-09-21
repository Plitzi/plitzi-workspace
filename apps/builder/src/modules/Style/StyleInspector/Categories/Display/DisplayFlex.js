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
 *   value: string;
 *   isReverse: boolean;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const DisplayFlex = props => {
  const { value, isReverse = false, onChange = noop } = props;

  const handleChange = useCallback(
    itemValue => {
      switch (itemValue.type) {
        case 'reverseWrap': {
          if (itemValue.value) {
            onChange(FLEX_WRAP, `${value}-reverse`);
          } else {
            onChange(FLEX_WRAP, value.replace('-reverse', ''));
          }

          break;
        }
        default:
          onChange(itemValue.type, itemValue.value);
          break;
      }
    },
    [onChange, value]
  );

  const items = useMemo(
    () => [
      {
        value: { value: isReverse ? 'nowrap-reverse' : 'nowrap', type: FLEX_WRAP },
        children: <div className="text-xs whitespace-nowrap select-none px-1">Don&apos;t Wrap</div>,
        description: '',
        active: value === 'nowrap' || value === 'nowrap-reverse'
      },
      {
        value: { value: isReverse ? 'wrap-reverse' : 'wrap', type: FLEX_WRAP },
        children: <div className="text-xs select-none px-1">Wrap</div>,
        description: '',
        active: value === 'wrap' || value === 'wrap-reverse'
      },
      {
        value: { value: !isReverse, type: 'reverseWrap' },
        children: <Icons type="ArrowReverse" width={16} height={16} />,
        description: 'Reverse Wrap',
        active: isReverse
      }
    ],
    [value, isReverse]
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
