import { gql } from '@apollo/client/core';

import type { CollectionRecord } from '@plitzi/sdk-shared';

export type TCollectionUpdateRecordMutation = CollectionRecord;

const CollectionUpdateRecordMutation = gql`
  mutation CollectionUpdateRecordMutation($id: String!, $status: String!, $values: Json!) {
    CollectionUpdateRecord(id: $id, status: $status, values: $values) {
      id
      status
      values
      createdAt
      updatedAt
      publishedAt
    }
  }
`;

export default CollectionUpdateRecordMutation;
