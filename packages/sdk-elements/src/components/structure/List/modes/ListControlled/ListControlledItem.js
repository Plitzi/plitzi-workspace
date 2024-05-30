// Packages
import React, { useMemo } from 'react';
import classNames from 'classnames';

// Relatives
import ReplicaProvider from '../../../../../Element/ReplicaProvider';

/**
 * @param {{
 *   children: React.ReactNode;
 *   className: string;
 *   isTemplate: boolean;
 *   itemCount: number;
 *   parentId: string;
 *   record: object;
 * }} props
 * @returns {React.ReactElement}
 */
const ListControlledItem = props => {
  const { children, className = '', isTemplate = false, itemCount = 0, parentId = '', record } = props;
  const dataSourceValue = useMemo(() => ({ item: record, index: `${itemCount}` }), [record, itemCount]);

  if (isTemplate) {
    return (
      <div className={classNames('plitzi-component__controlled-list-item', className)}>
        <div className="controlled-list-item__counter">{`List Item - ${itemCount}`}</div>
        <ReplicaProvider id={parentId} source={`list_${parentId}`} dataSourceValue={dataSourceValue}>
          {children}
        </ReplicaProvider>
      </div>
    );
  }

  return (
    <ReplicaProvider id={parentId} source={`list_${parentId}`} dataSourceValue={dataSourceValue}>
      {children}
    </ReplicaProvider>
  );
};

export default ListControlledItem;
