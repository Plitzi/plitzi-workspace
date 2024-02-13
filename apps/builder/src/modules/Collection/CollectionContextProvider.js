// Packages
import React, { useCallback, useContext, useMemo, useReducer, useRef } from 'react';
import PropTypes from 'prop-types';
import omit from 'lodash/omit';

// Alias
import CollectionContext from '@pmodules/Collection/CollectionContext';
import NetworkContext from '@pmodules/Network/NetworkContext';
import NetworkInternalContext from '@pmodules/Network/contexts/NetworkInternalContext';

// Relatives
import CollectionReducer, { CollectionsActions } from './CollectionReducer';

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
  const [collections, dispatchCollection] = useReducer(CollectionReducer, collectionsPropMemo);
  const collectionsRef = useRef(collections);
  collectionsRef.current = collections;

  const collectionsAdd = useCallback(
    collection => {
      dispatchCollection({
        type: CollectionsActions.COLLECTIONS_ADD,
        collections: { ...collectionsRef.current, [collection.id]: collection }
      });
    },
    [dispatchCollection]
  );

  const collectionsAddMany = useCallback(
    collectionsToAdd => {
      const collectionsToAddAux = {};
      collectionsToAdd.forEach(collection => {
        collectionsToAddAux[collection.id] = collection;
      });

      dispatchCollection({
        type: CollectionsActions.COLLECTIONS_ADD_MANY,
        collections: { ...collectionsRef.current, ...collectionsToAddAux }
      });
    },
    [dispatchCollection]
  );

  const collectionsUpdate = useCallback(
    collection => {
      dispatchCollection({
        type: CollectionsActions.COLLECTIONS_UPDATE,
        collections: { ...collectionsRef.current, [collection.id]: collection }
      });
    },
    [dispatchCollection]
  );

  const collectionsRemove = useCallback(
    collectionId => {
      dispatchCollection({
        type: CollectionsActions.COLLECTIONS_REMOVE,
        collections: omit(collectionsRef.current, [collectionId])
      });
    },
    [dispatchCollection]
  );

  const collectionRecordsAdd = useCallback(
    (collectionId, record) => {
      if (!collectionsRef.current[collectionId]) {
        return;
      }

      dispatchCollection({
        type: CollectionsActions.COLLECTION_RECORDS_ADD,
        collectionId,
        record
      });
    },
    [dispatchCollection]
  );

  const collectionRecordsAddMany = useCallback(
    (collectionId, records) => {
      if (!collectionsRef.current[collectionId]) {
        return;
      }

      dispatchCollection({
        type: CollectionsActions.COLLECTION_RECORDS_ADD_MANY,
        collectionId,
        records
      });
    },
    [dispatchCollection]
  );

  const collectionRecordsUpdate = useCallback(
    (collectionId, record) => {
      if (!collectionsRef.current[collectionId]) {
        return;
      }

      dispatchCollection({
        type: CollectionsActions.COLLECTION_RECORDS_UPDATE,
        collectionId,
        record
      });
    },
    [dispatchCollection]
  );

  const collectionRecordsRemove = useCallback(
    (collectionId, recordId) => {
      if (!collectionsRef.current[collectionId]) {
        return;
      }

      dispatchCollection({
        type: CollectionsActions.COLLECTION_RECORDS_REMOVE,
        collectionId,
        recordId
      });
    },
    [dispatchCollection]
  );

  const fetchCollections = useCallback(
    async (filter, cursor, limit, append = [], store = true) => {
      const result = await query('Collections', { filter, cursor, limit }, 'network-only');
      if (!result) {
        return null;
      }

      if (store) {
        collectionsAddMany([...append, ...result.edges]);
      }

      return result;
    },
    [query, collectionsAddMany]
  );

  const fetchCollection = useCallback(
    async (id, recordsFilter, store = true) => {
      const result = await query('Collection', { id, recordsFilter }, 'network-only');
      if (!result) {
        return null;
      }

      if (store) {
        collectionsAdd({ ...result, records: result.records.edges ?? [] });
      }

      return result;
    },
    [query, collectionsAdd]
  );

  // Queries

  const fetchRecords = useCallback(
    async (collectionId, filter, cursor, limit, append = [], store = true) => {
      const result = await query('CollectionRecords', { collectionId, filter, cursor, limit }, 'network-only');
      if (!result) {
        return null;
      }

      if (store) {
        collectionRecordsAddMany(collectionId, [...append, ...result.edges]);
      }

      return result;
    },
    [query, collectionRecordsAddMany]
  );

  const fetchRecord = useCallback(
    async (collectionId, id, store = true) => {
      const result = await query('CollectionRecord', { collectionId, id }, 'network-only');
      if (!result) {
        return null;
      }

      if (store) {
        collectionRecordsAdd(collectionId, result);
      }

      return result;
    },
    [query, collectionRecordsAdd]
  );

  // Mutations

  const addCollection = useCallback(
    async (name, namePlural, description, privacy, fields) => {
      const result = await mutate('CollectionAdd', { name, namePlural, description, privacy, fields });
      if (result) {
        collectionsAdd(result);
      }

      return result;
    },
    [mutate, collectionsAdd]
  );

  const updateCollection = useCallback(
    async (id, name, namePlural, description, privacy, fields) => {
      const result = await mutate('CollectionUpdate', { id, name, namePlural, description, privacy, fields });
      if (result) {
        collectionsUpdate(result);
      }

      return result;
    },
    [mutate, collectionsUpdate]
  );

  const removeCollection = useCallback(
    async id => {
      const result = await mutate('CollectionRemove', { id });
      if (result) {
        collectionsRemove(id);
      }

      return result;
    },
    [mutate, collectionsRemove]
  );

  const addRecord = useCallback(
    async (collectionId, status, values, updateStore = true) => {
      const result = await mutate('CollectionAddRecord', { collectionId, status, values });
      if (result && updateStore) {
        collectionRecordsAdd(collectionId, result);
      }

      return result;
    },
    [mutate, collectionRecordsAdd]
  );

  const updateRecord = useCallback(
    async (collectionId, id, status, values, updateStore = true) => {
      const result = await mutate('CollectionUpdateRecord', { id, status, values });
      if (result && updateStore) {
        collectionRecordsUpdate(collectionId, result);
      }

      return result;
    },
    [mutate, collectionRecordsUpdate]
  );

  const removeRecord = useCallback(
    async (collectionId, id, updateStore = true) => {
      const result = await mutate('CollectionRemoveRecord', { id });
      if (result && updateStore) {
        collectionRecordsRemove(collectionId, id);
      }

      return !!result;
    },
    [mutate, collectionRecordsRemove]
  );

  const collectionContextValue = useMemo(
    () => ({
      collections,
      fetchCollections,
      fetchCollection,
      addCollection,
      updateCollection,
      removeCollection,
      fetchRecords,
      fetchRecord,
      addRecord,
      updateRecord,
      removeRecord
    }),
    [
      collections,
      fetchCollections,
      fetchCollection,
      addCollection,
      updateCollection,
      removeCollection,
      fetchRecords,
      fetchRecord,
      addRecord,
      updateRecord,
      removeRecord
    ]
  );

  return <CollectionContext.Provider value={collectionContextValue}>{children}</CollectionContext.Provider>;
};

CollectionContextProvider.propTypes = {
  children: PropTypes.node,
  collections: PropTypes.object
};

export default CollectionContextProvider;
