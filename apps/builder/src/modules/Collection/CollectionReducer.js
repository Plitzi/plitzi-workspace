// Packages
import get from 'lodash/get';
import set from 'lodash/set';
import { produce } from 'immer';

export const CollectionsActions = {
  COLLECTIONS_ADD: 'COLLECTIONS_ADD',
  COLLECTIONS_ADD_MANY: 'COLLECTIONS_ADD_MANY',
  COLLECTIONS_UPDATE: 'COLLECTIONS_UPDATE',
  COLLECTIONS_REMOVE: 'COLLECTIONS_REMOVE',
  COLLECTION_RECORDS_ADD: 'COLLECTION_RECORDS_ADD',
  COLLECTION_RECORDS_ADD_MANY: 'COLLECTION_RECORDS_ADD_MANY',
  COLLECTION_RECORDS_UPDATE: 'COLLECTION_RECORDS_UPDATE',
  COLLECTION_RECORDS_REMOVE: 'COLLECTION_RECORDS_REMOVE'
};

const CollectionReducer = (state, action = {}) => {
  switch (action.type) {
    case CollectionsActions.COLLECTIONS_ADD:
    case CollectionsActions.COLLECTIONS_ADD_MANY:
    case CollectionsActions.COLLECTIONS_UPDATE:
    case CollectionsActions.COLLECTIONS_REMOVE: {
      return { ...action.collections };
    }

    case CollectionsActions.COLLECTION_RECORDS_ADD: {
      return produce(state, draft => {
        const records = get(draft, `${action.collectionId}.records`);
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
        const records = get(draft, `${action.collectionId}.records`);
        const recordIndex = records.findIndex(record => record.id === action.record.id);
        set(draft, `${action.collectionId}.records.${recordIndex}`, action.record);
      });
    }

    case CollectionsActions.COLLECTION_RECORDS_REMOVE: {
      const { collectionId, recordId } = action;

      return produce(state, draft => {
        const collection = state[collectionId];
        if (!collection) {
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
