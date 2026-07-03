import { get, set } from '@plitzi/plitzi-ui/helpers';
import { produce } from 'immer';

import type { Collection, CollectionRecord } from '@plitzi/sdk-shared';

export const CollectionsActions = {
  COLLECTIONS_INIT: 'COLLECTIONS_INIT',
  COLLECTIONS_ADD: 'COLLECTIONS_ADD',
  COLLECTIONS_ADD_MANY: 'COLLECTIONS_ADD_MANY',
  COLLECTIONS_UPDATE: 'COLLECTIONS_UPDATE',
  COLLECTIONS_REMOVE: 'COLLECTIONS_REMOVE',
  COLLECTION_RECORDS_ADD: 'COLLECTION_RECORDS_ADD',
  COLLECTION_RECORDS_ADD_MANY: 'COLLECTION_RECORDS_ADD_MANY',
  COLLECTION_RECORDS_UPDATE: 'COLLECTION_RECORDS_UPDATE',
  COLLECTION_RECORDS_REMOVE: 'COLLECTION_RECORDS_REMOVE'
} as const;

export type CollectionReducerActions =
  | {
      type:
        'COLLECTIONS_INIT' | 'COLLECTIONS_ADD' | 'COLLECTIONS_ADD_MANY' | 'COLLECTIONS_UPDATE' | 'COLLECTIONS_REMOVE';
      collections: Record<string, Collection>;
    }
  | { type: 'COLLECTION_RECORDS_ADD'; collectionId: string; record: CollectionRecord }
  | { type: 'COLLECTION_RECORDS_ADD_MANY'; collectionId: string; records: CollectionRecord[] }
  | { type: 'COLLECTION_RECORDS_UPDATE'; collectionId: string; record: CollectionRecord }
  | { type: 'COLLECTION_RECORDS_REMOVE'; collectionId: string; recordId: string };

const CollectionReducer = (state: Record<string, Collection>, action: CollectionReducerActions) => {
  switch (action.type) {
    case CollectionsActions.COLLECTIONS_INIT:
    case CollectionsActions.COLLECTIONS_ADD:
    case CollectionsActions.COLLECTIONS_ADD_MANY:
    case CollectionsActions.COLLECTIONS_UPDATE:
    case CollectionsActions.COLLECTIONS_REMOVE: {
      return { ...action.collections };
    }

    case CollectionsActions.COLLECTION_RECORDS_ADD: {
      return produce(state, draft => {
        const records = get(draft, `${action.collectionId}.records`, []) as CollectionRecord[];
        set(draft, `${action.collectionId}.records`, [...records, action.record]);
      });
    }

    case CollectionsActions.COLLECTION_RECORDS_ADD_MANY: {
      return produce(state, draft => {
        set(draft, `${action.collectionId}.records`, action.records);
      });
    }

    case CollectionsActions.COLLECTION_RECORDS_UPDATE: {
      return produce(state, draft => {
        const records = get(draft, `${action.collectionId}.records`, []) as CollectionRecord[];
        const recordIndex = records.findIndex(record => record.id === action.record.id);
        set(draft, `${action.collectionId}.records.${recordIndex}`, action.record);
      });
    }

    case CollectionsActions.COLLECTION_RECORDS_REMOVE: {
      const { collectionId, recordId } = action;

      return produce(state, draft => {
        const collection = state[collectionId];
        if (!(collection as Collection | undefined)) {
          return;
        }

        const { records } = collection;

        set(
          draft,
          `${action.collectionId}.records`,
          records.filter(record => record.id !== recordId)
        );
      });
    }

    default:
      return state;
  }
};

export default CollectionReducer;
