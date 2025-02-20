import classNames from 'classnames';
import { useCallback } from 'react';

import type { MouseEvent, ReactNode, RefObject } from 'react';

export type LabelProps = {
  ref: RefObject<HTMLLabelElement>;
  children: ReactNode;
  targetInput: string;
  type: string;
  previewMode: boolean;
  required: boolean;
  className: string;
};

const Label = ({
  ref,
  children,
  targetInput = '',
  type = 'text',
  previewMode = true,
  required = true,
  className = ''
}: LabelProps) => {
  const handleClick = useCallback(
    (e: MouseEvent) => {
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
