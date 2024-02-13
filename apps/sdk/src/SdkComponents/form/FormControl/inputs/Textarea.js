// Packages
import React, { useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import noop from 'lodash/noop';

const Textarea = props => {
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
  const inputRef = useRef();

  const handleClickContainer = useCallback(() => {
    inputRef.current.focus();
  }, [inputRef]);

  const handleClickInput = useCallback(e => {
    e.stopPropagation();
  }, []);

  const handleBlur = useCallback(() => onValidate(), [onValidate]);

  return (
    <div className={classNames('form-control__textarea-container', className)} onClick={handleClickContainer}>
      <textarea
        ref={inputRef}
        className="input-container__textarea"
        id={id}
        name={name}
        placeholder={placeholder}
        value={value}
        required={required}
        disabled={disabled}
        onChange={onChange}
        onBlur={handleBlur}
        onClick={handleClickInput}
      />
    </div>
  );
};

Textarea.propTypes = {
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

export default Textarea;
