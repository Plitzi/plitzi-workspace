/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useCallback, useMemo } from 'react';

import StoreProvider from '@plitzi/nexus/StoreProvider';
import useRegisterSource from '@plitzi/sdk-shared/dataSource/hooks/useRegisterSource';
import useElement from '@plitzi/sdk-shared/elements/hooks/useElement';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import useCollectionContext from './hooks/useCollectionContext';
import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';
import type { InteractionCallback, SourceField } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type CollectionContainerProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  source?: string;
  children?: ReactNode;
  limit?: string;
  query?: RuleGroup;
  singleRecord?: boolean;
};

const CollectionContainer = ({
  ref,
  className = '',
  source = '',
  children,
  limit = '10',
  query,
  singleRecord = false
}: CollectionContainerProps) => {
  const {
    id,
    definition: { label = 'Collection Container' }
  } = useElement();
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();
  const { loading, collection, fetch } = useCollectionContext({ source, limit, query, singleRecord, previewMode });

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
      fields.push({ path: `record.values.${field.machineName}`, name: `Record Field - ${field.name}` });
    });

    return fields;
  }, [collection, singleRecord]);

  useRegisterSource({
    id,
    source: `collectionContainer_${id}`,
    name: label ? label : `Collection - ${collection?.name || id}`,
    fields: sourceFields
  });

  const interactionCallbacks = useMemo<Record<string, InteractionCallback>>(() => {
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
  }, [fetch, label]);

  if (!collection && previewMode) {
    return undefined;
  }

  return (
    <RootElement
      ref={ref}
      interactionCallbacks={interactionCallbacks}
      className={clsx('plitzi-component__collection-container', className, {
        'collection-container--context-empty': !collection
      })}
    >
      {!collection && <div className="collection-container__message">Source Not Selected</div>}
      {collection && !loading && (
        <StoreProvider inherit="live" value={{ runtime: { sources: { [`collectionContainer_${id}`]: collection } } }}>
          {children}
        </StoreProvider>
      )}
    </RootElement>
  );
};

export default withElement(CollectionContainer);

export { CollectionContainer };
