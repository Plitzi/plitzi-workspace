// Packages
import React, { useCallback } from 'react';
import classNames from 'classnames';

const Label = props => {
  const { ref, children, targetInput = '', type = 'text', previewMode = true, required = true, className = '' } = props;

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
};

export default Label;
