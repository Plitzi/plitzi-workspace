/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import capitalize from 'lodash/capitalize.js';
import get from 'lodash/get.js';
import { useCallback, use, useMemo } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import useCollectionContext from './hooks/useCollectionContext';
import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';
import type { InteractionBaseCallback, InternalPropsSTG2, SourceField } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type CollectionContainerProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  internalProps: InternalPropsSTG2;
  source?: string;
  children?: ReactNode;
  limit?: string;
  query?: RuleGroup;
  singleRecord?: boolean;
};

const CollectionContainer = ({
  ref,
  className = '',
  internalProps,
  source = '',
  children,
  limit = '10',
  query,
  singleRecord = false
}: CollectionContainerProps) => {
  const { id } = internalProps;
  const {
    settings: { previewMode },
    contexts: { DataSourceContext }
  } = usePlitziServiceContext();
  const { loading, collection, fetch } = useCollectionContext({ source, limit, query, singleRecord, previewMode });
  const { useDataSource } = use(DataSourceContext);

  const sourceFields = useCallback(() => {
    const fields: SourceField[] = [];
    if (!collection) {
      return [];
    }

    if (!singleRecord) {
      fields.push({ path: 'records', name: 'Records' });
    }

    fields.push({ path: 'record.id', name: 'Record ID' });
    fields.push({ path: 'record.status', name: 'Record Status' });

    Object.values(collection.fields).forEach(field => {
      fields.push({ path: `record.values.${field.machineName}`, name: `Record Field - ${capitalize(field.name)}` });
    });

    return fields;
  }, [collection, singleRecord]);

  const sourceName = useMemo(
    () => get(internalProps, 'definition.label', `Collection - ${collection?.name || id}`) as string,
    [internalProps, collection?.name, id]
  );

  const [CollectionContext] = useDataSource({
    id,
    source: `collectionContainer_${id}`,
    mode: 'write',
    name: sourceName,
    fields: sourceFields
  });

  const interactionCallbacks = useMemo<Record<string, InteractionBaseCallback>>(() => {
    const label = get(internalProps, 'definition.label', 'Collection Container') as string;

    return {
      performQuery: {
        action: 'performQuery',
        title: `Refresh ${label}`,
        type: 'callback',
        callback: fetch,
        preview: {},
        params: {}
      }
    };
  }, [fetch, internalProps]);

  if (!collection && previewMode) {
    return undefined;
  }

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      interactionCallbacks={interactionCallbacks}
      className={classNames('plitzi-component__collection-container', className, {
        'collection-container--context-empty': !collection
      })}
    >
      {!collection && <div className="collection-container__message">Source Not Selected</div>}
      {collection && !loading && <CollectionContext value={collection}>{children}</CollectionContext>}
    </RootElement>
  );
};

export default withElement(CollectionContainer);

export { CollectionContainer };
