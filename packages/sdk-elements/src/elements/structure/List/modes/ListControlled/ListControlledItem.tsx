import clsx from 'clsx';
import { useId, useMemo } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';

import ReplicaProvider from '../../../../../Element/ReplicaProvider';

import type { ReactNode } from 'react';

export type ListControlledItemProps<T = unknown> = {
  children: ReactNode;
  className?: string;
  isTemplate: boolean;
  /** The row's own position, from zero — what `index` publishes, and what indexes back into the bound array. */
  index: number;
  record: T;
  source: string;
};

const ListControlledItem = ({
  children,
  className = '',
  isTemplate = false,
  index = 0,
  record,
  source = ''
}: ListControlledItemProps) => {
  // A per-row `segment` gives each replica scope a distinct `scopePath`, which `useElementState` folds into a sub-key
  // so duplicated element ids (every row renders the same template ids) keep isolated state in the shared store.
  // `useId` is a unique, stable identity per row instance — independent of the row index and free of any global
  // record→id bookkeeping, so the segment never collides across sibling lists.
  const segment = useId();

  // A row rendered outside a list carries no `source`, so it contributes no scope value rather than a `sources['']`
  // key nothing could ever address.
  /**
   * The row's POSITION, from zero — not the human count.
   *
   * It used to publish `i + 1`, the number the builder's template label shows, and the two are not the same thing:
   * anything using `index` to reach back into the array it came from — removing this row, reading the entry beside
   * it — was off by one, silently, and acted on its neighbour. The label is a separate expression now, because a
   * person counting rows starts at one and an array does not.
   */
  const storeContextValue = useMemo(
    () => (source ? { runtime: { sources: { [source]: { item: record, index: `${index}` } } } } : emptyObject),
    [source, record, index]
  );

  const scopedRow = (
    <ReplicaProvider>
      <StoreProvider inherit="live" name={`Row:${source}`} segment={segment} value={storeContextValue}>
        {children}
      </StoreProvider>
    </ReplicaProvider>
  );

  if (isTemplate) {
    return (
      <div className={clsx('plitzi-component__controlled-list-item', className)}>
        <div className="controlled-list-item__counter">{`List Item - ${index + 1}`}</div>
        {scopedRow}
      </div>
    );
  }

  return scopedRow;
};

export default ListControlledItem;
