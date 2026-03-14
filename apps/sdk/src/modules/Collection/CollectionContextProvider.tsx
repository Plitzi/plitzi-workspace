import { useCallback, use, useMemo, useReducer, useRef } from 'react';

import NetworkInternalContext from '@modules/Network/contexts/NetworkInternalContext';
import CollectionReducer, { CollectionsActions } from '@plitzi/sdk-collections/CollectionReducer';
import CollectionContext from '@plitzi/sdk-shared/collections/CollectionContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import type {
  Collection,
  CollectionRecord,
  NetworkContextValue,
  SdkQueriesMap,
  SdkMutationsMap
} from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type CollectionContextProviderProps = {
  children: ReactNode;
  collections?: Record<string, Collection>;
};

const CollectionContextProvider = ({ children, collections: collectionsProp }: CollectionContextProviderProps) => {
  const { query, mutate } = use(NetworkContext) as NetworkContextValue<SdkQueriesMap, SdkMutationsMap>;
  const internalData = use(NetworkInternalContext);
  const collectionsPropMemo = useMemo(() => {
    if (collectionsProp) {
      return collectionsProp;
    }

    return internalData.collections ?? {};
  }, [collectionsProp, internalData.collections]);
  const [collections, dispatchCollection] = useReducer(CollectionReducer, collectionsPropMemo);
  const collectionsRef = useRef(collections);
  collectionsRef.current = collections;

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

  // Queries

  const fetchCollections = useCallback(
    async (filter: string | object, cursor?: string, limit?: number) =>
      (await query('Collections', { filter, cursor, limit }, 'network-only')).result?.Collections,
    [query]
  );

  const fetchCollection = useCallback(
    async (id: string, recordsFilter: string) =>
      (await query('Collection', { id, recordsFilter }, 'network-only')).result?.Collection,
    [query]
  );

  const fetchRecords = useCallback(
    async (collectionId: string, filter?: string | object, cursor?: string, limit?: number) =>
      (await query('CollectionRecords', { collectionId, filter, cursor, limit }, 'network-only')).result
        ?.CollectionRecords,
    [query]
  );

  const fetchRecord = useCallback(
    async (collectionId: string, id: string) =>
      (await query('CollectionRecord', { collectionId, id }, 'network-only')).result?.CollectionRecord,
    [query]
  );

  // Mutations

  const addRecord = useCallback(
    async (
      collectionId: string,
      status: CollectionRecord['status'],
      values: CollectionRecord['values'],
      updateStore = true
    ) => {
      const response = await mutate('CollectionAddRecord', { collectionId, status, values });
      if (response.result && updateStore) {
        collectionRecordsAdd(collectionId, response.result);

        return response.result;
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
      const response = await mutate('CollectionUpdateRecord', { id, status, values });
      if (response.result && updateStore) {
        collectionRecordsUpdate(collectionId, response.result);

        return response.result;
      }

      return undefined;
    },
    [mutate, collectionRecordsUpdate]
  );

  const removeRecord = useCallback(
    async (collectionId: string, id: string, updateStore = true) => {
      const result = await mutate('CollectionRemoveRecord', { id });
      if ((result as typeof result | undefined) && updateStore) {
        collectionRecordsRemove(collectionId, id);

        return true;
      }

      return false;
    },
    [mutate, collectionRecordsRemove]
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

  return <CollectionContext value={collectionContextValue}>{children}</CollectionContext>;
};

export default CollectionContextProvider;
