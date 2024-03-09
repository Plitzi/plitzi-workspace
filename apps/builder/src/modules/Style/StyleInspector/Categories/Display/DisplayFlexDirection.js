// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Monorepo
import { FLEX_DIRECTION } from '@plitzi/sdk-style/StyleConstants';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

const DisplayFlexDirection = props => {
  const { partialValue, directionValue, wrapValue, isReverse = false, onChange = noop } = props;

  const handleChange = useCallback(
    itemValue => {
      const { value, type } = itemValue;
      switch (type) {
        case 'reverseDirection': {
          if (value) {
            onChange(FLEX_DIRECTION, `${directionValue}-reverse`);
          } else {
            onChange(FLEX_DIRECTION, directionValue.replace('-reverse', ''));
          }

          break;
        }

        default:
          onChange(type, value);

          break;
      }
    },
    [onChange, directionValue, wrapValue]
  );

  const items = useMemo(
    () => [
      {
        value: { value: isReverse ? 'row-reverse' : 'row', type: FLEX_DIRECTION },
        children: <div className="text-xs select-none px-1">Horizontal</div>,
        description: '',
        active: partialValue === 'row' || partialValue === 'row-reverse'
      },
      {
        value: { value: isReverse ? 'column-reverse' : 'column', type: FLEX_DIRECTION },
        children: <div className="text-xs select-none px-1">Vertical</div>,
        description: '',
        active: partialValue === 'column' || partialValue === 'column-reverse'
      },
      {
        value: { value: !isReverse, type: 'reverseDirection' },
        children: <Icons type="ArrowReverse" width={16} height={16} />,
        description: 'Reverse Direction',
        active: isReverse
      }
    ],
    [partialValue, isReverse]
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

DisplayFlexDirection.propTypes = {
  partialValue: PropTypes.string,
  isReverse: PropTypes.bool,
  onChange: PropTypes.func,
  directionValue: PropTypes.string,
  wrapValue: PropTypes.string
};

export default DisplayFlexDirection;
