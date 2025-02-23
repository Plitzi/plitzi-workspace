import classNames from 'classnames';
import { useMemo, use } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';

import ReplicaProvider from '../../../../../Element/ReplicaProvider';

import type { Context, ReactNode } from 'react';

export type ListControlledItemProps = {
  children: ReactNode;
  className: string;
  isTemplate: boolean;
  itemCount: number;
  record: object;
  listContextId: string;
};

const ListControlledItem = ({
  children,
  className = '',
  isTemplate = false,
  itemCount = 0,
  record,
  listContextId = ''
}: ListControlledItemProps) => {
  const {
    contexts: { DataSourceContext }
  } = usePlitziServiceContext();
  const { getSources } = use(DataSourceContext);
  const dataSourceValue = useMemo(() => ({ item: record, index: `${itemCount}` }), [record, itemCount]);
  const ListContext = useMemo(
    () => getSources(listContextId)?.context as Context<typeof dataSourceValue> | undefined,
    [listContextId, getSources]
  );

  if (isTemplate) {
    return (
      <div className={classNames('plitzi-component__controlled-list-item', className)}>
        <div className="controlled-list-item__counter">{`List Item - ${itemCount}`}</div>
        <ReplicaProvider>
          {ListContext && <ListContext value={dataSourceValue}>{children}</ListContext>}
          {!ListContext && 'This element can be only inside a List'}
        </ReplicaProvider>
      </div>
    );
  }

  return (
    <ReplicaProvider>
      {ListContext && <ListContext value={dataSourceValue}>{children}</ListContext>}
      {!ListContext && 'This element can be only inside a List'}
    </ReplicaProvider>
  );
};

export default ListControlledItem;
