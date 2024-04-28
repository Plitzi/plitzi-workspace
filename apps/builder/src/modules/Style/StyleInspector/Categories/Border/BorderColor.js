// Package
import React, { useCallback, use, useMemo } from 'react';
import noop from 'lodash/noop';

// Relatives
import StyleInspectorContext from '../../StyleInspectorContext';
import GroupButtons from '../../../components/GroupButtons';

/**
 * @param {{
 *   borderTop: string;
 *   borderBottom: string;
 *   borderLeft: string;
 *   borderRight: string;
 *   currentPlacement: string;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const BorderColor = props => {
  const { borderTop, borderBottom, borderLeft, borderRight, currentPlacement, onChange = noop } = props;
  const { getValue } = use(StyleInspectorContext);

  let valueColor = '#000000';
  if (
    currentPlacement === 'all' &&
    borderTop === borderBottom &&
    borderTop === borderLeft &&
    borderTop === borderRight
  ) {
    valueColor = borderTop;
  } else if (currentPlacement !== 'all') {
    valueColor = getValue(`border-${currentPlacement}-color`);
  }

  const handleChange = useCallback(itemValue => onChange(itemValue.type, itemValue.value), [onChange]);

  const items = useMemo(() => [{ type: 'color', value: valueColor, extraValue: { type: 'color' } }], [valueColor]);

  const keyValues = useMemo(() => {
    if (currentPlacement === 'all') {
      return ['border-top-color', 'border-bottom-color', 'border-left-color', 'border-right-color'];
    }

    return `border-${currentPlacement}-color`;
  }, [currentPlacement]);

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

export default BorderColor;
