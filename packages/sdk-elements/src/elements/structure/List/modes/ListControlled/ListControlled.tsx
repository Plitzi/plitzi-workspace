import { get } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { useCallback, useMemo } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';
import useRegisterSource from '@plitzi/sdk-shared/dataSource/hooks/useRegisterSource';
import { getPathsFromObeject } from '@plitzi/sdk-shared/helpers/utils';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import ListControlledItem from './ListControlledItem';
import useElement from '../../../../../Element/hooks/useElement';
import RootElement from '../../../../../Element/RootElement';

import type { SourceField } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

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
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();
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

  useRegisterSource({
    id,
    source: `list_${id}`,
    name: label ? label : `List - ${id}`,
    fields: sourceFields
  });

  return (
    <RootElement
      ref={ref}
      className={clsx('plitzi-component__controlled-list', className, {
        'controlled-list--build-mode': !previewMode
      })}
    >
      <StoreProvider inherit="live" value={{ runtime: { sources: { [`list_${id}`]: listContextValue } } }}>
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
              source={`list_${id}`}
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
