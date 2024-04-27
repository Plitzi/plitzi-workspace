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
} from '@plitzi/sdk-style/StyleConstants';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

/**
 * @param {{
 *   borderTopLeft: string;
 *   borderTopRight: string;
 *   borderBottomLeft: string;
 *   borderBottomRight: string;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const BorderRadius = props => {
  const { borderTopLeft, borderTopRight, borderBottomLeft, borderBottomRight, onChange = noop } = props;
  const [showRadiusIndividuals, setShowRadiusIndividuals] = useState(false);

  const handleChange = type => partialValue => {
    onChange(type, partialValue);
  };

  let all = '0px';
  if (borderTopLeft === borderTopRight && borderTopLeft === borderBottomLeft && borderTopLeft === borderBottomRight) {
    all = borderTopLeft;
  }

  const keyValueMemo = useMemo(
    () => [BORDER_RADIUS_TOP_LEFT, BORDER_RADIUS_TOP_RIGHT, BORDER_RADIUS_BOTTOM_LEFT, BORDER_RADIUS_BOTTOM_RIGHT],
    []
  );

  const handleChange2 = useCallback(
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
        keyValue={keyValueMemo}
        onChange={handleChange2}
      />
      {showRadiusIndividuals && (
        <div className="grid grid-cols-2 grid-rows-2 gap-2 bg-gray-50 border border-gray-300 rounded p-2">
          <div className="flex items-center">
            <Icons type="BorderRadiusTopLeft" className="mr-1" />
            <InputMetric onChange={handleChange(BORDER_RADIUS_TOP_LEFT)} value={borderTopLeft} className="rounded" />
          </div>
          <div className="flex items-center">
            <Icons type="BorderRadiusTopRight" className="mr-1" />
            <InputMetric onChange={handleChange(BORDER_RADIUS_TOP_RIGHT)} value={borderTopRight} className="rounded" />
          </div>
          <div className="flex items-center">
            <Icons type="BorderRadiusBottomLeft" className="mr-1" />
            <InputMetric
              onChange={handleChange(BORDER_RADIUS_BOTTOM_LEFT)}
              value={borderBottomLeft}
              className="rounded"
            />
          </div>
          <div className="flex items-center">
            <Icons type="BorderRadiusBottomRight" className="mr-1" />
            <InputMetric
              onChange={handleChange(BORDER_RADIUS_BOTTOM_RIGHT)}
              value={borderBottomRight}
              className="rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BorderRadius;
