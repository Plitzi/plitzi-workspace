// Packages
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import noop from 'lodash/noop';
import Input from '@plitzi/plitzi-ui-components/Input';

const GroupInput = props => {
  const { className = '', value = '', type = 'number', onChange = noop, ...otherProps } = props;

  return (
    <Input
      className={classNames('flex basis-0 grow min-h-0', className)}
      inputClassName="rounded px-1 py-0 m-0 text-xs border-none"
      size="custom"
      type={type}
      value={value}
      onChange={onChange}
      {...otherProps}
    />
  );
};

GroupInput.propTypes = {
  className: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  type: PropTypes.string,
  onChange: PropTypes.func
};

export default GroupInput;
