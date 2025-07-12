// Packages
import React from 'react';
import classNames from 'classnames';

/**
 * @param {{
 *   className?: string;
 *   title?: string;
 *   children?: React.ReactNode;
 *   isRemoving?: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const OverlayButton = props => {
  const { className = '', children, title = 'Title', isRemoving = false, ...otherProps } = props;

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
