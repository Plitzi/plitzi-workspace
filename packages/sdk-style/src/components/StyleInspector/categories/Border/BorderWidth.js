// Package
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { BORDER_TOP_WIDTH, BORDER_BOTTOM_WIDTH, BORDER_LEFT_WIDTH, BORDER_RIGHT_WIDTH } from '@plitzi/sdk-shared/style';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

/**
 * @param {{
 *   values: object;
 *   currentPlacement: string;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const BorderWidth = props => {
  const { values, currentPlacement, onChange = noop } = props;
  const value = useMemo(() => {
    const {
      [BORDER_TOP_WIDTH]: borderTop,
      [BORDER_BOTTOM_WIDTH]: borderBottom,
      [BORDER_LEFT_WIDTH]: borderLeft,
      [BORDER_RIGHT_WIDTH]: borderRight
    } = values;
    switch (true) {
      case currentPlacement === 'all':
        if (borderTop === borderBottom && borderTop === borderLeft && borderTop === borderRight) {
          return borderTop;
        }

        return '0px';
      case currentPlacement === 'top':
        return borderTop;

      case currentPlacement === 'bottom':
        return borderBottom;

      case currentPlacement === 'left':
        return borderLeft;

      case currentPlacement === 'right':
        return borderRight;

      default:
        return '0px';
    }
  }, [values, currentPlacement]);
  const items = useMemo(() => [{ type: 'inputMetric', value, extraValue: { type: 'width' } }], [value]);
  const keyValues = useMemo(() => {
    if (currentPlacement === 'all') {
      return [BORDER_TOP_WIDTH, BORDER_BOTTOM_WIDTH, BORDER_LEFT_WIDTH, BORDER_RIGHT_WIDTH];
    }

    return `border-${currentPlacement}-width`;
  }, [currentPlacement]);

  const handleChange = useCallback(itemValue => onChange(itemValue.type, itemValue.value), [onChange]);

  return (
    <GroupButtons
      className="w-full"
      classNameContainer="w-[180px]"
      items={items}
      label="Width"
      keyValue={keyValues}
      onChange={handleChange}
    />
  );
};

export default BorderWidth;
