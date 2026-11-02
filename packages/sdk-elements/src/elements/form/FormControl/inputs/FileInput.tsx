import clsx from 'clsx';
import { useEffect, useRef } from 'react';

import useBlurValidation from '../helpers/useBlurValidation';

export type FileInputProps = {
  /** The box the field is drawn in — the `input` slot. */
  className?: string;
  /** The `<input type="file">` inside the box — the `field` slot. */
  fieldClassName?: string;
  id?: string;
  name?: string;
  /** What the picker offers, as the browser reads `accept`: `image/png,image/jpeg`, `.pdf`. `''` for anything. */
  accept?: string;
  /** The file the form holds for this control, when it holds one. */
  chosen?: File;
  required?: boolean;
  disabled?: boolean;
  /** In the builder the field is drawn, never opened: a picker there would choose a file for nobody. */
  previewMode?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onValidate?: () => void;
  errorId?: string;
};

const FileInput = ({
  className = '',
  fieldClassName,
  id = '',
  name = '',
  accept = '',
  chosen,
  required = false,
  disabled = false,
  previewMode = true,
  onChange,
  onValidate,
  errorId
}: FileInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleBlur = useBlurValidation(onValidate);

  // The browser keeps its own choice on the element, which no value can set: a form reset after a send left the old
  // file's name in the field while the form held nothing.
  useEffect(() => {
    if (!chosen && inputRef.current) {
      inputRef.current.value = '';
    }
  }, [chosen]);

  return (
    <div className={clsx('form-control__input-container', className)}>
      <input
        ref={inputRef}
        className={clsx('input-container__input', fieldClassName)}
        id={id}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={errorId}
        name={name}
        type="file"
        accept={accept || undefined}
        required={required}
        disabled={disabled || !previewMode}
        onChange={onChange}
        onBlur={handleBlur}
      />
    </div>
  );
};

export default FileInput;
