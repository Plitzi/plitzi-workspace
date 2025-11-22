import clsx from 'clsx';
import { useCallback } from 'react';

import type { ChangeEvent } from 'react';

export type CheckboxProps = {
  className?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
  disabled?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onValidate?: () => void;
};

const Checkbox = ({
  className = '',
  id = '',
  name = '',
  placeholder = '',
  value = '',
  required = true,
  disabled = false,
  onChange,
  onValidate
}: CheckboxProps) => {
  const handleBlur = useCallback(() => onValidate?.(), [onValidate]);

  return (
    <input
      className={clsx('form-control__checkbox-container', className)}
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

export default Checkbox;
