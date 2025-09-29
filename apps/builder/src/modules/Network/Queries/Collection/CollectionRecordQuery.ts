import { gql } from '@apollo/client/core';

import type { CollectionRecord } from '@plitzi/sdk-shared';

export type TCollectionRecordQuery = {
  CollectionRecord: CollectionRecord;
};

const CollectionRecordQuery = gql`
  query CollectionRecordQuery($id: String!, $collectionId: String!) {
    CollectionRecord(id: $id, collectionId: $collectionId) {
      id
      values
      status
      createdAt
      updatedAt
      publishedAt
    }
  }
`;

export default CollectionRecordQuery;
