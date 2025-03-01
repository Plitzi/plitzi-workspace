import classNames from 'classnames';
import { useCallback, useRef } from 'react';

import type { ChangeEvent, MouseEvent } from 'react';

export type TextareaProps = {
  className?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
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
      className={classNames('form-control__textarea-container', className)}
      id={id}
      name={name}
      placeholder={placeholder}
      value={value}
      readOnly={readOnly}
      required={required}
      disabled={disabled}
      onChange={onChange}
      onBlur={handleBlur}
      onClick={handleClickInput}
    />
  );
};

export default Textarea;
