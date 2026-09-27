import clsx from 'clsx';
import { useCallback, useRef } from 'react';

import useFocusWhenShown from './useFocusWhenShown';

import type { ChangeEvent, MouseEvent } from 'react';

export type TextareaProps = {
  className?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  /** Takes the focus while true: as it becomes true, whether on mount or as the field is shown again. */
  autoFocus?: boolean;
  required?: boolean;
  /** `0` for none. */
  maxLength?: number;
  disabled?: boolean;
  readOnly?: boolean;
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onValidate?: () => void;
  /**
   * The id of the message saying what is wrong with the value, while something is: the field is then marked invalid
   * and described by it, so a screen reader or a browser agent hears why the form would not send.
   */
  errorId?: string;
};

const Textarea = ({
  className = '',
  id = '',
  name = '',
  placeholder = '',
  value = '',
  autoFocus = false,
  required = true,
  maxLength = 0,
  disabled = false,
  readOnly = false,
  onChange,
  onValidate,
  errorId
}: TextareaProps) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useFocusWhenShown(inputRef, autoFocus);

  const handleClickInput = useCallback((e: MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleBlur = useCallback(() => onValidate?.(), [onValidate]);

  return (
    <textarea
      ref={inputRef}
      className={clsx('form-control__textarea-container', className)}
      id={id}
      aria-invalid={errorId ? true : undefined}
      aria-describedby={errorId}
      name={name}
      placeholder={placeholder}
      value={value}
      readOnly={readOnly}
      required={required}
      maxLength={maxLength > 0 ? maxLength : undefined}
      disabled={disabled}
      onChange={onChange}
      onBlur={handleBlur}
      onClick={handleClickInput}
    />
  );
};

export default Textarea;
