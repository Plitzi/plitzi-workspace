import clsx from 'clsx';
import { useCallback, useRef } from 'react';

import type { ChangeEvent, MouseEvent } from 'react';

export type TextareaProps = {
  className?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
  /** `0` for none. */
  maxLength?: number;
  disabled?: boolean;
  readOnly?: boolean;
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onValidate?: () => void;
};

const Textarea = ({
  className = '',
  id = '',
  name = '',
  placeholder = '',
  value = '',
  required = true,
  maxLength = 0,
  disabled = false,
  readOnly = false,
  onChange,
  onValidate
}: TextareaProps) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleClickInput = useCallback((e: MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleBlur = useCallback(() => onValidate?.(), [onValidate]);

  return (
    <textarea
      ref={inputRef}
      className={clsx('form-control__textarea-container', className)}
      id={id}
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
