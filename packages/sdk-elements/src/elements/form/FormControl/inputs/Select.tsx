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

      /**
       * One half given and the other not: the given half is both.
       *
       * Tested for ABSENCE rather than falsiness. An option whose value is deliberately the empty string — "All",
       * "Any", "No filter", the first entry of most selects that filter something — has a perfectly good value, and
       * treating it as missing threw its label away and rendered a blank line at the top of the list.
       */
      if (option.value === undefined || option.label === undefined) {
        const given = option.value ?? option.label ?? '';

        return { value: given, label: given };
      }

      return { value: option.value, label: option.label };
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
