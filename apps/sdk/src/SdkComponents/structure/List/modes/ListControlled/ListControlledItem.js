// Packages
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

// Alias
import ReplicaProvider from '@modules/Element/ReplicaProvider';

const ListControlledItem = props => {
  const { children, className = '', isTemplate = false, itemCount = 0, parentId = '', record } = props;
  if (isTemplate) {
    return (
      <div className={classNames('plitzi-component__controlled-list-item', className)}>
        <div className="controlled-list-item__counter">{`List Item - ${itemCount + 1}`}</div>
        <ReplicaProvider id={parentId} source={`list_${parentId}`} dataSourceValue={{ item: record }}>
          {children}
        </ReplicaProvider>
      </div>
    );
  }

  return (
    <ReplicaProvider id={parentId} dataSourceValue={{ item: record }}>
      {children}
    </ReplicaProvider>
  );
};

ListControlledItem.propTypes = {
  className: PropTypes.string,
  parentId: PropTypes.string,
  record: PropTypes.object,
  isTemplate: PropTypes.bool,
  itemCount: PropTypes.number,
  children: PropTypes.node
};

export default ListControlledItem;
