// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { OBJECT_POSITION } from '@plitzi/sdk-style/StyleConstants';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

/**
 * @param {{
 *   value: string;
 *   onChange?: (value: { type: string; value: string }) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const SizePosition = props => {
  const { onChange = noop } = props;
  let { value } = props;
  value = value.split(' ');

  const handleChange = useCallback(
    itemValue => {
      const { subType, type } = itemValue;
      const valueAux = value.split(' ');
      if (subType === 'left') {
        valueAux[0] = itemValue.value;
      } else if (subType === 'top') {
        valueAux[1] = itemValue.value;
      }

      onChange({ type, value: valueAux.join(' ') });
    },
    [onChange, value]
  );

  const itemsSize = useMemo(
    () => [
      {
        type: 'inputMetric',
        value: value[0],
        extraValue: { type: OBJECT_POSITION, subType: 'left' },
        keyValue: OBJECT_POSITION,
        label: 'Left'
      },
      {
        type: 'inputMetric',
        value: value[1],
        extraValue: { type: OBJECT_POSITION, subType: 'top' },
        keyValue: OBJECT_POSITION,
        label: 'Top'
      }
    ],
    [value[0], value[1]]
  );

  return (
    <GroupButtons
      className="w-full"
      classNameContainer="w-[180px]"
      keyValue={OBJECT_POSITION}
      items={itemsSize}
      label="Object Position"
      onChange={handleChange}
    />
  );
};

export default SizePosition;
