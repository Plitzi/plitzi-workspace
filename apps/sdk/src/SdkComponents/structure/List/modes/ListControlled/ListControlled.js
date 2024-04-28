// Packages
import React, { useCallback, use, useMemo } from 'react';
import classNames from 'classnames';
import get from 'lodash/get';

// Monorepo
import { emptyObject, getPathsFromObeject } from '@plitzi/sdk-shared/utils';

// Alias
import RootElement from '@modules/Element/RootElement';

// Relatives
import usePlitziServiceContext from '../../../../../services/hooks/usePlitziServiceContext';
import ListControlledItem from './ListControlledItem';

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   className: string;
 *   internalProps: object;
 *   children: React.ReactNode;
 *   items: any[];
 * }} props
 * @returns {React.ReactElement}
 */
const ListControlled = props => {
  const { ref, className = '', internalProps = emptyObject, children, items = [] } = props;
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
    async () =>
      getPathsFromObeject({ item: get(finalItems, '0', {}) }).reduce(
        (acum, path) => [...acum, { path, name: path }],
        []
      ),
    [finalItems]
  );

  const listContextValue = useMemo(() => ({ items: finalItems }), [finalItems]);

  const sourceName = useMemo(
    () => get(internalProps, 'definition.label', `List - ${id}`),
    [id, internalProps?.definition?.label]
  );

  useDataSource({ id, source: `list_${id}`, name: sourceName, value: listContextValue, fields: sourceFields });

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__controlled-list', className, {
        'controlled-list--build-mode': !previewMode
      })}
    >
      {finalItems.map((item, i) => {
        if (!children || (Array.isArray(children) && children.length === 0)) {
          return (
            <div className="plitzi-component__controlled-list-item controlled-list--empty" key={i}>
              <div className="controlled-list-item__counter">{`List Item - ${i + 1}`}</div>
            </div>
          );
        }

        return (
          <ListControlledItem key={i} itemCount={i} parentId={id} isTemplate={i !== 0 && !previewMode} record={item}>
            {children}
          </ListControlledItem>
        );
      })}
      {!previewMode && finalItems.length === 0 && (
        <div className="controlled-list controlled-list--empty">This list does not contain any items</div>
      )}
    </RootElement>
  );
};

export default ListControlled;
