// Packages
import React, { useCallback, useMemo, useRef } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';

const Select = props => {
  const {
    options = [],
    placeholder = '',
    value = '',
    className = '',
    disabled = false,
    onChange = noop,
    onValidate = noop
  } = props;
  const inputRef = useRef();

  const handleClickContainer = useCallback(() => {
    inputRef.current.click();
  }, [inputRef]);

  const handleClickInput = useCallback(e => {
    e.stopPropagation();
  }, []);

  const handleBlur = useCallback(() => onValidate(), [onValidate]);

  const finalOptions = useMemo(() => {
    if (!Array.isArray(options)) {
      return [];
    }

    return options.map(option => {
      try {
        option = JSON.parse(option);
      } catch (error) {
        // Nothing here due that is not a valid JSON
      }

      if (typeof option === 'string') {
        return { value: option, label: option };
      }

      if (typeof option === 'object' && (!option.value || !option.label)) {
        option = option?.value ?? option?.label ?? '';

        return { value: option, label: option };
      }

      return { value: option.value, label: option.label };
    });
  }, [options]);

  return (
    <div className={classNames('form-control__select-container', className)} onClick={handleClickContainer}>
      <select
        ref={inputRef}
        onChange={onChange}
        value={value}
        className="select-container__select"
        placeholder={placeholder}
        disabled={disabled}
        onClick={handleClickInput}
        onBlur={handleBlur}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {finalOptions &&
          finalOptions.map((option, i) => (
            <option key={i} value={option.value}>
              {option.label}
            </option>
          ))}
      </select>
    </div>
  );
};

export default Select;
