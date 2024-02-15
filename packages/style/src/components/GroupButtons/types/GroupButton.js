// Packages
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import noop from 'lodash/noop';

const GroupButton = props => {
  const { className = '', title = '', active = false, children, onClick = noop } = props;

  return (
    <div
      className={classNames(
        'flex items-center justify-center grow basis-0 px-1 cursor-pointer',
        { 'text-blue-400': active },
        className
      )}
      onClick={onClick}
      title={title}
    >
      {children}
    </div>
  );
};

GroupButton.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  title: PropTypes.string,
  active: PropTypes.bool,
  onClick: PropTypes.func
};

export default GroupButton;
