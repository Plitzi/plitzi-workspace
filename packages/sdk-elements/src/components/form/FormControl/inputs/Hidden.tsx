import clsx from 'clsx';

export type HiddenProps = {
  className?: string;
  id?: string;
  name?: string;
  value?: string;
  required?: boolean;
  disabled?: boolean;
  previewMode?: boolean;
};

const Hidden = ({
  className = '',
  id = '',
  name = '',
  value = '',
  required = true,
  disabled = false,
  previewMode = true
}: HiddenProps) => {
  return (
    <div className={clsx('form-control__input-hidden-container', className)}>
      {previewMode && (
        <input
          className="input-container__input-hidden"
          id={id}
          name={name}
          type="hidden"
          value={value}
          required={required}
          disabled={disabled}
        />
      )}
      {!previewMode && <div className="input-container__input-hidden--no-preview">hidden input</div>}
    </div>
  );
};

export default Hidden;
