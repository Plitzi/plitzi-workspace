import clsx from 'clsx';
import { use, useId, useMemo } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';

import sourceStore from '../../../../../dataSource/sourceStore';
import ReplicaProvider from '../../../../../Element/ReplicaProvider';
import { RowAnchorContext, rowAnchorName } from '../../../../../Element/RowAnchor';

import type { ReactNode } from 'react';

export type ListControlledItemProps<T = unknown> = {
  children: ReactNode;
  className?: string;
  isTemplate: boolean;
  /** The row's own position, from zero — what `index` publishes, and what indexes back into the bound array. */
  index: number;
  /** What tells this row from the others (`rowKeys`): the name its anchors are drawn with. */
  rowKey?: string | number;
  record: T;
  source: string;
};

const ListControlledItem = ({
  children,
  className = '',
  isTemplate = false,
  index = 0,
  rowKey,
  record,
  source = ''
}: ListControlledItemProps) => {
  const outerRows = use(RowAnchorContext);
  const rows = useMemo(() => [...outerRows, rowAnchorName(rowKey ?? index)], [outerRows, rowKey, index]);
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
    // A number, so a template counts with it (`index + 1`); `==` reads `'2'` and `2` alike, so text compares as before.
    () => sourceStore(source, { item: record, index }),
    [source, record, index]
  );

  const scopedRow = (
    <ReplicaProvider>
      <StoreProvider inherit="live" name={`Row:${source}`} segment={segment} value={storeContextValue}>
        <RowAnchorContext value={rows}>{children}</RowAnchorContext>
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
