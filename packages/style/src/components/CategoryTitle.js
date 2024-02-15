// Packages
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Relatives
import InspectorDots from './InspectorDots';

const dotKeysDefault = [];

const CategoryTitle = props => {
  const { className = '', title = 'Title', dotKeys = dotKeysDefault } = props;

  return (
    <div className={classNames('flex items-center py-2 pr-2', className)}>
      <div className="mr-2 font-medium">{title}</div>
      <InspectorDots styleKeys={dotKeys} />
    </div>
  );
};

CategoryTitle.propTypes = {
  className: PropTypes.string,
  title: PropTypes.string,
  dotKeys: PropTypes.array
};

export default CategoryTitle;
