// Packages
import React from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import classNames from 'classnames';
import ColorPicker from '@plitzi/plitzi-ui-components/ColorPicker';

const GroupColor = props => {
  const { className = '', value = '', onChange = noop, ...otherProps } = props;

  return (
    <ColorPicker
      value={value}
      onChange={onChange}
      className={classNames('w-full grow rounded-md border-0 px-0.5 py-0 text-xs', className)}
      inputClassName="px-1 py-0"
      size="sm"
      {...otherProps}
    />
  );
};

GroupColor.propTypes = {
  className: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func
};

export default GroupColor;
