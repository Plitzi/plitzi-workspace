import clsx from 'clsx';
import { useCallback, useRef, useState } from 'react';

export type InputProps = {
  className?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  type?: string;
  autoComplete?: boolean;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onValidate?: () => void;
};

const Input = ({
  className = '',
  id = '',
  name = '',
  placeholder = '',
  value = '',
  type = 'text',
  autoComplete = false,
  required = true,
  disabled = false,
  readOnly = false,
  onChange,
  onValidate
}: InputProps) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClickShowPassword = useCallback(() => setIsPasswordVisible(state => !state), [setIsPasswordVisible]);

  const handleClickContainer = useCallback(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  const handleBlur = useCallback(() => onValidate?.(), [onValidate]);

  return (
    <div className={clsx('form-control__input-container', className)} onClick={handleClickContainer}>
      <input
        ref={inputRef}
        className="input-container__input"
        id={id}
        name={name}
        type={type === 'password' && isPasswordVisible ? 'text' : type}
        placeholder={placeholder}
        value={value}
        required={required}
        autoComplete={autoComplete ? 'on' : 'off'}
        disabled={disabled}
        readOnly={readOnly}
        onChange={onChange}
        onBlur={handleBlur}
      />
      {type === 'password' && !isPasswordVisible && (
        <div className="form-input__icon" onClick={handleClickShowPassword}>
          <i className="fa-solid fa-eye" />
        </div>
      )}
      {type === 'password' && isPasswordVisible && (
        <div className="form-input__icon" onClick={handleClickShowPassword}>
          <i className="fa-solid fa-eye-slash" />
        </div>
      )}
    </div>
  );
};

export default Input;
