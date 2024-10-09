// Packages
import classNames from 'classnames';
import React from 'react';

/**
 * @param {{
 *   className?: string;
 *   id?: string;
 *   children?: number;
 * }} props
 * @returns {React.ReactElement}
 */
const TabContent = props => {
  const { children, className } = props;

  return <div className={classNames('flex', className)}>{children}</div>;
};

export default TabContent;
