import clsx from 'clsx';
import { useMemo } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';

import ReplicaProvider from '../../../../../Element/ReplicaProvider';

import type { ReactNode } from 'react';

export type ListControlledItemProps<T = unknown> = {
  children: ReactNode;
  className?: string;
  isTemplate: boolean;
  itemCount: number;
  record: T;
  source: string;
};

const ListControlledItem = ({
  children,
  className = '',
  isTemplate = false,
  itemCount = 0,
  record,
  source = ''
}: ListControlledItemProps) => {
  const dataSourceValue = useMemo(() => ({ item: record, index: `${itemCount}` }), [record, itemCount]);

  if (isTemplate) {
    return (
      <div className={clsx('plitzi-component__controlled-list-item', className)}>
        <div className="controlled-list-item__counter">{`List Item - ${itemCount}`}</div>
        <ReplicaProvider>
          <StoreProvider inherit="live" value={{ runtime: { sources: { [source]: dataSourceValue } } }}>
            {children}
          </StoreProvider>
        </ReplicaProvider>
      </div>
    );
  }

  return (
    <ReplicaProvider>
      <StoreProvider inherit="live" value={{ runtime: { sources: { [source]: dataSourceValue } } }}>
        {children}
      </StoreProvider>
    </ReplicaProvider>
  );
};

export default ListControlledItem;
