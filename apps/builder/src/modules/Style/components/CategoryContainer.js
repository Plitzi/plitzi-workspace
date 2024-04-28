// Packages
import React from 'react';
import noop from 'lodash/noop';
import classNames from 'classnames';
import ContainerCollapsable from '@plitzi/plitzi-ui-components/ContainerCollapsable';

// Relatives
import CategoryTitle from './CategoryTitle';

const dotKeysDefault = [];

/**
 * @param {{
 *   className?: string;
 *   children?: React.ReactNode;
 *   title?: string;
 *   dotKeys?: string[];
 *   isCollapsed?: boolean;
 *   onCollapse?: (collapsed: boolean) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const CategoryContainer = props => {
  const {
    className = '',
    children,
    title = 'Title',
    dotKeys = dotKeysDefault,
    isCollapsed = true,
    onCollapse = noop
  } = props;

  return (
    <ContainerCollapsable
      title={<CategoryTitle title={title} dotKeys={dotKeys} className="cursor-pointer" />}
      collapsed={isCollapsed}
      onChange={onCollapse}
      iconPlacement="left"
      iconCollapsed={<i className="fa-solid fa-angle-down" />}
      iconExpanded={<i className="fa-solid fa-angle-up" />}
      className={classNames('border-b border-gray-300', className)}
    >
      {children}
    </ContainerCollapsable>
  );
};

export default CategoryContainer;
