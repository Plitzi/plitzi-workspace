// Packages
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

const OverlayButton = props => {
  const { className = '', children, title = 'Title', theme = 'normal', isRemoving = false, ...otherProps } = props;

  return (
    <button
      type="button"
      className={classNames(
        'overlay__button',
        { 'button--blue': theme === 'normal' && !isRemoving, 'button--red': isRemoving },
        className
      )}
      title={title}
      {...otherProps}
    >
      {children}
    </button>
  );
};

OverlayButton.propTypes = {
  className: PropTypes.string,
  title: PropTypes.string,
  children: PropTypes.node,
  theme: PropTypes.oneOf(['normal']),
  isRemoving: PropTypes.bool
};

export default OverlayButton;
