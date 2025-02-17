import React, { useCallback, useRef } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';

/**
 * @param {{
 *   className?: string;
 *   id?: string;
 *   name?: string;
 *   placeholder?: string;
 *   value?: string;
 *   required?: boolean;
 *   disabled?: boolean;
 *   onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
 *   onValidate?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
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

  const handleClickInput = useCallback(e => {
    e.stopPropagation();
  }, []);

  const handleBlur = useCallback(() => onValidate(), [onValidate]);

  return (
    <textarea
      ref={inputRef}
      className={classNames('form-control__textarea-container', className)}
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
  );
};

export default Textarea;
