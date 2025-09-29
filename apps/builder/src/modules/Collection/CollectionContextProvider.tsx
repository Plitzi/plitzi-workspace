import omit from 'lodash/omit';
import { useCallback, use, useMemo, useReducer, useRef } from 'react';

import CollectionContext from '@pmodules/Collection/CollectionContext';
import NetworkInternalContext from '@pmodules/Network/contexts/NetworkInternalContext';
import NetworkContext from '@pmodules/Network/NetworkContext';

import CollectionReducer, { CollectionsActions } from './CollectionReducer';

import type { Collection, CollectionRecord } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type CollectionContextProviderProps = {
  children: ReactNode;
  collections?: Record<string, Collection>;
};

const CollectionContextProvider = ({ children, collections: collectionsProp }: CollectionContextProviderProps) => {
  const { query, mutate } = use(NetworkContext);
  const internalData = use(NetworkInternalContext);
  const collectionsPropMemo = useMemo(() => {
    if (collectionsProp) {
      return collectionsProp;
    }

    return internalData.collections;
  }, [collectionsProp, internalData.collections]);
  const [collections, dispatchCollection] = useReducer(CollectionReducer, collectionsPropMemo);
  const collectionsRef = useRef(collections);
  collectionsRef.current = collections;

  const collectionsAdd = useCallback(
    (collection: Collection) => {
      dispatchCollection({
        type: CollectionsActions.COLLECTIONS_ADD,
        collections: { ...collectionsRef.current, [collection.id]: collection }
      });
    },
    [dispatchCollection]
  );

  const collectionsAddMany = useCallback(
    (collectionsToAdd: Collection[]) => {
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
    (collection: Collection) => {
      dispatchCollection({
        type: CollectionsActions.COLLECTIONS_UPDATE,
        collections: { ...collectionsRef.current, [collection.id]: collection }
      });
    },
    [dispatchCollection]
  );

  const collectionsRemove = useCallback(
    (collectionId: string) => {
      dispatchCollection({
        type: CollectionsActions.COLLECTIONS_REMOVE,
        collections: omit(collectionsRef.current, [collectionId])
      });
    },
    [dispatchCollection]
  );

  const collectionRecordsAdd = useCallback(
    (collectionId: string, record: CollectionRecord) => {
      if (!(collectionsRef.current[collectionId] as Collection | undefined)) {
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
    (collectionId: string, records: CollectionRecord[]) => {
      if (!(collectionsRef.current[collectionId] as Collection | undefined)) {
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
    (collectionId: string, record: CollectionRecord) => {
      if (!(collectionsRef.current[collectionId] as Collection | undefined)) {
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
    (collectionId: string, recordId: string) => {
      if (!(collectionsRef.current[collectionId] as Collection | undefined)) {
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
    async (filter: string | object, cursor?: string, limit?: number, append: Collection[] = [], store = true) => {
      try {
        const result = await query('Collections', { filter, cursor, limit }, 'network-only');
        if (!(result as typeof result | undefined)) {
          return undefined;
        }

        const collections = result.Collections.edges.map<Collection>(collection => ({
          ...collection,
          records: collection.records.edges.reduce<CollectionRecord[]>((obj2, record) => [...obj2, record], [])
        }));

        if (store) {
          collectionsAddMany([...append, ...collections]);
        }

        return result.Collections;
      } catch {
        return undefined;
      }
    },
    [query, collectionsAddMany]
  );

  const fetchCollection = useCallback(
    async (id: string, recordsFilter: string, store = true) => {
      const variables: { id: string; recordsFilter?: string } = { id };
      if (recordsFilter) {
        variables.recordsFilter = recordsFilter;
      }

      try {
        const result = await query('Collection', variables, 'network-only');
        if (!(result as typeof result | undefined)) {
          return undefined;
        }

        const collection: Collection = {
          ...result.Collection,
          records: result.Collection.records.edges.reduce<CollectionRecord[]>((obj2, record) => [...obj2, record], [])
        };

        if (store) {
          collectionsAdd(collection);
        }

        return result.Collection;
      } catch {
        return undefined;
      }
    },
    [query, collectionsAdd]
  );

  // Queries

  const fetchRecords = useCallback(
    async (
      collectionId: string,
      filter?: string | object,
      cursor?: string,
      limit?: number,
      append: CollectionRecord[] = [],
      store = true
    ) => {
      try {
        const result = await query('CollectionRecords', { collectionId, filter, cursor, limit }, 'network-only');
        if (!(result as typeof result | undefined)) {
          return undefined;
        }

        if (store) {
          collectionRecordsAddMany(collectionId, [...append, ...result.CollectionRecords.edges]);
        }

        return result.CollectionRecords;
      } catch {
        return undefined;
      }
    },
    [query, collectionRecordsAddMany]
  );

  const fetchRecord = useCallback(
    async (collectionId: string, id: string, store = true) => {
      try {
        const result = await query('CollectionRecord', { collectionId, id }, 'network-only');
        if (!(result as typeof result | undefined)) {
          return undefined;
        }

        if (store) {
          collectionRecordsAdd(collectionId, result.CollectionRecord);
        }

        return result.CollectionRecord;
      } catch {
        return undefined;
      }
    },
    [query, collectionRecordsAdd]
  );

  // Mutations

  const addCollection = useCallback(
    async (
      name: string,
      namePlural: string,
      description: string,
      privacy: Collection['privacy'],
      fields: Collection['fields']
    ) => {
      const result = await mutate<Collection>('CollectionAdd', { name, namePlural, description, privacy, fields });
      if (result && !(result instanceof Error)) {
        collectionsAdd(result);

        return result;
      }

      return undefined;
    },
    [mutate, collectionsAdd]
  );

  const updateCollection = useCallback(
    async (
      id: string,
      name: string,
      namePlural: string,
      description: string,
      privacy: Collection['privacy'],
      fields: Collection['fields']
    ) => {
      const result = await mutate<Collection>('CollectionUpdate', {
        id,
        name,
        namePlural,
        description,
        privacy,
        fields
      });
      if (result && !(result instanceof Error)) {
        collectionsUpdate(result);

        return result;
      }

      return undefined;
    },
    [mutate, collectionsUpdate]
  );

  const removeCollection = useCallback(
    async (id: string) => {
      const result = await mutate<Collection>('CollectionRemove', { id });
      if (result && !(result instanceof Error)) {
        collectionsRemove(id);

        return true;
      }

      return false;
    },
    [mutate, collectionsRemove]
  );

  const addRecord = useCallback(
    async (
      collectionId: string,
      status: CollectionRecord['status'],
      values: CollectionRecord['values'],
      updateStore = true
    ) => {
      const result = await mutate<CollectionRecord>('CollectionAddRecord', { collectionId, status, values });
      if (result && !(result instanceof Error) && updateStore) {
        collectionRecordsAdd(collectionId, result);

        return result;
      }

      return undefined;
    },
    [mutate, collectionRecordsAdd]
  );

  const updateRecord = useCallback(
    async (
      collectionId: string,
      id: string,
      status: CollectionRecord['status'],
      values: CollectionRecord['values'],
      updateStore = true
    ) => {
      const result = await mutate<CollectionRecord>('CollectionUpdateRecord', { id, status, values });
      if (result && !(result instanceof Error) && updateStore) {
        collectionRecordsUpdate(collectionId, result);

        return result;
      }

      return undefined;
    },
    [mutate, collectionRecordsUpdate]
  );

  const removeRecord = useCallback(
    async (collectionId: string, id: string, updateStore = true) => {
      const result = await mutate('CollectionRemoveRecord', { id });
      if (result && updateStore) {
        collectionRecordsRemove(collectionId, id);

        return true;
      }

      return false;
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

  return <CollectionContext value={collectionContextValue}>{children}</CollectionContext>;
};

export default CollectionContextProvider;
