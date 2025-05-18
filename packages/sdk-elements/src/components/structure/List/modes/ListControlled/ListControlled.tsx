import classNames from 'classnames';
import get from 'lodash/get';
import { useCallback, use, useMemo } from 'react';

import { getPathsFromObeject } from '@plitzi/sdk-shared/helpers/utils';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import ListControlledItem from './ListControlledItem';
import RootElement from '../../../../../Element/RootElement';

import type { SourceField, InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type ListControlledProps<T = unknown> = {
  ref?: RefObject<HTMLElement>;
  className: string;
  internalProps: InternalPropsSTG2;
  children: ReactNode;
  items: T[];
};

const ListControlled = ({ ref, className = '', internalProps, children, items = [] }: ListControlledProps) => {
  const { id } = internalProps;
  const {
    settings: { previewMode },
    contexts: { DataSourceContext }
  } = usePlitziServiceContext();
  const { useDataSource } = use(DataSourceContext);
  const finalItems = useMemo(() => {
    if (Array.isArray(items)) {
      return items;
    }

    return [];
  }, [items]);

  const sourceFields = useCallback(
    () =>
      getPathsFromObeject({ item: get(finalItems, '0', {}), index: '0' }).reduce<SourceField[]>(
        (acum, path) => [...acum, { path, name: path }],
        []
      ),
    [finalItems]
  );

  const listContextValue = useMemo(() => ({ items: finalItems }), [finalItems]);

  const sourceName = useMemo(
    () => get(internalProps, 'definition.label', `List - ${id}`) as string,
    [id, internalProps]
  );

  const [ListContext, listContextId] = useDataSource({
    id,
    source: `list_${id}`,
    mode: 'write',
    name: sourceName,
    fields: sourceFields
  });

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__controlled-list', className, {
        'controlled-list--build-mode': !previewMode
      })}
    >
      <ListContext value={listContextValue}>
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
              key={i}
              itemCount={i + 1}
              isTemplate={i !== 0 && !previewMode}
              record={item}
              listContextId={listContextId}
            >
              {children}
            </ListControlledItem>
          );
        })}
      </ListContext>
      {!previewMode && finalItems.length === 0 && (
        <div className="controlled-list controlled-list--empty">This list does not contain any items</div>
      )}
    </RootElement>
  );
};

export default ListControlled;
