import clsx from 'clsx';
import { useCallback } from 'react';

import { VISUALLY_HIDDEN } from './visuallyHidden';

import type { MouseEvent, ReactNode, RefObject } from 'react';

export type LabelProps = {
  ref?: RefObject<HTMLLabelElement>;
  className?: string;
  children: ReactNode;
  targetInput: string;
  type: string;
  previewMode?: boolean;
  required: boolean;
  /** Named for assistive technology only: the field's design shows what it is for some other way. */
  hidden?: boolean;
  /** The class of the `*` a required field's label ends with — the `requiredMark` slot. */
  requiredClassName?: string;
};

const Label = ({
  ref,
  children,
  targetInput = '',
  type = 'text',
  previewMode = true,
  required = true,
  hidden = false,
  className = '',
  requiredClassName
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
      <label ref={ref} className={clsx(`form-control__label-${type}`, className)} onClick={handleClick}>
        {children}
        {required && children && <span className={clsx('form-control__label--required', requiredClassName)}>*</span>}
      </label>
    );
  }

  return (
    <label
      ref={ref}
      className={clsx(`form-control__label-${type}`, className)}
      htmlFor={targetInput}
      style={hidden ? VISUALLY_HIDDEN : undefined}
    >
      {children}
      {required && children && <span className={clsx('form-control__label--required', requiredClassName)}>*</span>}
    </label>
  );
};

export default Label;
