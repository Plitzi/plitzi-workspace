import clsx from 'clsx';
import { useCallback } from 'react';

import type { ChangeEvent } from 'react';

export type CheckboxProps = {
  className?: string;
  /**
   * How the box is offered: `switch` is the same checkbox announced as an on/off switch (`role="switch"`) and drawn as
   * a track with a thumb — for a setting that takes effect at once, where a checkbox reads as a choice to submit.
   */
  variant?: 'checkbox' | 'switch';
  id?: string;
  name?: string;
  checked?: boolean;
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
  variant = 'checkbox',
  id = '',
  name = '',
  checked = false,
  required = true,
  disabled = false,
  onChange,
  onValidate,
  errorId
}: CheckboxProps) => {
  const handleBlur = useCallback(() => onValidate?.(), [onValidate]);

  return (
    <input
      className={clsx(`form-control__${variant}-container`, className)}
      id={id}
      role={variant === 'switch' ? 'switch' : undefined}
      aria-invalid={errorId ? true : undefined}
      aria-describedby={errorId}
      name={name}
      type="checkbox"
      // What a form posted by the browser itself sends while it is ticked; the form's own values hold `true`/`false`.
      value="true"
      checked={checked}
      required={required}
      disabled={disabled}
      onChange={onChange}
      onBlur={handleBlur}
    />
  );
};

export default Checkbox;
