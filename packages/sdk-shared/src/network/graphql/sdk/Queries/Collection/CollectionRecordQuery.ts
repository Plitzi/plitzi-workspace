import { gql } from 'graphql-tag';

import type { CollectionRecord } from '../../../../../types';

export type TCollectionRecordQuery = {
  CollectionRecord: CollectionRecord;
};

const CollectionRecordQuery = gql`
  query CollectionRecordQuery($id: String!, $collectionId: String!) {
    CollectionRecord(id: $id, collectionId: $collectionId) {
      id
      values
      createdAt
      updatedAt
    }
  }
`;

export default CollectionRecordQuery;
