// Packages
import React, { forwardRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

const Label = forwardRef((props, ref) => {
  const { children, targetInput = '', type = 'text', previewMode = true, required = true, className = '' } = props;

  const handleClick = useCallback(
    e => {
      if (!previewMode) {
        e.preventDefault();
      }
    },
    [previewMode]
  );

  if (!previewMode) {
    return (
      <label ref={ref} className={classNames(`form-control__label-${type}`, className)} onClick={handleClick}>
        {children}
        {required && children && <span className="form-control__label--required">*</span>}
      </label>
    );
  }

  return (
    <label ref={ref} className={classNames(`form-control__label-${type}`, className)} htmlFor={targetInput}>
      {children}
      {required && children && <span className="form-control__label--required">*</span>}
    </label>
  );
});

Label.propTypes = {
  children: PropTypes.node,
  targetInput: PropTypes.string,
  type: PropTypes.string,
  previewMode: PropTypes.bool,
  required: PropTypes.bool,
  className: PropTypes.string
};

export default Label;
