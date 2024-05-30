// Packages
import React from 'react';
import classNames from 'classnames';

/**
 * @param {{
 *   className?: string;
 *   id?: string;
 *   name?: string;
 *   value?: string;
 *   required?: boolean;
 *   disabled?: boolean;
 *   previewMode?: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const Hidden = props => {
  const {
    className = '',
    id = '',
    name = '',
    value = '',
    required = true,
    disabled = false,
    previewMode = true
  } = props;

  return (
    <div className={classNames('form-control__input-hidden-container', className)}>
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
