// Package
import React, { useCallback, useMemo, useState } from 'react';
import noop from 'lodash/noop';
import InputMetric from '@plitzi/plitzi-ui-components/InputMetric';

// Monorepo
import {
  BORDER_RADIUS_TOP_LEFT,
  BORDER_RADIUS_TOP_RIGHT,
  BORDER_RADIUS_BOTTOM_LEFT,
  BORDER_RADIUS_BOTTOM_RIGHT
} from '@plitzi/sdk-shared/style';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

const keyValue = [
  BORDER_RADIUS_TOP_LEFT,
  BORDER_RADIUS_TOP_RIGHT,
  BORDER_RADIUS_BOTTOM_LEFT,
  BORDER_RADIUS_BOTTOM_RIGHT
];

/**
 * @param {{
 *   values: object;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const BorderRadius = props => {
  const { values, onChange = noop } = props;
  const [showRadiusIndividuals, setShowRadiusIndividuals] = useState(false);
  const {
    [BORDER_RADIUS_TOP_LEFT]: borderTopLeft,
    [BORDER_RADIUS_TOP_RIGHT]: borderTopRight,
    [BORDER_RADIUS_BOTTOM_LEFT]: borderBottomLeft,
    [BORDER_RADIUS_BOTTOM_RIGHT]: borderBottomRight
  } = values;

  const handleChangeTopLeft = useCallback(partialValue => onChange(BORDER_RADIUS_TOP_LEFT, partialValue), [onChange]);

  const handleChangeTopRight = useCallback(partialValue => onChange(BORDER_RADIUS_TOP_RIGHT, partialValue), [onChange]);

  const handleChangeBottomLeft = useCallback(
    partialValue => onChange(BORDER_RADIUS_BOTTOM_LEFT, partialValue),
    [onChange]
  );

  const handleChangeBottomRight = useCallback(
    partialValue => onChange(BORDER_RADIUS_BOTTOM_RIGHT, partialValue),
    [onChange]
  );

  let all = '0px';
  if (borderTopLeft === borderTopRight && borderTopLeft === borderBottomLeft && borderTopLeft === borderBottomRight) {
    all = borderTopLeft;
  }

  const handleChange = useCallback(
    itemValue => {
      if (itemValue.type === 'showRadiusIndividuals') {
        setShowRadiusIndividuals(itemValue.value);

        return;
      }

      onChange(itemValue.type, itemValue.value);
    },
    [onChange]
  );

  const items = useMemo(
    () => [
      {
        value: { value: false, type: 'showRadiusIndividuals' },
        children: <Icons width={16} height={16} type="BorderRadiusSingle" />,
        description: '',
        active: !showRadiusIndividuals
      },
      {
        value: { value: true, type: 'showRadiusIndividuals' },
        children: <Icons width={16} height={16} type="BorderRadiusAll" />,
        description: '',
        active: showRadiusIndividuals
      },
      { type: 'inputMetric', value: all, extraValue: { type: 'radius' } }
    ],
    [showRadiusIndividuals, all]
  );

  return (
    <div className="flex flex-col gap-2">
      <GroupButtons
        className="w-full"
        classNameContainer="w-[180px]"
        items={items}
        label="Radius"
        keyValue={keyValue}
        onChange={handleChange}
      />
      {showRadiusIndividuals && (
        <div className="grid grid-cols-2 grid-rows-2 gap-2 bg-gray-50 border border-gray-300 rounded-sm p-2">
          <div className="flex items-center">
            <Icons type="BorderRadiusTopLeft" className="mr-1" />
            <InputMetric onChange={handleChangeTopLeft} value={borderTopLeft} className="rounded-sm" />
          </div>
          <div className="flex items-center">
            <Icons type="BorderRadiusTopRight" className="mr-1" />
            <InputMetric onChange={handleChangeTopRight} value={borderTopRight} className="rounded-sm" />
          </div>
          <div className="flex items-center">
            <Icons type="BorderRadiusBottomLeft" className="mr-1" />
            <InputMetric onChange={handleChangeBottomLeft} value={borderBottomLeft} className="rounded-sm" />
          </div>
          <div className="flex items-center">
            <Icons type="BorderRadiusBottomRight" className="mr-1" />
            <InputMetric onChange={handleChangeBottomRight} value={borderBottomRight} className="rounded-sm" />
          </div>
        </div>
      )}
    </div>
  );
};

export default BorderRadius;
