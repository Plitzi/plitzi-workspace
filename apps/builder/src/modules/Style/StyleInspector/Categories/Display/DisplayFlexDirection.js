// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { FLEX_DIRECTION } from '@plitzi/sdk-shared/style';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

/**
 * @param {{
 *   value: string;
 *   isReverse?: boolean;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const DisplayFlexDirection = props => {
  const { value, isReverse = false, onChange = noop } = props;

  const handleChange = useCallback(
    itemValue => {
      switch (itemValue.type) {
        case 'reverseDirection': {
          if (itemValue.value) {
            onChange(FLEX_DIRECTION, `${value}-reverse`);
          } else {
            onChange(FLEX_DIRECTION, value.replace('-reverse', ''));
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
        value: { value: isReverse ? 'row-reverse' : 'row', type: FLEX_DIRECTION },
        children: <div className="text-xs select-none px-1">Horizontal</div>,
        description: '',
        active: value === 'row' || value === 'row-reverse'
      },
      {
        value: { value: isReverse ? 'column-reverse' : 'column', type: FLEX_DIRECTION },
        children: <div className="text-xs select-none px-1">Vertical</div>,
        description: '',
        active: value === 'column' || value === 'column-reverse'
      },
      {
        value: { value: !isReverse, type: 'reverseDirection' },
        children: <Icons type="ArrowReverse" width={16} height={16} />,
        description: 'Reverse Direction',
        active: isReverse
      }
    ],
    [value, isReverse]
  );

  return (
    <GroupButtons
      classNameContainer="w-[180px]"
      items={items}
      label="Direction"
      keyValue={FLEX_DIRECTION}
      onChange={handleChange}
    />
  );
};

export default DisplayFlexDirection;
