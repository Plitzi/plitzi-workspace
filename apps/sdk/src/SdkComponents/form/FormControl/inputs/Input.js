// Packages
import React, { useCallback, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import noop from 'lodash/noop';

const Input = props => {
  const {
    className = '',
    id = '',
    name = '',
    placeholder = '',
    value = '',
    type = 'text',
    autoComplete = false,
    required = true,
    disabled = false,
    readOnly = false,
    onChange = noop,
    onValidate = noop
  } = props;
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const inputRef = useRef();

  const handleClickShowPassword = useCallback(() => setIsPasswordVisible(state => !state), [setIsPasswordVisible]);

  const handleClickContainer = useCallback(() => {
    inputRef.current.focus();
  }, [inputRef]);

  const handleBlur = useCallback(() => onValidate(), [onValidate]);

  return (
    <div className={classNames('form-control__input-container', className)} onClick={handleClickContainer}>
      <input
        ref={inputRef}
        className="input-container__input"
        id={id}
        name={name}
        type={type === 'password' && isPasswordVisible ? 'text' : type}
        placeholder={placeholder}
        value={value}
        required={required}
        autoComplete={autoComplete ? '' : 'off'}
        disabled={disabled}
        readOnly={readOnly}
        onChange={onChange}
        onBlur={handleBlur}
      />
      {type === 'password' && !isPasswordVisible && (
        <div className="form-input__icon" onClick={handleClickShowPassword}>
          <i className="fa-solid fa-eye" />
        </div>
      )}
      {type === 'password' && isPasswordVisible && (
        <div className="form-input__icon" onClick={handleClickShowPassword}>
          <i className="fa-solid fa-eye-slash" />
        </div>
      )}
    </div>
  );
};

Input.propTypes = {
  className: PropTypes.string,
  id: PropTypes.string,
  name: PropTypes.string,
  placeholder: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]),
  type: PropTypes.string,
  autoComplete: PropTypes.bool,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  readOnly: PropTypes.bool,
  onChange: PropTypes.func,
  onValidate: PropTypes.func
};

export default Input;
