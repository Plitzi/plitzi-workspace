// Package
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import {
  BORDER_TOP_COLOR,
  BORDER_BOTTOM_COLOR,
  BORDER_LEFT_COLOR,
  BORDER_RIGHT_COLOR
} from '@plitzi/sdk-shared/style/styleConstants';

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
const BorderColor = props => {
  const { values, currentPlacement, onChange = noop } = props;
  const value = useMemo(() => {
    const {
      [BORDER_TOP_COLOR]: borderTop,
      [BORDER_BOTTOM_COLOR]: borderBottom,
      [BORDER_LEFT_COLOR]: borderLeft,
      [BORDER_RIGHT_COLOR]: borderRight
    } = values;
    switch (true) {
      case currentPlacement === 'all':
        if (borderTop === borderBottom && borderTop === borderLeft && borderTop === borderRight) {
          return borderTop;
        }

        return '#000000';
      case currentPlacement === 'top':
        return borderTop;

      case currentPlacement === 'bottom':
        return borderBottom;

      case currentPlacement === 'left':
        return borderLeft;

      case currentPlacement === 'right':
        return borderRight;

      default:
        return '#000000';
    }
  }, [values, currentPlacement]);
  const items = useMemo(() => [{ type: 'color', value, extraValue: { type: 'color' } }], [value]);
  const keyValues = useMemo(() => {
    if (currentPlacement === 'all') {
      return [BORDER_TOP_COLOR, BORDER_BOTTOM_COLOR, BORDER_LEFT_COLOR, BORDER_RIGHT_COLOR];
    }

    return `border-${currentPlacement}-color`;
  }, [currentPlacement]);

  const handleChange = useCallback(itemValue => onChange(itemValue.type, itemValue.value), [onChange]);

  return (
    <GroupButtons
      className="w-full"
      classNameContainer="w-[180px]"
      items={items}
      label="Color"
      keyValue={keyValues}
      onChange={handleChange}
    />
  );
};

export default BorderColor;
