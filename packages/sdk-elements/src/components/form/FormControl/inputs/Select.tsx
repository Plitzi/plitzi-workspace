import clsx from 'clsx';
import { useCallback, useMemo, useRef } from 'react';

import type { ChangeEvent, MouseEvent } from 'react';

export type SelectProps = {
  id?: string;
  name: string;
  options?: ({ value?: string; label?: string } | string)[];
  placeholder?: string;
  value?: string;
  className?: string;
  disabled?: boolean;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  onValidate?: () => void;
};

const Select = ({
  id = '',
  name,
  options = [],
  placeholder = '',
  value = '',
  className = '',
  disabled = false,
  onChange,
  onValidate
}: SelectProps) => {
  const inputRef = useRef<HTMLSelectElement>(null);

  const handleClickContainer = useCallback(() => {
    inputRef.current?.click();
  }, [inputRef]);

  const handleClickInput = useCallback((e: MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleBlur = useCallback(() => onValidate?.(), [onValidate]);

  const finalOptions = useMemo<{ value: string; label: string }[]>(() => {
    if (!Array.isArray(options)) {
      return [];
    }

    return options.map(option => {
      // try {
      //   option = JSON.parse(option) as unknown;
      // } catch {
      //   // Nothing here due that is not a valid JSON
      // }

      if (typeof option === 'string') {
        return { value: option, label: option };
      }

      if (typeof option === 'object' && (!option.value || !option.label)) {
        option = option.value ?? option.label ?? '';

        return { value: option, label: option };
      }

      return { value: option.value ?? '', label: option.label ?? '' };
    });
  }, [options]);

  return (
    <div className={clsx('form-control__select-container', className)} onClick={handleClickContainer}>
      <select
        ref={inputRef}
        id={id}
        name={name}
        onChange={onChange}
        value={value}
        className="select-container__select"
        disabled={disabled}
        onClick={handleClickInput}
        onBlur={handleBlur}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {finalOptions.map((option, i) => (
          <option key={i} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default Select;
