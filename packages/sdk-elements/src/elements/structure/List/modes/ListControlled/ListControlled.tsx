import { get } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { useCallback, useMemo } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';
import getSourceName from '@plitzi/sdk-shared/dataSource/helpers/getSourceName';
import useRegisterSource from '@plitzi/sdk-shared/dataSource/hooks/useRegisterSource';
import { emptyObject, getPathsFromObeject } from '@plitzi/sdk-shared/helpers/utils';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import ListControlledItem from './ListControlledItem';
import useElement from '../../../../../Element/hooks/useElement';
import RootElement from '../../../../../Element/RootElement';
import declaration from '../../declaration';

import type { SourceField } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

/**
 * What tells one row from another across renders: each record's `id`, when every record has one and no two share it,
 * else its position.
 *
 * A row holds state of its own — a panel it opened, a field it filled — and React gives that state to whichever row
 * comes back under the same key. Keyed by position, filtering a list handed a row's state to the record that moved
 * into its place: the details opened on one product showed open on another.
 */
const rowKeys = (items: unknown[]): (string | number)[] => {
  const ids = items.map(item =>
    item !== null &&
    typeof item === 'object' &&
    'id' in item &&
    (typeof item.id === 'string' || typeof item.id === 'number')
      ? item.id
      : undefined
  );
  const unique = ids.every(key => key !== undefined) && new Set(ids).size === ids.length;

  return unique ? ids.map(key => `id:${String(key)}`) : items.map((_item, index) => index);
};

export type ListControlledProps<T = unknown> = {
  ref?: RefObject<HTMLElement>;
  className: string;
  children: ReactNode;
  items: T[];
};

const ListControlled = ({ ref, className = '', children, items = [] }: ListControlledProps) => {
  const {
    id,
    definition: { label }
  } = useElement();
  const sourceName = getSourceName(declaration.sourceType, id);
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();
  const finalItems = useMemo(() => {
    if (Array.isArray(items)) {
      return items;
    }

    return [];
  }, [items]);

  const keys = useMemo(() => rowKeys(finalItems), [finalItems]);

  const sourceFields = useCallback(
    () =>
      getPathsFromObeject({ item: get(finalItems, '0', {}), index: '0' }).reduce<SourceField[]>(
        (acum, path) => [...acum, { path, name: path }],
        []
      ),
    [finalItems]
  );

  const storeContextValue = useMemo(
    () => (sourceName ? { runtime: { sources: { [sourceName]: { items: finalItems } } } } : emptyObject),
    [sourceName, finalItems]
  );

  useRegisterSource({ id, source: sourceName, name: label ? label : `List - ${id}`, fields: sourceFields });

  return (
    <RootElement
      ref={ref}
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
