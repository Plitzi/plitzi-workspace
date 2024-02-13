// Packages
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

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

Hidden.propTypes = {
  className: PropTypes.string,
  id: PropTypes.string,
  name: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]),
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  previewMode: PropTypes.bool
};

export default Hidden;
