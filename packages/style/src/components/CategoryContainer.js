// Packages
import React from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import classNames from 'classnames';
import ContainerCollapsable from '@plitzi/plitzi-ui-components/ContainerCollapsable';

// Relatives
import CategoryTitle from './CategoryTitle';

const dotKeysDefault = [];

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

CategoryContainer.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  title: PropTypes.string,
  dotKeys: PropTypes.array,
  isCollapsed: PropTypes.bool,
  onCollapse: PropTypes.func
};

export default CategoryContainer;
