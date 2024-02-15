// Package
import React, { useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Relatives
import StyleInspectorContext from '../../StyleInspectorContext';
import GroupButtons from '../../../components/GroupButtons';

const BorderColor = props => {
  const { borderTop, borderBottom, borderLeft, borderRight, currentPlacement, onChange = noop } = props;
  const { getValue } = useContext(StyleInspectorContext);

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

BorderColor.propTypes = {
  borderTop: PropTypes.string,
  borderBottom: PropTypes.string,
  borderLeft: PropTypes.string,
  borderRight: PropTypes.string,
  currentPlacement: PropTypes.string,
  onChange: PropTypes.func
};

export default BorderColor;
