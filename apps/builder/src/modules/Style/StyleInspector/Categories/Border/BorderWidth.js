// Package
import React, { useCallback, useContext, useMemo } from 'react';
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
const BorderWidth = props => {
  const { borderTop, borderBottom, borderLeft, borderRight, currentPlacement, onChange = noop } = props;
  const { getValue } = useContext(StyleInspectorContext);

  let valueWidth = '0px';
  if (
    currentPlacement === 'all' &&
    borderTop === borderBottom &&
    borderTop === borderLeft &&
    borderTop === borderRight
  ) {
    valueWidth = borderTop;
  } else if (currentPlacement !== 'all') {
    valueWidth = getValue(`border-${currentPlacement}-width`);
  }

  const handleChange = useCallback(itemValue => onChange(itemValue.type, itemValue.value), [onChange]);

  const items = useMemo(
    () => [
      {
        type: 'inputMetric',
        value: valueWidth,
        extraValue: { type: 'width' }
      }
    ],
    [valueWidth]
  );

  const keyValues = useMemo(() => {
    if (currentPlacement === 'all') {
      return ['border-top-width', 'border-bottom-width', 'border-left-width', 'border-right-width'];
    }

    return `border-${currentPlacement}-width`;
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

export default BorderWidth;
