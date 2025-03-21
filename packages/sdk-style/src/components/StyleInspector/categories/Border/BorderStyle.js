// Package
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { BORDER_TOP_STYLE, BORDER_BOTTOM_STYLE, BORDER_LEFT_STYLE, BORDER_RIGHT_STYLE } from '@plitzi/sdk-shared/style';

// Alias
import Icons from '@pcomponents/Icons';

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
const BorderStyle = props => {
  const { values, currentPlacement, onChange = noop } = props;
  const value = useMemo(() => {
    const {
      [BORDER_TOP_STYLE]: borderTop,
      [BORDER_BOTTOM_STYLE]: borderBottom,
      [BORDER_LEFT_STYLE]: borderLeft,
      [BORDER_RIGHT_STYLE]: borderRight
    } = values;
    switch (true) {
      case currentPlacement === 'all':
        if (borderTop === borderBottom && borderTop === borderLeft && borderTop === borderRight) {
          return borderTop;
        }

        return 'solid';
      case currentPlacement === 'top':
        return borderTop;

      case currentPlacement === 'bottom':
        return borderBottom;

      case currentPlacement === 'left':
        return borderLeft;

      case currentPlacement === 'right':
        return borderRight;

      default:
        return 'solid';
    }
  }, [values, currentPlacement]);

  const handleChange = useCallback(itemValue => onChange(itemValue.type, itemValue.value), [onChange]);

  const items = useMemo(
    () => [
      {
        value: { value: 'none', type: 'style' },
        children: <Icons width={16} height={16} type="XMark" />,
        description: '',
        active: value === 'none'
      },
      {
        value: { value: 'solid', type: 'style' },
        children: <Icons width={16} height={16} type="BorderStyleSolid" />,
        description: '',
        active: value === 'solid'
      },
      {
        value: { value: 'dashed', type: 'style' },
        children: <Icons width={16} height={16} type="BorderStyleDashed" />,
        description: '',
        active: value === 'dashed'
      },
      {
        value: { value: 'dotted', type: 'style' },
        children: <Icons width={16} height={16} type="BorderStyleDotted" />,
        description: '',
        active: value === 'dotted'
      }
    ],
    [value]
  );

  const keyValues = useMemo(() => {
    if (currentPlacement === 'all') {
      return [BORDER_TOP_STYLE, BORDER_BOTTOM_STYLE, BORDER_LEFT_STYLE, BORDER_RIGHT_STYLE];
    }

    return `border-${currentPlacement}-style`;
  }, [currentPlacement]);

  return (
    <GroupButtons
      className="w-full"
      classNameContainer="w-[180px]"
      items={items}
      label="Style"
      keyValue={keyValues}
      onChange={handleChange}
    />
  );
};

export default BorderStyle;
