import clsx from 'clsx';
import { useId, useMemo } from 'react';

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
  // A per-row `segment` gives each replica scope a distinct `scopePath`, which `useElementState` folds into a sub-key
  // so duplicated element ids (every row renders the same template ids) keep isolated state in the shared store.
  // `useId` is a unique, stable identity per row instance — independent of the row index and free of any global
  // record→id bookkeeping, so the segment never collides across sibling lists.
  const segment = useId();

  const scopedRow = (
    <ReplicaProvider>
      <StoreProvider inherit="live" segment={segment} value={{ runtime: { sources: { [source]: dataSourceValue } } }}>
        {children}
      </StoreProvider>
    </ReplicaProvider>
  );

  if (isTemplate) {
    return (
      <div className={clsx('plitzi-component__controlled-list-item', className)}>
        <div className="controlled-list-item__counter">{`List Item - ${itemCount}`}</div>
        {scopedRow}
      </div>
    );
  }

  return scopedRow;
};

export default ListControlledItem;
