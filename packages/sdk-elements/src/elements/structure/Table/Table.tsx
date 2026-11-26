import { get } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { useCallback, useMemo, useRef } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';
import { getSourceName } from '@plitzi/sdk-shared/dataSource/helpers';
import { getPathsFromObject } from '@plitzi/sdk-shared/helpers';
import { replaceEqualDeep } from '@plitzi/sdk-shared/helpers/replaceEqualDeep';
import { usePlitzi } from '@plitzi/sdk-shared/hooks';

import declaration from './declaration';
import { TablePartContext } from './TablePart';
import sourceStore from '../../../dataSource/sourceStore';
import useRegisterSource from '../../../dataSource/useRegisterSource';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';
import ListControlledItem from '../List/modes/ListControlled/ListControlledItem';
import { rowKeys } from '../List/modes/ListControlled/rowKeys';

import type { SourceField } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type TableProps<T = unknown> = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  /** Its columns: `tableColumn` elements, each a header and the cell every row draws. */
  children?: ReactNode;
  /** Its rows, one an item: written out, or bound to a source. */
  items?: T[];
  /**
   * The field of each item that names it — `'slug'`, `'sku'` — so a row stays with its item when the items are
   * filtered or reordered. Left out: the item's `id`, else its position.
   */
  itemKey?: string;
  /** What the table is, said before it by a screen reader and drawn above it (`<caption>`). */
  caption?: string;
};

/** One empty table for every table with no rows, so an empty one stays the same array. */
const NO_ITEMS: unknown[] = [];

/**
 * A table of data: a `<table>` whose head is each column's header (`<th scope="col">`) and whose rows are its items, each
 * column drawing that row's cell — read as a table by a screen reader and a search engine, which a grid of rows is not.
 * A column shown or hidden (its `visible`) is gone from the head and every row at once.
 */
const Table = ({ ref, className = '', children, items = [], itemKey, caption = '' }: TableProps) => {
  const {
    id,
    definition: { label: elementLabel, styleSelectors }
  } = useElement();
  const sourceName = getSourceName(declaration.sourceType, id);
  const {
    settings: { previewMode }
  } = usePlitzi();
  // The rows, each the same object as last time while it is equal to it: a source that publishes the same data again
  // draws no row again (as a list's).
  const lastItems = useRef<unknown[]>(NO_ITEMS);
  const rows = useMemo(() => {
    const kept = replaceEqualDeep(lastItems.current, Array.isArray(items) ? items : NO_ITEMS);
    lastItems.current = kept;

    return kept;
  }, [items]);
  const keys = useMemo(() => rowKeys(rows, itemKey), [rows, itemKey]);
  const sourceFields = useCallback(
    () =>
      getPathsFromObject({ item: get(rows, '0', {}), index: 0 }).reduce<SourceField[]>(
        (acum, path) => [...acum, { path, name: path }],
        []
      ),
    [rows]
  );
  const storeContextValue = useMemo(() => sourceStore(sourceName, { items: rows }), [sourceName, rows]);

  useRegisterSource({
    id,
    source: sourceName,
    name: elementLabel ? elementLabel : `Table - ${id}`,
    fields: sourceFields
  });

  // In the builder a table with no rows yet draws one, empty: its cells are where its columns are edited.
  const drawn = rows.length === 0 && !previewMode ? [{}] : rows;

  return (
    <RootElement ref={ref} tag="table" className={clsx('plitzi-component__table', className)}>
      {caption && (
        <caption className={clsx('plitzi-component__table-caption', styleSelectors.caption)}>{caption}</caption>
      )}
      <thead className={clsx('plitzi-component__table-head', styleSelectors.head)}>
        <tr>
          <TablePartContext value="head">{children}</TablePartContext>
        </tr>
      </thead>
      <StoreProvider inherit="live" name={`Table:${id}`} value={storeContextValue}>
        <tbody className="plitzi-component__table-body">
          {drawn.map((item, i) => (
            <tr key={keys[i] ?? i} className={clsx('plitzi-component__table-row', styleSelectors.row)}>
              <TablePartContext value="row">
                <ListControlledItem
                  rowKey={keys[i] ?? i}
                  index={i}
                  isTemplate={false}
                  record={item}
                  source={sourceName}
                >
                  {children}
                </ListControlledItem>
              </TablePartContext>
            </tr>
          ))}
        </tbody>
      </StoreProvider>
    </RootElement>
  );
};

export default withElement(Table);

export { Table };
