import { gql } from '@apollo/client/core';

import type { CollectionRecord } from '@plitzi/sdk-shared';

export type TCollectionRemoveRecordMutation = CollectionRecord;

const CollectionRemoveRecordMutation = gql`
  mutation CollectionRemoveRecordMutation($id: String!) {
    CollectionRemoveRecord(id: $id) {
      id
      values
      createdAt
      updatedAt
    }
  }
`;

export default CollectionRemoveRecordMutation;
