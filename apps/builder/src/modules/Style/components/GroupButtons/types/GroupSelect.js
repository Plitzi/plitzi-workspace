// Packages
import React from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import classNames from 'classnames';
import Select from '@plitzi/plitzi-ui-components/Select';

const GroupSelect = props => {
  const { className = '', children, value = '', onChange = noop, ...otherProps } = props;

  return (
    <Select
      className={classNames('rounded-md basis-0 grow border-0 rounded-none text-xs px-2 py-0 m-0', className)}
      value={value}
      size="custom"
      onChange={onChange}
      {...otherProps}
    >
      {children}
    </Select>
  );
};

GroupSelect.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func
};

export default GroupSelect;
