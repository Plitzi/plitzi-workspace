// Packages
import React from 'react';
import classNames from 'classnames';

// Relatives
import InspectorDots from './InspectorDots';

const dotKeysDefault = [];

/**
 * @param {{
 *   className?: string;
 *   title?: string;
 *   dotKeys?: string[];
 * }} props
 * @returns {React.ReactElement}
 */
const CategoryTitle = props => {
  const { className = '', title = 'Title', dotKeys = dotKeysDefault } = props;

  return (
    <div className={classNames('flex items-center py-2 pr-2', className)}>
      <div className="mr-2 font-medium">{title}</div>
      <InspectorDots styleKeys={dotKeys} />
    </div>
  );
};

export default CategoryTitle;
