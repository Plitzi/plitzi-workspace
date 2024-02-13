// Package
import React, { useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import StyleInspectorContext from '../../StyleInspectorContext';
import GroupButtons from '../../../components/GroupButtons';

const BorderStyle = props => {
  const { borderTop, borderBottom, borderLeft, borderRight, currentPlacement, onChange = noop } = props;
  const { getValue } = useContext(StyleInspectorContext);

  let valueStyle = 'solid';
  if (
    currentPlacement === 'all' &&
    borderTop === borderBottom &&
    borderTop === borderLeft &&
    borderTop === borderRight
  ) {
    valueStyle = borderTop;
  } else if (currentPlacement !== 'all') {
    valueStyle = getValue(`border-${currentPlacement}-style`);
  }

  const handleChange = useCallback(itemValue => onChange(itemValue.type, itemValue.value), [onChange]);

  const items = useMemo(
    () => [
      {
        value: { value: 'none', type: 'style' },
        children: <Icons width={16} height={16} type="XMark" />,
        description: '',
        active: valueStyle === 'none'
      },
      {
        value: { value: 'solid', type: 'style' },
        children: <Icons width={16} height={16} type="BorderStyleSolid" />,
        description: '',
        active: valueStyle === 'solid'
      },
      {
        value: { value: 'dashed', type: 'style' },
        children: <Icons width={16} height={16} type="BorderStyleDashed" />,
        description: '',
        active: valueStyle === 'dashed'
      },
      {
        value: { value: 'dotted', type: 'style' },
        children: <Icons width={16} height={16} type="BorderStyleDotted" />,
        description: '',
        active: valueStyle === 'dotted'
      }
    ],
    [valueStyle]
  );

  const keyValues = useMemo(() => {
    if (currentPlacement === 'all') {
      return ['border-top-style', 'border-bottom-style', 'border-left-style', 'border-right-style'];
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

BorderStyle.propTypes = {
  borderTop: PropTypes.string,
  borderBottom: PropTypes.string,
  borderLeft: PropTypes.string,
  borderRight: PropTypes.string,
  currentPlacement: PropTypes.string,
  onChange: PropTypes.func
};

export default BorderStyle;
