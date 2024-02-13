// Packages
import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import noop from 'lodash/noop';

const Checkbox = props => {
  const {
    className = '',
    id = '',
    name = '',
    placeholder = '',
    value = '',
    required = true,
    disabled = false,
    onChange = noop,
    onValidate = noop
  } = props;

  const handleBlur = useCallback(() => onValidate(), [onValidate]);

  return (
    <input
      className={classNames('form-control__checkbox-container', className)}
      id={id}
      name={name}
      type="checkbox"
      placeholder={placeholder}
      value={value}
      required={required}
      disabled={disabled}
      onChange={onChange}
      onBlur={handleBlur}
    />
  );
};

Checkbox.propTypes = {
  className: PropTypes.string,
  id: PropTypes.string,
  name: PropTypes.string,
  placeholder: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]),
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  onChange: PropTypes.func,
  onValidate: PropTypes.func
};

export default Checkbox;
