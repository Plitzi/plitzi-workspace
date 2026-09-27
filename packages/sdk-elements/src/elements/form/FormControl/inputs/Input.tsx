import clsx from 'clsx';
import { useCallback, useRef, useState } from 'react';

import useFocusWhenShown from './useFocusWhenShown';

export type InputProps = {
  className?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  type?: string;
  autoComplete?: boolean;
  /** Takes the focus while true: as it becomes true, whether on mount or as the field is shown again. */
  autoFocus?: boolean;
  required?: boolean;
  /** `0` for none. The one rule the browser enforces itself, and by the kindest means: it stops the typing. */
  maxLength?: number;
  disabled?: boolean;
  readOnly?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onValidate?: () => void;
  /**
   * The id of the message saying what is wrong with the value, while something is: the field is then marked invalid
   * and described by it, so a screen reader or a browser agent hears why the form would not send.
   */
  errorId?: string;
};

const Input = ({
  className = '',
  id = '',
  name = '',
  placeholder = '',
  value = '',
  type = 'text',
  autoComplete = false,
  autoFocus = false,
  required = true,
  maxLength = 0,
  disabled = false,
  readOnly = false,
  onChange,
  onValidate,
  errorId
}: InputProps) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useFocusWhenShown(inputRef, autoFocus);

  const handleClickShowPassword = useCallback(() => setIsPasswordVisible(state => !state), [setIsPasswordVisible]);

  // A colour field is its swatch: a click anywhere on it opens the picker — focusing it, as a text field is, would not.
  // One on the input itself opens it already.
  const handleClickContainer = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const input = inputRef.current;
      input?.focus();
      if (type !== 'color' || !input || event.target === input) {
        return;
      }

      try {
        input.showPicker();
      } catch {
        // A frame of another origin is not allowed to open it: the field has the focus, and Enter opens it there.
      }
    },
    [inputRef, type]
  );

  const handleBlur = useCallback(() => onValidate?.(), [onValidate]);

  return (
    <div className={clsx('form-control__input-container', className)} onClick={handleClickContainer}>
      <input
        ref={inputRef}
        className="input-container__input"
        id={id}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={errorId}
        name={name}
        type={type === 'password' && isPasswordVisible ? 'text' : type}
        placeholder={placeholder}
        value={value}
        required={required}
        maxLength={maxLength > 0 ? maxLength : undefined}
        autoComplete={autoComplete ? 'on' : 'off'}
        disabled={disabled}
        readOnly={readOnly}
        onChange={onChange}
        onBlur={handleBlur}
      />
      {type === 'password' && (
        // Named by its title, not an `aria-label`: a test — or an agent — looking for the field by its label ("Password")
        // would find this button too, since a label is matched by the words it contains.
        <button
          type="button"
          className="form-input__icon"
          aria-pressed={isPasswordVisible}
          title="Show password"
          onClick={handleClickShowPassword}
        >
          <i className={isPasswordVisible ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export default Input;
