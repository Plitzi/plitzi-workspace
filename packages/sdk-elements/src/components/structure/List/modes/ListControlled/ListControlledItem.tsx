import React, { useMemo, use } from 'react';
import classNames from 'classnames';

import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';

import ReplicaProvider from '../../../../../Element/ReplicaProvider';

/**
 * @param {{
 *   children: React.ReactNode;
 *   className: string;
 *   isTemplate: boolean;
 *   itemCount: number;
 *   parentId: string;
 *   record: object;
 *   listContextId: string;
 * }} props
 * @returns {React.ReactElement}
 */
const ListControlledItem = props => {
  const {
    children,
    className = '',
    isTemplate = false,
    itemCount = 0,
    record,
    parentId = '',
    listContextId = ''
  } = props;

  const {
    contexts: { DataSourceContext }
  } = usePlitziServiceContext();
  const { getSources } = use(DataSourceContext);
  const dataSourceValue = useMemo(() => ({ item: record, index: `${itemCount}` }), [record, itemCount]);
  const ListContext = useMemo(() => getSources(listContextId)?.context, [listContextId, getSources]);

  if (isTemplate) {
    return (
      <div className={classNames('plitzi-component__controlled-list-item', className)}>
        <div className="controlled-list-item__counter">{`List Item - ${itemCount}`}</div>
        <ReplicaProvider>
          <ListContext value={dataSourceValue}>{children}</ListContext>
        </ReplicaProvider>
      </div>
    );
  }

  return (
    <ReplicaProvider>
      <ListContext value={dataSourceValue}>{children}</ListContext>
    </ReplicaProvider>
  );
};

export default ListControlledItem;
