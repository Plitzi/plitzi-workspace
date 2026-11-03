import { get } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { useCallback, useMemo, useRef } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';
import { getSourceName } from '@plitzi/sdk-shared/dataSource/helpers';
import { getPathsFromObject, replaceEqualDeep } from '@plitzi/sdk-shared/helpers';
import { usePlitzi } from '@plitzi/sdk-shared/hooks';

import ListControlledItem from './ListControlledItem';
import { rowKeys } from './rowKeys';
import sourceStore from '../../../../../dataSource/sourceStore';
import useRegisterSource from '../../../../../dataSource/useRegisterSource';
import useElement from '../../../../../Element/hooks/useElement';
import RootElement from '../../../../../Element/RootElement';
import declaration from '../../declaration';

import type { SourceField } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type ListControlledProps<T = unknown> = {
  ref?: RefObject<HTMLElement>;
  className: string;
  /** The list's own tag: a list of data is a list, and each row — an `<li>` — renders straight into it. */
  subType?: 'ul' | 'ol';
  children: ReactNode;
  items: T[];
  itemKey?: string;
  /** The list's accessible name. */
  label?: string;
};

/** One empty list for every list with no rows, so an empty one stays the same array. */
const NO_ITEMS: unknown[] = [];

const ListControlled = ({
  ref,
  className = '',
  subType = 'ul',
  children,
  items = [],
  itemKey,
  label = ''
}: ListControlledProps) => {
  const {
    id,
    definition: { label: elementLabel }
  } = useElement();
  const sourceName = getSourceName(declaration.sourceType, id);
  const {
    settings: { previewMode }
  } = usePlitzi();
  /**
   * The rows, each the same object as last time while it is equal to it (`replaceEqualDeep`): bound to any source, a
   * list is handed a new array of new objects whenever that source publishes, the same data or not, and every row —
   * everything drawn in it — drew again for each. A row that did not change keeps its record, and draws nothing.
   */
  const lastItems = useRef<unknown[]>(NO_ITEMS);
  const finalItems = useMemo(() => {
    const kept = replaceEqualDeep(lastItems.current, Array.isArray(items) ? items : NO_ITEMS);
    lastItems.current = kept;

    return kept;
  }, [items]);

  const keys = useMemo(() => rowKeys(finalItems, itemKey), [finalItems, itemKey]);

  const sourceFields = useCallback(
    () =>
      getPathsFromObject({ item: get(finalItems, '0', {}), index: 0 }).reduce<SourceField[]>(
        (acum, path) => [...acum, { path, name: path }],
        []
      ),
    [finalItems]
  );

  const storeContextValue = useMemo(() => sourceStore(sourceName, { items: finalItems }), [sourceName, finalItems]);

  useRegisterSource({
    id,
    source: sourceName,
    name: elementLabel ? elementLabel : `List - ${id}`,
    fields: sourceFields
  });

  return (
    <RootElement
      ref={ref}
      tag={subType}
      aria-label={label || undefined}
      className={clsx('plitzi-component__controlled-list', className, {
        'controlled-list--build-mode': !previewMode
      })}
    >
      <StoreProvider inherit="live" name={`List:${id}`} value={storeContextValue}>
        {finalItems.map((item, i) => {
          if (!children || (Array.isArray(children) && children.length === 0)) {
            return (
              <div className="plitzi-component__controlled-list-item controlled-list--empty" key={i}>
                <div className="controlled-list-item__counter">{`List Item - ${i + 1}`}</div>
              </div>
            );
          }

          return (
            <ListControlledItem
              key={keys[i]}
              rowKey={keys[i]}
              index={i}
              isTemplate={i !== 0 && !previewMode}
              record={item}
              source={sourceName}
            >
              {children}
            </ListControlledItem>
          );
        })}
      </StoreProvider>
      {!previewMode && finalItems.length === 0 && (
        <div className="controlled-list controlled-list--empty">This list does not contain any items</div>
      )}
    </RootElement>
  );
};

export default ListControlled;
