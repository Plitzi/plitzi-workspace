import classNames from 'classnames';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type OverlayButtonProps = {
  className?: string;
  title?: string;
  children?: ReactNode;
  isRemoving?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const OverlayButton = ({
  className = '',
  children,
  title = 'Title',
  isRemoving = false,
  ...otherProps
}: OverlayButtonProps) => {
  return (
    <button
      type="button"
      className={classNames('overlay__button', { 'button--blue': !isRemoving, 'button--red': isRemoving }, className)}
      title={title}
      {...otherProps}
    >
      {children}
    </button>
  );
};

export default OverlayButton;
