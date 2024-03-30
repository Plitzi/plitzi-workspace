// Packages
import React, { forwardRef, useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import capitalize from 'lodash/capitalize';
import get from 'lodash/get';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relatives
import usePlitziServiceContext from '../../../services/hooks/usePlitziServiceContext';
import useCollectionContext from './hooks/useCollectionContext';

const CollectionContainer = forwardRef((props, ref) => {
  const {
    className = '',
    internalProps = emptyObject,
    source = '',
    children,
    limit = '10',
    query = '',
    singleRecord = false
  } = props;
  const { loading, collection, fetch } = useCollectionContext({ source, limit, query, singleRecord });
  const { id } = internalProps;
  const {
    settings: { previewMode },
    contexts: { DataSourceContext }
  } = usePlitziServiceContext();
  const { useDataSource } = useContext(DataSourceContext);

  const sourceFields = useCallback(() => {
    const fields = [];
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
    () => get(internalProps, 'definition.label', `Collection - ${collection?.name || id}`),
    [id, internalProps?.definition?.label, collection?.name]
  );

  useDataSource({ id, source: `collectionContainer_${id}`, name: sourceName, value: collection, fields: sourceFields });

  const handleFetch = useCallback(
    async (/* params */) => {
      if (fetch) {
        await fetch();
      }
    },
    [fetch]
  );

  const interactionCallbacks = useMemo(() => {
    const label = get(internalProps, 'definition.label', 'Collection Container');

    return { performQuery: { title: `Refresh ${label}`, callback: handleFetch, preview: {}, params: {} } };
  }, [handleFetch, internalProps?.definition?.label]);

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
      {collection && !loading && children}
    </RootElement>
  );
});

CollectionContainer.propTypes = {
  className: PropTypes.string,
  internalProps: PropTypes.object,
  children: PropTypes.node,
  limit: PropTypes.string,
  query: PropTypes.string,
  singleRecord: PropTypes.bool,
  source: PropTypes.string
};

export default withElement(CollectionContainer);

export { CollectionContainer };
