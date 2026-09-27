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
  /**
   * The id of the message saying what is wrong with the value, while something is: the field is then marked invalid
   * and described by it, so a screen reader or a browser agent hears why the form would not send.
   */
  errorId?: string;
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
  onValidate,
  errorId
}: CheckboxProps) => {
  const handleBlur = useCallback(() => onValidate?.(), [onValidate]);

  return (
    <input
      className={clsx('form-control__checkbox-container', className)}
      id={id}
      aria-invalid={errorId ? true : undefined}
      aria-describedby={errorId}
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
