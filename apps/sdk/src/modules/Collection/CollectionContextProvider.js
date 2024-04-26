// Packages
import React, { useCallback, useContext, useMemo } from 'react';

// Alias
import NetworkContext from '@modules/Network/NetworkContext';
import NetworkInternalContext from '@modules/Network/contexts/NetworkInternalContext';

// Relatives
import CollectionContext from './CollectionContext';

const CollectionContextProvider = props => {
  const { children, collections: collectionsProp } = props;
  const { query, mutate } = useContext(NetworkContext);
  const internalData = useContext(NetworkInternalContext);
  const collectionsPropMemo = useMemo(() => {
    if (collectionsProp) {
      return collectionsProp;
    }

    return internalData.collections ?? {};
  }, [collectionsProp]);

  const fetchCollections = useCallback(
    async (filter, cursor, limit) => query('Collections', { filter, cursor, limit }, 'network-only'),
    []
  );

  const fetchCollection = useCallback(
    async (id, recordsFilter) => query('Collection', { id, recordsFilter }, 'network-only'),
    []
  );

  // Queries

  const fetchRecords = useCallback(
    async (collectionId, filter, cursor, limit) =>
      query('CollectionRecords', { collectionId, filter, cursor, limit }, 'network-only'),
    []
  );

  const fetchRecord = useCallback(
    (collectionId, id) => query('CollectionRecord', { collectionId, id }, 'network-only'),
    []
  );

  // Mutations

  const addRecord = useCallback(
    async (collectionId, status, values) => {
      const result = await mutate('CollectionAddRecord', { collectionId, status, values });

      return result;
    },
    [mutate]
  );

  const updateRecord = useCallback(
    async (collectionId, recordId, status, values) => {
      const result = await mutate('CollectionUpdateRecord', { id: recordId, status, values });

      return result;
    },
    [mutate]
  );

  const removeRecord = useCallback(
    async (collectionId, id) => {
      const result = await mutate('CollectionRemoveRecord', { id });

      return !!result;
    },
    [mutate]
  );

  const collectionContextValue = useMemo(
    () => ({
      collections: collectionsPropMemo,
      fetchCollections,
      fetchCollection,
      fetchRecords,
      fetchRecord,
      addRecord,
      updateRecord,
      removeRecord
    }),
    [
      collectionsPropMemo,
      fetchCollections,
      fetchCollection,
      fetchRecords,
      fetchRecord,
      addRecord,
      updateRecord,
      removeRecord
    ]
  );

  return <CollectionContext.Provider value={collectionContextValue}>{children}</CollectionContext.Provider>;
};

export default CollectionContextProvider;
